import { getJoinStats, getPlayerSnapshot, listJoinableGames } from "./shared/gameService.mjs";
import { json } from "./shared/supabaseAdmin.mjs";

const actions = {
  getJoinStats,
  getPlayerSnapshot,
  listJoinableGames
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const action = actions[body.action];

    if (!action) {
      return json(400, { message: "未知的讀取操作。" });
    }

    const result = await action(body.payload || {});
    return json(200, result);
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message || "讀取資料失敗。" });
  }
}
