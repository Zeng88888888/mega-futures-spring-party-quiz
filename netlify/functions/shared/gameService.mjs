import { getSupabaseAdmin } from "./supabaseAdmin.mjs";

const DEFAULT_COMPETITION_SECONDS = 10;
const DEFAULT_BANK_TITLE = "題庫一";
const PREP_COUNTDOWN_SECONDS = 10;

const GAME_SELECT = `
  id,
  title,
  mode,
  status,
  join_code,
  bank_id,
  question_count,
  competition_seconds,
  current_round,
  leaderboard_size,
  started_at,
  ended_at,
  created_at,
  question_banks(title)
`;

function computeCompetitionScore(responseMs, competitionSeconds) {
  const durationMs = Math.max(competitionSeconds, 1) * 1000;
  const clamped = Math.min(Math.max(responseMs, 0), durationMs);
  const remainingRatio = (durationMs - clamped) / durationMs;
  return Math.round(10 + 90 * remainingRatio);
}

function normalizeGameRow(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    bank_title: row.question_banks?.title ?? null
  };
}

async function ensureDefaultQuestionBank() {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("question_banks")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: true });

  if (existingError) {
    throw existingError;
  }

  if ((existing ?? []).length > 0) {
    return existing[0];
  }

  const { data: bank, error: insertError } = await supabase
    .from("question_banks")
    .insert({
      title: DEFAULT_BANK_TITLE,
      description: "系統預設題庫"
    })
    .select("id, title, description, created_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  await supabase.from("questions").update({ bank_id: bank.id }).is("bank_id", null);
  await supabase.from("games").update({ bank_id: bank.id }).is("bank_id", null);

  return bank;
}

