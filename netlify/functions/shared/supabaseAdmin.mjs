import { createClient } from "@supabase/supabase-js";

let adminClient;

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server env 缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return adminClient;
}

export function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  };
}

export function requireAdmin(event) {
  const expected = process.env.ADMIN_PASSWORD;
  const provided = event.headers["x-admin-password"] || event.headers["X-Admin-Password"];

  if (!expected) {
    throw new Error("Netlify 尚未設定 ADMIN_PASSWORD。");
  }

  if (!provided || provided !== expected) {
    const error = new Error("管理密碼錯誤或未登入。");
    error.statusCode = 401;
    throw error;
  }
}
