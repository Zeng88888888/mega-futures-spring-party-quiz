import { json } from "./shared/supabaseAdmin.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
      return json(500, { message: "Netlify 尚未設定 ADMIN_PASSWORD。" });
    }

    if (!body.password || body.password !== expected) {
      return json(401, { message: "管理密碼錯誤。" });
    }

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { message: error.message || "登入失敗。" });
  }
}