async function countQuestionsByBank() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("questions").select("bank_id");

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((map, row) => {
    const key = row.bank_id;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
}

async function requireQuestionBank(bankId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("question_banks")
    .select("id, title, description, created_at")
    .eq("id", bankId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("找不到指定題庫。");
  }

  return data;
}

async function fetchQuestionsByBank(bankId, limit) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("questions")
    .select("id, bank_id, content, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at")
    .eq("bank_id", bankId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function rebuildGameQuestions(gameId, bankId, questionCount) {
  const supabase = getSupabaseAdmin();
  const questions = await fetchQuestionsByBank(bankId, questionCount);

  if (questions.length < questionCount) {
    throw new Error(`題庫只有 ${questions.length} 題，無法建立 ${questionCount} 題的場次。`);
  }

  const { error: deleteError } = await supabase.from("game_questions").delete().eq("game_id", gameId);
  if (deleteError) {
    throw deleteError;
  }

  const mappings = questions.slice(0, questionCount).map((question, index) => ({
    game_id: gameId,
    question_id: question.id,
    order_no: index + 1
  }));

  const { error: insertError } = await supabase.from("game_questions").insert(mappings);
  if (insertError) {
    throw insertError;
  }
}

export async function listQuestionBanks() {
  const defaultBank = await ensureDefaultQuestionBank();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("question_banks")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const counts = await countQuestionsByBank();
  const banks = (data ?? [defaultBank]).map((bank) => ({
    ...bank,
    question_count: counts.get(bank.id) ?? 0
  }));

  return { banks };
}

export async function createQuestionBank(payload) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("question_banks")
    .insert({
      title: String(payload.title).trim(),
      description: String(payload.description ?? "").trim()
    })
    .select("id, title, description, created_at")
    .single();

  if (error) {
    throw error;
  }

  return { bank: { ...data, question_count: 0 } };
}

export async function updateQuestionBank(payload) {
  await requireQuestionBank(payload.id);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("question_banks")
    .update({
      title: String(payload.title).trim(),
      description: String(payload.description ?? "").trim()
    })
    .eq("id", payload.id);

  if (error) {
    throw error;
  }
}

export async function deleteQuestionBank(payload) {
  const bank = await requireQuestionBank(payload.id);
  if (bank.title === DEFAULT_BANK_TITLE) {
    throw new Error("預設題庫不可刪除。");
  }

  const supabase = getSupabaseAdmin();
  const [{ count: questionCount, error: questionError }, { count: gameCount, error: gameError }] =
    await Promise.all([
      supabase.from("questions").select("id", { count: "exact", head: true }).eq("bank_id", payload.id),
      supabase.from("games").select("id", { count: "exact", head: true }).eq("bank_id", payload.id)
    ]);

  if (questionError) {
    throw questionError;
  }

  if (gameError) {
    throw gameError;
  }

  if ((questionCount ?? 0) > 0 || (gameCount ?? 0) > 0) {
    throw new Error("題庫內仍有題目或場次正在使用，無法刪除。");
  }

  const { error } = await supabase.from("question_banks").delete().eq("id", payload.id);
  if (error) {
    throw error;
  }
}

export async function fetchGameById(gameId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeGameRow(data);
}

export async function fetchGameByJoinCode(joinCode) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("join_code", String(joinCode).trim().toUpperCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeGameRow(data);
}

export async function getGameById(payload) {
  return { game: await fetchGameById(payload.gameId) };
}

export async function getGameByJoinCode(payload) {
  return { game: await fetchGameByJoinCode(payload.joinCode) };
}

export async function fetchPlayerById(playerId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("players")
    .select("id, game_id, nickname, department, employee_id, status, is_valid, total_score, total_response_ms, joined_at")
    .eq("id", playerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchPlayers(gameId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("players")
    .select("id, game_id, nickname, department, employee_id, status, is_valid, total_score, total_response_ms, joined_at")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPlayerById(payload) {
  return { player: await fetchPlayerById(payload.playerId) };
}

export async function fetchQuestionForRound(gameId, roundNo) {
  const supabase = getSupabaseAdmin();
  const { data: mapping, error: mappingError } = await supabase
    .from("game_questions")
    .select("question_id, order_no")
    .eq("game_id", gameId)
    .eq("order_no", roundNo)
    .maybeSingle();

  if (mappingError) {
    throw mappingError;
  }

  if (!mapping) {
    return null;
  }

  const { data, error } = await supabase
    .from("questions")
    .select("id, bank_id, content, option_a, option_b, option_c, option_d, correct_option, explanation")
    .eq("id", mapping.question_id)
    .single();

  if (error) {
    throw error;
  }

  return { ...data, order_no: mapping.order_no };
}

export async function listQuestions(payload = {}) {
  await ensureDefaultQuestionBank();
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("questions")
    .select("id, bank_id, content, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, created_at")
    .order("created_at", { ascending: true });

  if (payload.bankId) {
    query = query.eq("bank_id", payload.bankId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return { questions: data ?? [] };
}

export async function reorderQuestions(payload) {
  const supabase = getSupabaseAdmin();
  const bank = await requireQuestionBank(payload.bankId);
  const questionIds = Array.isArray(payload.questionIds) ? payload.questionIds : [];

  if (questionIds.length === 0) {
    throw new Error("沒有可排序的題目。");
  }

  const { data: rows, error } = await supabase
    .from("questions")
    .select("id")
    .eq("bank_id", bank.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const validIds = new Set((rows ?? []).map((row) => row.id));
  const orderedIds = questionIds.filter((id) => validIds.has(id));

  if (orderedIds.length !== validIds.size) {
    throw new Error("題目排序資料不完整，請重新整理後再試。");
  }

  const baseTime = Date.now();
  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const createdAt = new Date(baseTime + index * 1000).toISOString();
    const { error: updateError } = await supabase
      .from("questions")
      .update({ created_at: createdAt })
      .eq("id", id)
      .eq("bank_id", bank.id);

    if (updateError) {
      throw updateError;
    }
  }

  return { ok: true };
}

export async function shuffleQuestions(payload) {
  const supabase = getSupabaseAdmin();
  const bank = await requireQuestionBank(payload.bankId);
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("bank_id", bank.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const ids = (data ?? []).map((row) => row.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[randomIndex]] = [ids[randomIndex], ids[index]];
  }

  return reorderQuestions({ bankId: bank.id, questionIds: ids });
}

export async function getJoinStats(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameByJoinCode(payload.joinCode);

  if (!game) {
    return { game: null, playerCount: 0 };
  }

  const { count, error } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("game_id", game.id)
    .eq("is_valid", true);

  if (error) {
    throw error;
  }

  return {
    game: {
      id: game.id,
      title: game.title,
      status: game.status,
      mode: game.mode,
      questionCount: game.question_count
    },
    playerCount: count ?? 0
  };
}

export async function listJoinableGames() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .in("status", ["draft", "registering", "live_question", "round_result"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return {
    games: (data ?? []).map((game) => {
      const row = normalizeGameRow(game);
      return {
        id: row.id,
        title: row.title,
        mode: row.mode,
        status: row.status,
        bankId: row.bank_id,
        bankTitle: row.bank_title,
        questionCount: row.question_count,
        currentRound: row.current_round,
        joinCode: row.join_code,
        competitionSeconds: row.mode === "competition" ? row.competition_seconds : null,
        survivalThreshold: row.mode === "survival" ? row.competition_seconds : null,
        leaderboardSize: row.leaderboard_size,
        startedAt: row.started_at,
        endedAt: row.ended_at
      };
    })
  };
}

export async function getRoundQuestion(payload) {
  const question = await fetchQuestionForRound(payload.gameId, payload.roundNo);
  return { question };
}

export async function fetchAnswersForRound(gameId, roundNo) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("answers")
    .select("player_id, question_id, round_no, selected_option, answer_status, is_correct, response_ms, score, answered_at")
    .eq("game_id", gameId)
    .eq("round_no", roundNo);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchPlayerAnswerForRound(gameId, playerId, roundNo) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("answers")
    .select("player_id, question_id, round_no, selected_option, answer_status, is_correct, response_ms, score, answered_at")
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .eq("round_no", roundNo)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchVisiblePlayersForSnapshot(game) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("players")
    .select("id, game_id, nickname, department, employee_id, status, is_valid, total_score, total_response_ms, joined_at")
    .eq("game_id", game.id)
    .eq("is_valid", true);

  if (game.mode === "competition") {
    query = query
      .order("total_score", { ascending: false })
      .order("total_response_ms", { ascending: true })
      .limit(game.leaderboard_size || 10);
  } else {
    query = query.order("joined_at", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listAnswersForRound(payload) {
  return { answers: await fetchAnswersForRound(payload.gameId, payload.roundNo) };
}

export async function listPlayerRoundStatuses(payload) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("player_round_statuses")
    .select("player_id, round_no, answer_status, survived, eliminated_in_round")
    .eq("game_id", payload.gameId);

  if (payload.roundNo) {
    query = query.eq("round_no", payload.roundNo);
  }

  const { data, error } = await query.order("round_no", { ascending: true });

  if (error) {
    throw error;
  }

  return { statuses: data ?? [] };
}

export async function joinGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameByJoinCode(payload.joinCode);

  if (!game) {
    throw new Error("找不到對應場次。");
  }

  const employeeId = String(payload.employeeId).trim();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("players")
    .select("id, game_id, nickname, department, employee_id, status, is_valid, total_score, total_response_ms, joined_at")
    .eq("game_id", game.id)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    if (!duplicate.is_valid) {
      throw new Error("此員編目前已被標記為無效，請洽主持人協助。");
    }

    return {
      game,
      player: duplicate
    };
  }

  if (game.status !== "draft" && game.status !== "registering") {
    throw new Error("場次已開始，只有已報名玩家可以重新登入。");
  }

  const { data, error } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      nickname: String(payload.nickname).trim(),
      department: String(payload.department).trim(),
      employee_id: employeeId,
      status: "waiting",
      is_valid: true,
      total_score: 0,
      total_response_ms: 0
    })
    .select("id, game_id, nickname, department, employee_id, status, is_valid, total_score, total_response_ms, joined_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    game,
    player: data
  };
}

export async function createGame(payload) {
  const bank = await requireQuestionBank(payload.bankId);
  const supabase = getSupabaseAdmin();
  const joinCode = String(payload.joinCode).trim().toUpperCase();
  const { data: existingCode, error: existingError } = await supabase
    .from("games")
    .select("id")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingCode) {
    throw new Error("場次識別碼已存在，請重新產生。");
  }

  const questionCount = Number(payload.questionCount);
  const availableQuestions = await fetchQuestionsByBank(bank.id, questionCount);
  if (availableQuestions.length < questionCount) {
    throw new Error(`題庫 ${bank.title} 只有 ${availableQuestions.length} 題，無法建立 ${questionCount} 題的場次。`);
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      title: String(payload.title).trim(),
      mode: payload.mode,
      bank_id: bank.id,
      question_count: questionCount,
      join_code: joinCode,
      leaderboard_size: Number(payload.leaderboardSize || 10),
      competition_seconds:
        payload.mode === "competition"
          ? Number(payload.competitionSeconds || DEFAULT_COMPETITION_SECONDS)
          : Number(payload.survivalThreshold || 10),
      status: "draft",
      current_round: 0
    })
    .select(GAME_SELECT)
    .single();

  if (error) {
    throw error;
  }

  await rebuildGameQuestions(data.id, bank.id, questionCount);
  return { game: normalizeGameRow(data) };
}

export async function updateGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);

  if (!game) {
    throw new Error("找不到要編輯的場次。");
  }

  if (!["draft", "registering"].includes(game.status)) {
    throw new Error("場次進行中或已結束，不能再編輯。");
  }

  const bank = await requireQuestionBank(payload.bankId);
  const joinCode = String(payload.joinCode).trim().toUpperCase();
  const questionCount = Number(payload.questionCount);

  const { data: duplicate, error: duplicateError } = await supabase
    .from("games")
    .select("id")
    .eq("join_code", joinCode)
    .neq("id", payload.gameId)
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    throw new Error("場次識別碼已存在，請重新產生。");
  }

  const availableQuestions = await fetchQuestionsByBank(bank.id, questionCount);
  if (availableQuestions.length < questionCount) {
    throw new Error(`題庫 ${bank.title} 只有 ${availableQuestions.length} 題，無法更新成 ${questionCount} 題。`);
  }

  const { error } = await supabase
    .from("games")
    .update({
      title: String(payload.title).trim(),
      mode: payload.mode,
      bank_id: bank.id,
      question_count: questionCount,
      join_code: joinCode,
      leaderboard_size: Number(payload.leaderboardSize || 10),
      competition_seconds:
        payload.mode === "competition"
          ? Number(payload.competitionSeconds || DEFAULT_COMPETITION_SECONDS)
          : Number(payload.survivalThreshold || 10)
    })
    .eq("id", payload.gameId);

  if (error) {
    throw error;
  }

  await rebuildGameQuestions(payload.gameId, bank.id, questionCount);
  return { game: await fetchGameById(payload.gameId) };
}

