import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { COOKIE_NAME, COOKIE_OPTIONS, SERVER_PORT, SUPABASE_BUCKET } from "./config.js";
import {
  createCertificate,
  createUser,
  getCertificateById,
  initData,
  listUsers,
  searchByJshir,
  searchByName
} from "./db.js";
import { attachUser, requireAdmin, requireAuth, signAuthToken, verifyLogin } from "./auth.js";
import { supabase } from "./supabase.js";

const app = express();
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);
app.use("/public", express.static(path.join(process.cwd(), "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.get("/", (req, res) => {
  if (req.user) return res.redirect("/app");
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.user) return res.redirect("/app");
  res.render("login", { error: null });
});

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "Введите логин и пароль" });
  }

  const result = await verifyLogin({ username, password });
  if (!result.ok) {
    return res.status(401).json({ ok: false, message: "Неверный логин или пароль" });
  }

  const token = signAuthToken(result.user);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ ok: true });
}));

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.get("/app", requireAuth, (req, res) => {
  res.render("app", {
    user: {
      username: req.user.username,
      role: req.user.role,
      departmentName: req.user.department_name
    }
  });
});

app.get("/admin", requireAdmin, (req, res) => {
  res.render("admin", {
    user: {
      username: req.user.username,
      role: req.user.role,
      departmentName: req.user.department_name
    }
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      departmentName: req.user.department_name,
      expiresAt: req.user.expires_at
    }
  });
});

app.get("/api/search", requireAuth, asyncHandler(async (req, res) => {
  const mode = String(req.query?.mode || "").trim();
  const query = String(req.query?.q || "").trim();

  if (!query) return res.status(400).json({ ok: false, message: "Пустой запрос" });
  if (mode !== "jshir" && mode !== "name") {
    return res.status(400).json({ ok: false, message: "Неверный режим поиска" });
  }

  const isAdmin = req.user.role === "admin";
  if (mode === "jshir") {
    const rows = await searchByJshir({
      personJshir: query,
      departmentName: req.user.department_name,
      isAdmin
    });
    const personFullName = rows[0]?.person_full_name || null;
    return res.json({
      ok: true,
      mode,
      person: personFullName ? { fullName: personFullName, jshir: query } : null,
      certificates: rows.map((r) => ({
        id: r.id,
        title: r.title,
        uploadedAt: r.uploaded_at,
        departmentName: r.department_name,
        originalName: r.original_name,
        sizeBytes: r.size_bytes
      }))
    });
  }

  const rows = await searchByName({
    query,
    departmentName: req.user.department_name,
    isAdmin
  });

  const grouped = new Map();
  for (const r of rows) {
    const key = `${r.person_jshir}::${r.person_full_name}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        fullName: r.person_full_name,
        jshir: r.person_jshir,
        certificates: []
      });
    }
    grouped.get(key).certificates.push({
      id: r.id,
      title: r.title,
      uploadedAt: r.uploaded_at,
      departmentName: r.department_name,
      originalName: r.original_name,
      sizeBytes: r.size_bytes
    });
  }

  res.json({
    ok: true,
    mode,
    results: Array.from(grouped.values())
  });
}));

app.get("/api/certificates/:id/download", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).send("Bad Request");

  const cert = await getCertificateById(id);
  if (!cert) return res.status(404).send("Not Found");

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && cert.department_name !== req.user.department_name) {
    return res.status(403).send("Forbidden");
  }

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .download(cert.file_key);
  if (error || !data) return res.status(410).send("Gone");
  const bytes = Buffer.from(await data.arrayBuffer());

  res.setHeader("Content-Type", cert.mime_type);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(cert.original_name)}"`
  );
  res.send(bytes);
}));

app.get("/api/admin/users", requireAdmin, asyncHandler(async (_req, res) => {
  const users = await listUsers();
  res.json({ ok: true, users });
}));

app.post("/api/admin/users", requireAdmin, asyncHandler(async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const departmentName = String(req.body?.departmentName || "").trim();
  const role = String(req.body?.role || "user").trim();
  const expiresAtRaw = req.body?.expiresAt;

  if (!username || !password || !departmentName) {
    return res.status(400).json({ ok: false, message: "Заполните все поля" });
  }

  if (role !== "user" && role !== "admin") {
    return res.status(400).json({ ok: false, message: "Неверная роль" });
  }

  let expiresAt = null;
  if (expiresAtRaw) {
    const t = Date.parse(String(expiresAtRaw));
    if (!Number.isFinite(t)) {
      return res.status(400).json({ ok: false, message: "Неверная дата" });
    }
    expiresAt = t;
  }

  try {
    const user = await createUser({
      username,
      password,
      role,
      departmentName,
      expiresAt
    });
    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        departmentName: user.department_name,
        expiresAt: user.expires_at
      }
    });
  } catch (e) {
    const raw = String(e?.message || "").toLowerCase();
    const message =
      raw.includes("duplicate key") || raw.includes("unique")
        ? "Логин уже существует"
        : "Ошибка";
    res.status(400).json({ ok: false, message });
  }
}));

app.post(
  "/api/admin/certificates",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, message: "Файл не выбран" });

    const personJshir = String(req.body?.personJshir || "").trim();
    const personFullName = String(req.body?.personFullName || "").trim();
    const title = String(req.body?.title || "").trim();
    const departmentName = String(req.body?.departmentName || "").trim();

    if (!personJshir || !personFullName || !title || !departmentName) {
      return res.status(400).json({ ok: false, message: "Заполните все поля" });
    }

    const ext = path.extname(file.originalname || "");
    const fileKey = `${Date.now()}_${crypto.randomUUID()}${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(fileKey, file.buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: false
      });
    if (uploadError) {
      return res.status(500).json({ ok: false, message: "Ошибка загрузки файла" });
    }

    const cert = await createCertificate({
      personJshir,
      personFullName,
      title,
      departmentName,
      fileKey,
      originalName: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size
    });

    res.json({
      ok: true,
      certificate: {
        id: cert.id,
        title: cert.title,
        personJshir: cert.person_jshir,
        personFullName: cert.person_full_name,
        departmentName: cert.department_name,
        uploadedAt: cert.uploaded_at
      }
    });
  })
);

app.use((err, _req, res, _next) => {
  res.status(500).json({ ok: false, message: "Internal Server Error" });
});

async function start() {
  await initData();
  app.listen(SERVER_PORT, () => {
    process.stdout.write(`Сервер запущен: http://localhost:${SERVER_PORT}\n`);
  });
}

start().catch((e) => {
  process.stderr.write(`Ошибка запуска: ${e?.message || "unknown"}\n`);
  process.exit(1);
});
