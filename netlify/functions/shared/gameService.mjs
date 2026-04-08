import { getSupabaseAdmin } from "./supabaseAdmin.mjs";

const DEFAULT_COMPETITION_SECONDS = 10;

function computeCompetitionScore(responseMs, competitionSeconds) {
  const durationMs = Math.max(competitionSeconds, 1) * 1000;
  const clamped = Math.min(Math.max(responseMs, 0), durationMs);
  const remainingRatio = (durationMs - clamped) / durationMs;
  return Math.round(10 + 90 * remainingRatio);
}

export async function fetchGameById(gameId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, mode, status, question_count, current_round, join_code, competition_seconds, leaderboard_size, started_at, ended_at")
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchGameByJoinCode(joinCode) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, mode, status, question_count, current_round, join_code, competition_seconds, leaderboard_size, started_at, ended_at")
    .eq("join_code", String(joinCode).trim().toUpperCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
    .select("id, content, option_a, option_b, option_c, option_d, correct_option, explanation")
    .eq("id", mapping.question_id)
    .single();

  if (error) {
    throw error;
  }

  return { ...data, order_no: mapping.order_no };
}

export async function listQuestions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("questions")
    .select("id, content, option_a, option_b, option_c, option_d, correct_option, explanation, is_active")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return { questions: data ?? [] };
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
    .select(
      "id, title, mode, status, question_count, current_round, join_code, competition_seconds, leaderboard_size, started_at, ended_at, created_at"
    )
    .in("status", ["draft", "registering"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return {
    games:
      (data ?? []).map((game) => ({
        id: game.id,
        title: game.title,
        mode: game.mode,
        status: game.status,
        questionCount: game.question_count,
        currentRound: game.current_round,
        joinCode: game.join_code,
        competitionSeconds: game.competition_seconds,
        leaderboardSize: game.leaderboard_size,
        startedAt: game.started_at,
        endedAt: game.ended_at
      })) ?? []
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

export async function listAnswersForRound(payload) {
  return {
    answers: await fetchAnswersForRound(payload.gameId, payload.roundNo)
  };
}

export async function listPlayerRoundStatuses(payload) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("player_round_statuses")
    .select("player_id, round_no, answer_status, survived, eliminated_in_round")
    .eq("game_id", payload.gameId)
    .eq("round_no", payload.roundNo);

  if (error) {
    throw error;
  }

  return { statuses: data ?? [] };
}

export async function joinGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameByJoinCode(payload.joinCode);

  if (!game) {
    throw new Error("找不到對應的場次代碼。");
  }

  if (game.status !== "draft" && game.status !== "registering") {
    throw new Error("本場次已開始或已結束，現在不能加入。");
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", game.id)
    .eq("employee_id", String(payload.employeeId).trim())
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    throw new Error("此員編已在本場次報名。");
  }

  const { data, error } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      nickname: String(payload.nickname).trim(),
      department: String(payload.department).trim(),
      employee_id: String(payload.employeeId).trim(),
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
    game: {
      id: game.id,
      title: game.title,
      mode: game.mode,
      status: game.status,
      question_count: game.question_count,
      current_round: game.current_round,
      join_code: game.join_code,
      competition_seconds: game.competition_seconds,
      leaderboard_size: game.leaderboard_size,
      started_at: game.started_at,
      ended_at: game.ended_at
    },
    player: data
  };
}

export async function createGame(payload) {
  const supabase = getSupabaseAdmin();
  const { data: existingCode, error: existingError } = await supabase
    .from("games")
    .select("id")
    .eq("join_code", String(payload.joinCode).trim().toUpperCase())
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingCode) {
    throw new Error("場次代碼已存在，請換一組。");
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      title: String(payload.title).trim(),
      mode: payload.mode,
      question_count: Number(payload.questionCount),
      join_code: String(payload.joinCode).trim().toUpperCase(),
      leaderboard_size: Number(payload.leaderboardSize || 10),
      competition_seconds: DEFAULT_COMPETITION_SECONDS,
      status: "draft",
      current_round: 0
    })
    .select(
      "id, title, mode, status, question_count, current_round, join_code, competition_seconds, leaderboard_size, started_at, ended_at"
    )
    .single();

  if (error) {
    throw error;
  }

  const { data: questions, error: questionError } = await supabase
    .from("questions")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(Number(payload.questionCount));

  if (questionError) {
    throw questionError;
  }

  if ((questions ?? []).length > 0) {
    const mappings = questions.map((question, index) => ({
      game_id: data.id,
      question_id: question.id,
      order_no: index + 1
    }));
    const { error: mappingError } = await supabase.from("game_questions").insert(mappings);
    if (mappingError) {
      throw mappingError;
    }
  }

  return { game: data };
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

  const { data: duplicate, error: duplicateError } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", currentPlayer.game_id)
    .eq("employee_id", String(payload.employeeId).trim())
    .neq("id", payload.playerId)
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    throw new Error("修改後的員編會和同場其他玩家重複。");
  }

  const { error } = await supabase
    .from("players")
    .update({
      nickname: String(payload.nickname).trim(),
      department: String(payload.department).trim(),
      employee_id: String(payload.employeeId).trim()
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
    targetPlayers.map((player) =>
      supabase.from("players").update({ status: "active" }).eq("id", player.id)
    )
  );
}