export async function deleteGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);

  if (!game) {
    throw new Error("找不到要刪除的場次。");
  }

  if (["live_question"].includes(game.status)) {
    throw new Error("場次進行中，無法刪除。");
  }

  const { error } = await supabase.from("games").delete().eq("id", payload.gameId);
  if (error) {
    throw error;
  }
}

export async function updatePlayer(payload) {
  const supabase = getSupabaseAdmin();
  const { data: currentPlayer, error: currentError } = await supabase
    .from("players")
    .select("id, game_id")
    .eq("id", payload.playerId)
    .single();

  if (currentError) {
    throw currentError;
  }

  const employeeId = String(payload.employeeId).trim();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", currentPlayer.game_id)
    .eq("employee_id", employeeId)
    .neq("id", payload.playerId)
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    throw new Error("員編已存在於同場次，請重新確認。");
  }

  const { error } = await supabase
    .from("players")
    .update({
      nickname: String(payload.nickname).trim(),
      department: String(payload.department).trim(),
      employee_id: employeeId
    })
    .eq("id", payload.playerId);

  if (error) {
    throw error;
  }
}

export async function togglePlayerValidity(payload) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("players")
    .update({
      is_valid: !!payload.valid,
      status: payload.valid ? "waiting" : "invalid"
    })
    .eq("id", payload.playerId);

  if (error) {
    throw error;
  }
}

