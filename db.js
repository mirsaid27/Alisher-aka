import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { supabase } from "./supabase.js";

function mapDbUser(user) {
  if (!user) return null;
  return {
    ...user,
    expires_at: user.expires_at == null ? null : Number(user.expires_at),
    created_at: Number(user.created_at)
  };
}

function mapDbCert(cert) {
  if (!cert) return null;
  return {
    ...cert,
    uploaded_at: Number(cert.uploaded_at),
    size_bytes: Number(cert.size_bytes)
  };
}

export async function initData() {
  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  if ((count || 0) > 0) return;

  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  const departmentName = (process.env.ADMIN_DEPARTMENT || "Администратор").trim();
  const rawPasswordFromEnv = process.env.ADMIN_PASSWORD?.trim() || "admin123";
  const rawPassword = rawPasswordFromEnv || crypto.randomBytes(10).toString("base64url");
  const passwordHash = bcrypt.hashSync(rawPassword, 12);

  const { error: insertError } = await supabase.from("users").insert({
    username,
    password_hash: passwordHash,
    role: "admin",
    department_name: departmentName,
    expires_at: null,
    created_at: Date.now()
  });
  if (insertError) throw insertError;

  if (!rawPasswordFromEnv) {
    process.stdout.write(
      `\nПервичный админ создан.\nЛогин: ${username}\nПароль: ${rawPassword}\n\n`
    );
  }
}

export async function getUserByUsername(username) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return mapDbUser(data);
}

export async function getUserById(id) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return mapDbUser(data);
}

export async function createUser({ username, password, role, departmentName, expiresAt }) {
  const passwordHash = bcrypt.hashSync(password, 12);
  const { data, error } = await supabase
    .from("users")
    .insert({
      username,
      password_hash: passwordHash,
      role,
      department_name: departmentName,
      expires_at: expiresAt ?? null,
      created_at: Date.now()
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapDbUser(data);
}

export async function listUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, role, department_name, expires_at, created_at")
    .order("id", { ascending: false });
  if (error) throw error;
  return (data || []).map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    departmentName: u.department_name,
    expiresAt: u.expires_at == null ? null : Number(u.expires_at),
    createdAt: Number(u.created_at)
  }));
}

export async function createCertificate({
  personJshir,
  personFullName,
  title,
  departmentName,
  fileKey,
  originalName,
  mimeType,
  sizeBytes
}) {
  const { data, error } = await supabase
    .from("certificates")
    .insert({
      person_jshir: personJshir,
      person_full_name: personFullName,
      title,
      department_name: departmentName,
      file_key: fileKey,
      original_name: originalName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      uploaded_at: Date.now()
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapDbCert(data);
}

export async function getCertificateById(id) {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return mapDbCert(data);
}

export async function searchByJshir({ personJshir, departmentName, isAdmin }) {
  let query = supabase
    .from("certificates")
    .select("*")
    .eq("person_jshir", personJshir)
    .order("uploaded_at", { ascending: false });

  if (!isAdmin) query = query.eq("department_name", departmentName);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDbCert);
}

export async function searchByName({ query, departmentName, isAdmin, limit = 50 }) {
  let q = supabase
    .from("certificates")
    .select("*")
    .ilike("person_full_name", `%${query}%`)
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (!isAdmin) q = q.eq("department_name", departmentName);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapDbCert);
}