export async function startGame(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  if (!game) {
    throw new Error("找不到場次。");
  }

  const nextRound = game.current_round > 0 ? game.current_round : 1;
  const { error } = await supabase
    .from("games")
    .update({
      status: "live_question",
      current_round: nextRound,
      started_at: new Date().toISOString(),
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

  if (game.current_round >= game.question_count) {
    await endGame(payload);
    return;
  }

  const { error } = await supabase
    .from("games")
    .update({
      status: "live_question",
      current_round: game.current_round + 1,
      started_at: new Date().toISOString()
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

export async function submitAnswer(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  const player = await fetchPlayerById(payload.playerId);

  if (!game || game.status !== "live_question" || !player || !player.is_valid) {
    throw new Error("目前不在可作答狀態。");
  }

  if (game.mode === "survival" && player.status === "eliminated") {
    throw new Error("你已被淘汰，不能繼續作答。");
  }

  const question = await fetchQuestionForRound(payload.gameId, game.current_round);
  if (!question) {
    throw new Error("目前找不到題目。");
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
    throw new Error("本題已送出，請等待主持人公布。");
  }

  if (game.mode === "competition" && game.started_at && game.competition_seconds) {
    const startedAtMs = new Date(game.started_at).getTime();
    if (Date.now() > startedAtMs + game.competition_seconds * 1000) {
      throw new Error("本題作答時間已結束。");
    }
  }

  const { error } = await supabase.from("answers").insert({
    game_id: payload.gameId,
    question_id: question.id,
    player_id: payload.playerId,
    round_no: game.current_round,
    selected_option: payload.selectedOption,
    answered_at: new Date().toISOString()
  });

  if (error) {
    throw error;
  }

  const { error: playerError } = await supabase
    .from("players")
    .update({ status: "submitted" })
    .eq("id", payload.playerId);

  if (playerError) {
    throw playerError;
  }
}

export async function resolveRound(payload) {
  const supabase = getSupabaseAdmin();
  const game = await fetchGameById(payload.gameId);
  if (!game || game.current_round <= 0) {
    throw new Error("目前沒有可公布的回合。");
  }

  const question = await fetchQuestionForRound(payload.gameId, game.current_round);
  if (!question) {
    throw new Error("目前找不到題目。");
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

    const { error: playerUpdateError } = await supabase
      .from("players")
      .update({
        status: nextStatus,
        total_score: nextTotalScore,
        total_response_ms: nextTotalResponseMs
      })
      .eq("id", player.id);

    if (playerUpdateError) {
      throw playerUpdateError;
    }
  }

  if (answerUpserts.length > 0) {
    const { error } = await supabase.from("answers").upsert(answerUpserts, {
      onConflict: "question_id,player_id"
    });
    if (error) {
      throw error;
    }
  }

  if (roundStatusUpserts.length > 0) {
    const { error } = await supabase.from("player_round_statuses").upsert(roundStatusUpserts, {
      onConflict: "question_id,player_id"
    });
    if (error) {
      throw error;
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

  if (game.mode === "survival" && aliveCount <= (game.leaderboard_size || 10)) {
    await endGame({ gameId: payload.gameId });
    return;
  }

  const { error: gameError } = await supabase
    .from("games")
    .update({ status: "round_result" })
    .eq("id", payload.gameId);

  if (gameError) {
    throw gameError;
  }
}

export async function upsertQuestion(payload) {
  const supabase = getSupabaseAdmin();
  const record = {
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
  const supabase = getSupabaseAdmin();
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("沒有可匯入的題目資料。");
  }

  const rows = payload.rows.map((row) => ({
    content: String(row.content).trim(),
    option_a: String(row.option_a).trim(),
    option_b: String(row.option_b).trim(),
    option_c: String(row.option_c).trim(),
    option_d: String(row.option_d).trim(),
    correct_option: String(row.correct_option).trim().toUpperCase(),
    explanation: String(row.explanation ?? "").trim(),
    is_active: true
  }));

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
  const game = await fetchGameById(payload.gameId);
  const player = await fetchPlayerById(payload.playerId);

  if (!game || !player) {
    throw new Error("找不到場次或玩家。");
  }

  const [players, answers, roundResults, roundStatuses] = await Promise.all([
    fetchPlayers(payload.gameId),
    game.current_round > 0 ? fetchAnswersForRound(payload.gameId, game.current_round) : Promise.resolve([]),
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

  const question =
    game.current_round > 0 ? await fetchQuestionForRound(payload.gameId, game.current_round) : null;
  const currentAnswer = answers.find((answer) => answer.player_id === payload.playerId) ?? null;

  return {
    game: {
      id: game.id,
      title: game.title,
      mode: game.mode,
      status: game.status,
      questionCount: game.question_count,
      currentRound: game.current_round,
      competitionSeconds: game.competition_seconds,
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
          score: currentAnswer.score
        }
      : null,
    leaderboard: sanitizeLeaderboard(players, game.mode).slice(0, game.leaderboard_size || 10),
    roundResult: roundResults.data,
    playerRoundStatus: roundStatuses.data
  };
}

export async function listGames() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, mode, status, question_count, current_round, join_code, competition_seconds, leaderboard_size, started_at, ended_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return { games: data ?? [] };
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

  const [players, answers, roundResults] = await Promise.all([
    fetchPlayers(payload.gameId),
    game.current_round > 0 ? fetchAnswersForRound(payload.gameId, game.current_round) : Promise.resolve([]),
    getSupabaseAdmin()
      .from("round_results")
      .select("round_no, published_at, alive_count, eliminated_count")
      .eq("game_id", payload.gameId)
      .order("round_no", { ascending: true }),
  ]);

  const question = game.current_round > 0 ? await fetchQuestionForRound(payload.gameId, game.current_round) : null;

  return {
    game,
    players,
    question,
    submittedCount: answers.length,
    roundHistory: roundResults.data ?? []
  };
}