async function rebuildRoundResultCounts(gameId) {
  const supabase = getSupabaseAdmin();
  const { data: results, error: resultError } = await supabase
    .from("round_results")
    .select("id, round_no")
    .eq("game_id", gameId);

  if (resultError) {
    throw resultError;
  }

  for (const result of results ?? []) {
    const { data: statuses, error: statusError } = await supabase
      .from("player_round_statuses")
      .select("survived, eliminated_in_round")
      .eq("game_id", gameId)
      .eq("round_no", result.round_no);

    if (statusError) {
      throw statusError;
    }

    const aliveCount = (statuses ?? []).filter((item) => item.survived).length;
    const eliminatedCount = (statuses ?? []).filter((item) => item.eliminated_in_round).length;

    const { error: updateError } = await supabase
      .from("round_results")
      .update({
        alive_count: aliveCount,
        eliminated_count: eliminatedCount
      })
      .eq("id", result.id);

    if (updateError) {
      throw updateError;
    }
  }
}

export async function deletePlayer(payload) {
  const supabase = getSupabaseAdmin();
  const player = await fetchPlayerById(payload.playerId);

  if (!player) {
    throw new Error("找不到要刪除的玩家。");
  }

  const { error } = await supabase.from("players").delete().eq("id", payload.playerId);
  if (error) {
    throw error;
  }

  await rebuildRoundResultCounts(player.game_id);
  return { ok: true };
}

export async function deletePlayers(payload) {
  const playerIds = Array.isArray(payload.playerIds)
    ? payload.playerIds.filter((value) => typeof value === "string" && value.trim())
    : [];

  if (playerIds.length === 0) {
    throw new Error("請先選擇要刪除的玩家。");
  }

  const supabase = getSupabaseAdmin();
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, game_id")
    .in("id", playerIds);

  if (playersError) {
    throw playersError;
  }

  if (!players || players.length === 0) {
    throw new Error("找不到要刪除的玩家資料。");
  }

  const { error: deleteError } = await supabase.from("players").delete().in("id", players.map((player) => player.id));
  if (deleteError) {
    throw deleteError;
  }

  const gameIds = [...new Set(players.map((player) => player.game_id))];
  for (const gameId of gameIds) {
    await rebuildRoundResultCounts(gameId);
  }

  return {
    ok: true,
    deletedCount: players.length
  };
}

