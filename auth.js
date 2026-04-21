import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, JWT_SECRET } from "./config.js";
import { getUserById, getUserByUsername } from "./db.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      role: user.role,
      departmentName: user.department_name,
      username: user.username
    },
    JWT_SECRET,
    {
      subject: String(user.id),
      expiresIn: "12h"
    }
  );
}

export function readAuthToken(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function attachUser(req, _res, next) {
  const payload = readAuthToken(req);
  if (!payload?.sub) return next();

  try {
    const user = await getUserById(Number(payload.sub));
    if (!user) return next();

    if (user.expires_at != null && user.expires_at <= Date.now()) return next();

    req.user = user;
    next();
  } catch {
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.redirect("/login");
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect("/login");
  if (req.user.role !== "admin") return res.status(403).send("Forbidden");
  next();
}

export async function verifyLogin({ username, password }) {
  const user = await getUserByUsername(username);
  if (!user) return { ok: false };

  if (user.expires_at != null && user.expires_at <= Date.now()) {
    return { ok: false };
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return { ok: false };

  return { ok: true, user };
}
