import {
  createQuestionBank,
  createGame,
  deleteGame,
  deleteQuestionBank,
  deleteQuestion,
  endGame,
  getGameById,
  getGameByJoinCode,
  getPlayerById,
  getRoundQuestion,
  getControlSnapshot,
  importQuestions,
  listQuestionBanks,
  listAnswersForRound,
  listQuestions,
  listGames,
  listPlayers,
  listPlayerRoundStatuses,
  openRegistration,
  resolveRound,
  startGame,
  startNextRound,
  togglePlayerValidity,
  updateGame,
  updatePlayer,
  updateQuestionBank,
  upsertQuestion
} from "./shared/gameService.mjs";
import { json, requireAdmin } from "./shared/supabaseAdmin.mjs";

const actions = {
  createQuestionBank,
  createGame,
  deleteGame,
  deleteQuestionBank,
  getGameById,
  getGameByJoinCode,
  getPlayerById,
  listQuestionBanks,
  listGames,
  listPlayers,
  listAnswersForRound,
  listPlayerRoundStatuses,
  listQuestions,
  getRoundQuestion,
  getControlSnapshot,
  openRegistration,
  startGame,
  startNextRound,
  resolveRound,
  endGame,
  updateGame,
  updatePlayer,
  togglePlayerValidity,
  updateQuestionBank,
  upsertQuestion,
  deleteQuestion,
  importQuestions
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    requireAdmin(event);
    const body = JSON.parse(event.body || "{}");
    const action = actions[body.action];

    if (!action) {
      return json(400, { message: "未知的管理操作。" });
    }

    const result = await action(body.payload || {});
    return json(200, result || { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message || "管理操作失敗。" });
  }
}