export async function openRegistration(payload) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("games")
    .update({ status: "registering", ended_at: null })
    .eq("id", payload.gameId);

  if (error) {
    throw error;
  }
}

async function resetPlayersForRound(gameId, mode) {
  const supabase = getSupabaseAdmin();
  const players = await fetchPlayers(gameId);
  const targetPlayers = players.filter(
    (player) => player.is_valid && (mode === "competition" || player.status !== "eliminated")
  );

  await Promise.all(
    targetPlayers.map((player) => supabase.from("players").update({ status: "active" }).eq("id", player.id))
  );
}

export async function startGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  if (!game) {
    throw new Error("找不到場次。");
  }

  const nextRound = game.current_round > 0 ? game.current_round : 1;
  const roundStartsAt =
    game.mode === "competition"
      ? new Date(Date.now() + PREP_COUNTDOWN_SECONDS * 1000).toISOString()
      : new Date().toISOString();

  const { error } = await supabase
    .from("games")
    .update({
      status: "live_question",
      current_round: nextRound,
      started_at: roundStartsAt,
      ended_at: null
    })
    .eq("id", payload.gameId);

  if (error) {
    throw error;
  }

  await resetPlayersForRound(payload.gameId, game.mode);
}

export async function startNextRound(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  if (!game) {
    throw new Error("找不到場次。");
  }

  if (game.status !== "round_result") {
    throw new Error("請先公布本題結果，再進入下一題。");
  }

  if (game.current_round >= game.question_count) {
    await endGame(payload);
    return;
  }

  const roundStartsAt =
    game.mode === "competition"
      ? new Date(Date.now() + PREP_COUNTDOWN_SECONDS * 1000).toISOString()
      : new Date().toISOString();

  const { error } = await supabase
    .from("games")
    .update({
      status: "live_question",
      current_round: game.current_round + 1,
      started_at: roundStartsAt
    })
    .eq("id", payload.gameId);

  if (error) {
    throw error;
  }

  await resetPlayersForRound(payload.gameId, game.mode);
}

export async function endGame(payload) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("games")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", payload.gameId);

  if (error) {
    throw error;
  }
}

export async function resetGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);

  if (!game) {
    throw new Error("找不到要重設的場次。");
  }

  await Promise.all([
    supabase.from("answers").delete().eq("game_id", payload.gameId),
    supabase.from("round_results").delete().eq("game_id", payload.gameId),
    supabase.from("player_round_statuses").delete().eq("game_id", payload.gameId)
  ]);

  const players = await fetchPlayers(payload.gameId);
  for (const player of players) {
    const nextStatus = player.is_valid ? "waiting" : "invalid";
    const { error: playerError } = await supabase
      .from("players")
      .update({
        status: nextStatus,
        total_score: 0,
        total_response_ms: 0
      })
      .eq("id", player.id);

    if (playerError) {
      throw playerError;
    }
  }

  const { error } = await supabase
    .from("games")
    .update({
      status: "draft",
      current_round: 0,
      started_at: null,
      ended_at: null
    })
    .eq("id", payload.gameId);

  if (error) {
    throw error;
  }

  return { game: await fetchGameById(payload.gameId) };
}

