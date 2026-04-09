import {
  createQuestionBank,
  createGame,
  deletePlayer,
  deleteGame,
  deleteQuestion,
  deleteQuestionBank,
  endGame,
  getControlSnapshot,
  getGameById,
  getGameByJoinCode,
  getPlayerById,
  getRoundQuestion,
  importQuestions,
  listAnswersForRound,
  listGames,
  listPlayerRoundStatuses,
  listPlayers,
  listQuestionBanks,
  listQuestions,
  openRegistration,
  resetGame,
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
  deletePlayer,
  deleteGame,
  deleteQuestion,
  deleteQuestionBank,
  endGame,
  getControlSnapshot,
  getGameById,
  getGameByJoinCode,
  getPlayerById,
  getRoundQuestion,
  importQuestions,
  listAnswersForRound,
  listGames,
  listPlayerRoundStatuses,
  listPlayers,
  listQuestionBanks,
  listQuestions,
  openRegistration,
  resetGame,
  resolveRound,
  startGame,
  startNextRound,
  togglePlayerValidity,
  updateGame,
  updatePlayer,
  updateQuestionBank,
  upsertQuestion
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
      return json(400, { message: "不支援的管理操作。" });
    }

    const result = await action(body.payload || {});
    return json(200, result || { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message || "後台操作失敗。" });
  }
}
