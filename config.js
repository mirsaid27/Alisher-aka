import crypto from "node:crypto";

export const JWT_SECRET =
  process.env.JWT_SECRET?.trim() || crypto.randomBytes(48).toString("base64url");

export const SERVER_PORT = Number(process.env.PORT || 3000);
export const COOKIE_NAME = "auth";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

export const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
export const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();
export const SUPABASE_BUCKET = String(
  process.env.SUPABASE_BUCKET || "certificates"
).trim();