export async function submitAnswer(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  const player = await fetchPlayerById(payload.playerId);

  if (!game || game.status !== "live_question" || !player || !player.is_valid) {
    throw new Error("目前不可作答。");
  }

  if (game.mode === "survival" && player.status === "eliminated") {
    throw new Error("你已被淘汰，不能再作答。");
  }

  const question = await fetchQuestionForRound(payload.gameId, game.current_round);
  if (!question) {
    throw new Error("本題尚未設定完成。");
  }

  const { data: existing, error: existingError } = await supabase
    .from("answers")
    .select("id")
    .eq("game_id", payload.gameId)
    .eq("player_id", payload.playerId)
    .eq("round_no", game.current_round)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw new Error("本題已送出過答案。");
  }

  const clientAnsweredAt =
    typeof payload.answeredAt === "string" && payload.answeredAt
      ? new Date(payload.answeredAt)
      : new Date();
  const answeredAtMs = clientAnsweredAt.getTime();

  if (Number.isNaN(answeredAtMs)) {
    throw new Error("作答時間格式錯誤。");
  }

  if (game.mode === "competition" && game.started_at && game.competition_seconds) {
    const startedAtMs = new Date(game.started_at).getTime();
    if (answeredAtMs < startedAtMs) {
      throw new Error("本題尚未開始作答。");
    }
    const deadlineMs = startedAtMs + game.competition_seconds * 1000;
    if (answeredAtMs > deadlineMs) {
      throw new Error("本題作答時間已結束。");
    }
  }

  const { error } = await supabase.from("answers").insert({
    game_id: payload.gameId,
    question_id: question.id,
    player_id: payload.playerId,
    round_no: game.current_round,
    selected_option: payload.selectedOption,
    answered_at: clientAnsweredAt.toISOString()
  });

  if (error) {
    throw error;
  }

  const { error: playerError } = await supabase.from("players").update({ status: "submitted" }).eq("id", payload.playerId);
  if (playerError) {
    throw playerError;
  }
}

export async function resolveRound(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  if (!game || game.current_round <= 0) {
    throw new Error("目前沒有可結算的題目。");
  }

  const question = await fetchQuestionForRound(payload.gameId, game.current_round);
  if (!question) {
    throw new Error("找不到本輪題目。");
  }

  if (
    game.mode === "competition" &&
    game.started_at &&
    new Date(game.started_at).getTime() > Date.now()
  ) {
    throw new Error("共同倒數尚未結束，暫時不能公布結果。");
  }

  const players = await fetchPlayers(payload.gameId);
  const answers = await fetchAnswersForRound(payload.gameId, game.current_round);
  const answerMap = new Map(answers.map((answer) => [answer.player_id, answer]));
  const durationMs = (game.competition_seconds || DEFAULT_COMPETITION_SECONDS) * 1000;
  const roundStartMs = game.started_at ? new Date(game.started_at).getTime() : Date.now();
  const activePlayers = players.filter(
    (player) =>
      player.is_valid &&
      player.status !== "invalid" &&
      (game.mode === "competition" || player.status !== "eliminated")
  );

  const answerUpserts = [];
  const roundStatusUpserts = [];
  let aliveCount = 0;
  let eliminatedCount = 0;

  const playerUpdates = [];

  for (const player of activePlayers) {
    const existingAnswer = answerMap.get(player.id);
    const answeredAtMs = existingAnswer?.answered_at ? new Date(existingAnswer.answered_at).getTime() : null;
    const responseMs =
      answeredAtMs !== null ? Math.max(0, answeredAtMs - roundStartMs) : game.mode === "competition" ? durationMs : null;

    let answerStatus = "no_answer";
    let isCorrect = false;
    let score = 0;
    let nextStatus = player.status;
    let survived = true;
    let eliminatedInRound = false;
    let nextTotalScore = player.total_score;
    let nextTotalResponseMs = player.total_response_ms;

    if (existingAnswer?.selected_option) {
      isCorrect = existingAnswer.selected_option === question.correct_option;
      answerStatus = isCorrect ? "correct" : "wrong";
    }

    if (game.mode === "competition") {
      const safeResponseMs = responseMs ?? durationMs;
      if (isCorrect) {
        score = computeCompetitionScore(safeResponseMs, game.competition_seconds || DEFAULT_COMPETITION_SECONDS);
      }
      nextTotalScore += score;
      nextTotalResponseMs += safeResponseMs;
      nextStatus = "active";
      aliveCount += 1;
    } else if (answerStatus === "correct") {
      nextStatus = "active";
      survived = true;
      aliveCount += 1;
    } else {
      nextStatus = "eliminated";
      survived = false;
      eliminatedInRound = true;
      eliminatedCount += 1;
    }

    answerUpserts.push({
      game_id: payload.gameId,
      question_id: question.id,
      player_id: player.id,
      round_no: game.current_round,
      selected_option: existingAnswer?.selected_option ?? null,
      answer_status: answerStatus,
      is_correct: isCorrect,
      response_ms: responseMs,
      score,
      answered_at: existingAnswer?.answered_at ?? null
    });

    roundStatusUpserts.push({
      game_id: payload.gameId,
      question_id: question.id,
      player_id: player.id,
      round_no: game.current_round,
      answer_status: answerStatus,
      survived,
      eliminated_in_round: eliminatedInRound
    });

    playerUpdates.push({
      id: player.id,
      status: nextStatus,
      total_score: nextTotalScore,
      total_response_ms: nextTotalResponseMs
    });
  }

  if (answerUpserts.length > 0) {
    const { error } = await supabase.from("answers").upsert(answerUpserts, { onConflict: "question_id,player_id" });
    if (error) {
      throw error;
    }
  }

  if (roundStatusUpserts.length > 0) {
    const { error } = await supabase
      .from("player_round_statuses")
      .upsert(roundStatusUpserts, { onConflict: "question_id,player_id" });
    if (error) {
      throw error;
    }
  }

  if (playerUpdates.length > 0) {
    const results = await Promise.all(
      playerUpdates.map((playerUpdate) =>
        supabase
          .from("players")
          .update({
            status: playerUpdate.status,
            total_score: playerUpdate.total_score,
            total_response_ms: playerUpdate.total_response_ms
          })
          .eq("id", playerUpdate.id)
      )
    );

    for (const result of results) {
      if (result.error) {
        throw result.error;
      }
    }
  }

  const { error: roundError } = await supabase.from("round_results").upsert(
    {
      game_id: payload.gameId,
      question_id: question.id,
      round_no: game.current_round,
      published_at: new Date().toISOString(),
      alive_count: game.mode === "competition" ? activePlayers.length : aliveCount,
      eliminated_count: game.mode === "competition" ? 0 : eliminatedCount
    },
    { onConflict: "game_id,round_no" }
  );

  if (roundError) {
    throw roundError;
  }

  if (game.mode === "survival" && aliveCount <= Number(game.competition_seconds || 10)) {
    await endGame({ gameId: payload.gameId });
    return;
  }

  const { error: gameError } = await supabase.from("games").update({ status: "round_result" }).eq("id", payload.gameId);
  if (gameError) {
    throw gameError;
  }
}

