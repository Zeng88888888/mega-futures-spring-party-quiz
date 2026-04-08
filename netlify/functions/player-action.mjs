import { joinGame, submitAnswer } from "./shared/gameService.mjs";
import { json } from "./shared/supabaseAdmin.mjs";

const actions = {
  joinGame,
  submitAnswer
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const action = actions[body.action];

    if (!action) {
      return json(400, { message: "未知的玩家操作。" });
    }

    const result = await action(body.payload || {});
    return json(200, result || { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message || "玩家操作失敗。" });
  }
}