export async function upsertQuestion(payload) {
  const bank = await requireQuestionBank(payload.bankId);
  const supabase = getSupabaseAdmin();
  const record = {
    bank_id: bank.id,
    content: String(payload.content).trim(),
    option_a: String(payload.optionA).trim(),
    option_b: String(payload.optionB).trim(),
    option_c: String(payload.optionC).trim(),
    option_d: String(payload.optionD).trim(),
    correct_option: String(payload.correctOption).trim().toUpperCase(),
    explanation: String(payload.explanation ?? "").trim(),
    is_active: payload.isActive !== false
  };

  if (payload.id) {
    const { error } = await supabase.from("questions").update(record).eq("id", payload.id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from("questions").insert(record);
  if (error) {
    throw error;
  }
}

export async function deleteQuestion(payload) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("questions").delete().eq("id", payload.id);
  if (error) {
    throw error;
  }
}

export async function importQuestions(payload) {
  const bank = await requireQuestionBank(payload.bankId);
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("沒有可匯入的題目資料。");
  }

  const rows = payload.rows.map((row) => ({
    bank_id: bank.id,
    content: String(row.content).trim(),
    option_a: String(row.option_a).trim(),
    option_b: String(row.option_b).trim(),
    option_c: String(row.option_c).trim(),
    option_d: String(row.option_d).trim(),
    correct_option: String(row.correct_option).trim().toUpperCase(),
    explanation: String(row.explanation ?? "").trim(),
    is_active: true
  }));

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("questions").insert(rows);
  if (error) {
    throw error;
  }
}

function sanitizeLeaderboard(players, mode) {
  const visible = players.filter((player) => player.is_valid);
  if (mode === "competition") {
    return visible
      .sort((left, right) => {
        if (right.total_score !== left.total_score) {
          return right.total_score - left.total_score;
        }
        return left.total_response_ms - right.total_response_ms;
      })
      .map((player) => ({
        id: player.id,
        nickname: player.nickname,
        status: player.status,
        score: player.total_score
      }));
  }

  return visible
    .sort((left, right) => {
      const leftAlive = left.status !== "eliminated";
      const rightAlive = right.status !== "eliminated";
      if (leftAlive !== rightAlive) {
        return leftAlive ? -1 : 1;
      }
      return String(left.joined_at ?? "").localeCompare(String(right.joined_at ?? ""));
    })
    .map((player) => ({
      id: player.id,
      nickname: player.nickname,
      status: player.status,
      score: player.total_score
    }));
}

export async function getPlayerSnapshot(payload) {
  const [game, player] = await Promise.all([
    fetchGameById(payload.gameId),
    fetchPlayerById(payload.playerId)
  ]);

  if (!game || !player) {
    throw new Error("找不到玩家或場次資料。");
  }

  const [players, currentAnswer, question, roundResults, roundStatuses] = await Promise.all([
    fetchVisiblePlayersForSnapshot(game),
    game.current_round > 0
      ? fetchPlayerAnswerForRound(payload.gameId, payload.playerId, game.current_round)
      : Promise.resolve(null),
    game.current_round > 0 ? fetchQuestionForRound(payload.gameId, game.current_round) : Promise.resolve(null),
    game.current_round > 0
      ? getSupabaseAdmin()
          .from("round_results")
          .select("round_no, published_at, alive_count, eliminated_count")
          .eq("game_id", payload.gameId)
          .eq("round_no", game.current_round)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    game.current_round > 0
      ? getSupabaseAdmin()
          .from("player_round_statuses")
          .select("player_id, round_no, answer_status, survived, eliminated_in_round")
          .eq("game_id", payload.gameId)
          .eq("round_no", game.current_round)
            .eq("player_id", payload.playerId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
  ]);

  const survivalVisibleCount =
      game.mode === "survival"
        ? Math.max(game.leaderboard_size || 10, Number(roundResults.data?.alive_count ?? 0))
      : game.leaderboard_size || 10;

  return {
    game: {
      id: game.id,
      title: game.title,
      mode: game.mode,
      status: game.status,
      bankId: game.bank_id,
      bankTitle: game.bank_title,
      questionCount: game.question_count,
      currentRound: game.current_round,
      competitionSeconds: game.mode === "competition" ? game.competition_seconds : null,
      survivalThreshold: game.mode === "survival" ? game.competition_seconds : null,
      leaderboardSize: game.leaderboard_size,
      startedAt: game.started_at,
      endedAt: game.ended_at
    },
    player: {
      id: player.id,
      nickname: player.nickname,
      department: player.department,
      employeeId: player.employee_id,
      status: player.status,
      score: player.total_score,
      totalMs: player.total_response_ms,
      valid: player.is_valid
    },
    question: question
      ? {
          id: question.id,
          bankId: question.bank_id,
          prompt: question.content,
          options: [question.option_a, question.option_b, question.option_c, question.option_d],
          orderNo: question.order_no,
          ...(game.status === "round_result" || game.status === "ended"
            ? {
                correctOption: question.correct_option,
                explanation: question.explanation ?? ""
              }
            : {})
        }
      : null,
    answer: currentAnswer
      ? {
          selectedOption: currentAnswer.selected_option,
          answerStatus: currentAnswer.answer_status,
          isCorrect: currentAnswer.is_correct,
          responseMs: currentAnswer.response_ms,
          score: currentAnswer.score,
          answeredAt: currentAnswer.answered_at
        }
      : null,
    leaderboard: sanitizeLeaderboard(players, game.mode).slice(0, survivalVisibleCount),
    roundResult: roundResults.data,
    playerRoundStatus: roundStatuses.data
  };
}

export async function listGames() {
  await ensureDefaultQuestionBank();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("games").select(GAME_SELECT).order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return {
    games: (data ?? []).map((row) => normalizeGameRow(row))
  };
}

export async function listPlayers(payload) {
  const players = await fetchPlayers(payload.gameId);
  return { players };
}

export async function getControlSnapshot(payload) {
  const game = await fetchGameById(payload.gameId);
  if (!game) {
    throw new Error("找不到場次。");
  }

  const [players, answers, roundResults, roundStatuses, roundStatusHistory] = await Promise.all([
    fetchPlayers(payload.gameId),
    game.current_round > 0 ? fetchAnswersForRound(payload.gameId, game.current_round) : Promise.resolve([]),
    getSupabaseAdmin()
      .from("round_results")
      .select("round_no, published_at, alive_count, eliminated_count")
      .eq("game_id", payload.gameId)
      .order("round_no", { ascending: true }),
    game.current_round > 0
      ? getSupabaseAdmin()
          .from("player_round_statuses")
          .select("player_id, round_no, answer_status, survived, eliminated_in_round")
          .eq("game_id", payload.gameId)
          .eq("round_no", game.current_round)
      : Promise.resolve({ data: [], error: null }),
    getSupabaseAdmin()
      .from("player_round_statuses")
      .select("player_id, round_no, answer_status, survived, eliminated_in_round")
      .eq("game_id", payload.gameId)
      .order("round_no", { ascending: true })
  ]);

  const question = game.current_round > 0 ? await fetchQuestionForRound(payload.gameId, game.current_round) : null;

  return {
    game,
    players,
    question,
    submittedCount: answers.length,
    roundHistory: roundResults.data ?? [],
    roundStatuses: roundStatuses.data ?? [],
    roundStatusHistory: roundStatusHistory.data ?? []
  };
}

