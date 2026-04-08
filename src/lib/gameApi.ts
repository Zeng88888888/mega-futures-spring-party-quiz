import { supabase } from "./supabase";
import {
  joinGameServer,
  readJoinStats,
  readPlayerSnapshot,
  runAdminAction,
  submitAnswerServer
} from "./serverApi";
import { hasAdminSession } from "./adminSession";
import type {
  AnswerStatus,
  GameMode,
  GameStatus,
  LiveGame,
  Player,
  PlayerAnswer,
  PlayerRoundStatus,
  PlayerStatus,
  Question,
  RoundResult
} from "../types/domain";

export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !String(import.meta.env.VITE_SUPABASE_URL).includes("placeholder");

const DEFAULT_COMPETITION_SECONDS = 10;
const DEFAULT_LEADERBOARD_SIZE = 10;
const DEFAULT_JOIN_CODE = "MEGA2026";

type GameRow = {
  id: string;
  title: string;
  mode: GameMode;
  status: GameStatus;
  question_count: number;
  current_round: number;
  join_code: string;
  competition_seconds: number | null;
  leaderboard_size: number;
  started_at: string | null;
  ended_at: string | null;
  created_at?: string;
};

type PlayerRow = {
  id: string;
  nickname: string;
  department: string;
  employee_id: string;
  status: PlayerStatus;
  total_score: number;
  total_response_ms: number;
  is_valid: boolean;
  joined_at?: string;
};

type QuestionRow = {
  id: string;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
};

type AnswerRow = {
  player_id: string;
  question_id: string;
  round_no: number;
  selected_option: "A" | "B" | "C" | "D" | null;
  answer_status: AnswerStatus;
  is_correct: boolean;
  response_ms: number | null;
  score: number;
  answered_at: string | null;
};

type RoundResultRow = {
  round_no: number;
  published_at: string | null;
  alive_count: number | null;
  eliminated_count: number | null;
};

type PlayerRoundStatusRow = {
  player_id: string;
  round_no: number;
  answer_status: AnswerStatus;
  survived: boolean;
  eliminated_in_round: boolean;
};

type GameQuestionRow = {
  question_id: string;
  order_no: number;
};

const seededQuestionBank = [
  {
    content: "下列哪一項最符合兆豐期貨春酒競賽系統中的玩家唯一識別欄位？",
    option_a: "暱稱",
    option_b: "部門",
    option_c: "員編",
    option_d: "手機號碼",
    correct_option: "C" as const,
    explanation: "同一場次以員編作為唯一識別，避免重複報名與排行錯誤。"
  },
  {
    content: "淘汰賽中玩家送出答案後，系統應立即顯示 still alive 嗎？",
    option_a: "要，讓玩家安心",
    option_b: "不要，避免隔壁偷看",
    option_c: "只顯示給主持人",
    option_d: "只顯示給前十名",
    correct_option: "B" as const,
    explanation: "淘汰賽送出後只顯示等待公布，主持人公布結果後才統一揭曉。"
  },
  {
    content: "競賽模式中，每題預設作答時間為幾秒？",
    option_a: "5 秒",
    option_b: "8 秒",
    option_c: "10 秒",
    option_d: "15 秒",
    correct_option: "C" as const,
    explanation: "目前規格為競賽模式每題限時 10 秒。"
  },
  {
    content: "競賽模式中，答錯一題會如何計分？",
    option_a: "倒扣 10 分",
    option_b: "0 分",
    option_c: "保底 10 分",
    option_d: "扣除總秒數",
    correct_option: "B" as const,
    explanation: "競賽模式答錯為 0 分，不倒扣。"
  },
  {
    content: "淘汰賽中，未作答的玩家會如何處理？",
    option_a: "保留到下一輪",
    option_b: "0 分但不淘汰",
    option_c: "直接淘汰",
    option_d: "主持人手動決定",
    correct_option: "C" as const,
    explanation: "淘汰賽規則是未作答視為淘汰。"
  },
  {
    content: "競賽模式排行榜的主要排序依據是什麼？",
    option_a: "部門",
    option_b: "總分",
    option_c: "最晚加入時間",
    option_d: "員編大小",
    correct_option: "B" as const,
    explanation: "競賽模式先比總分，同分再比總作答時間。"
  },
  {
    content: "被主持人標記為無效的玩家，是否還會列入排行榜？",
    option_a: "會",
    option_b: "只在最終榜單出現",
    option_c: "不會",
    option_d: "只在淘汰賽會出現",
    correct_option: "C" as const,
    explanation: "無效玩家會完全排除於排行榜、淘汰統計與得獎名單。"
  },
  {
    content: "淘汰賽會在什麼條件下直接結束？",
    option_a: "主持人手動停止",
    option_b: "剩餘玩家小於或等於 10 人",
    option_c: "答完第 5 題",
    option_d: "每人至少淘汰一次",
    correct_option: "B" as const,
    explanation: "淘汰賽當剩餘有效存活玩家小於或等於 10 人時直接結束。"
  },
  {
    content: "主持人公布結果後，淘汰賽答對的玩家會看到什麼？",
    option_a: "恭喜得分 100",
    option_b: "still alive",
    option_c: "下一題開始",
    option_d: "排名第幾名",
    correct_option: "B" as const,
    explanation: "淘汰賽揭曉後，答對玩家顯示 still alive。"
  },
  {
    content: "競賽模式中，越快答對的玩家會有什麼效果？",
    option_a: "分數越高",
    option_b: "題目越少",
    option_c: "部門加分",
    option_d: "直接進前十",
    correct_option: "A" as const,
    explanation: "競賽模式採速度加分，越快答對越接近 100 分。"
  }
];

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase 尚未設定完成。");
  }
}

function mapGame(row: GameRow): LiveGame {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    questionCount: row.question_count,
    currentRound: row.current_round,
    status: row.status,
    joinCode: row.join_code,
    competitionSeconds: row.competition_seconds,
    leaderboardSize: row.leaderboard_size,
    startedAt: row.started_at,
    endedAt: row.ended_at
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    nickname: row.nickname,
    department: row.department,
    employeeId: row.employee_id,
    status: row.status,
    score: row.total_score,
    totalMs: row.total_response_ms,
    valid: row.is_valid,
    joinedAt: row.joined_at
  };
}

function mapQuestion(row: QuestionRow, orderNo?: number): Question {
  return {
    id: row.id,
    prompt: row.content,
    options: [row.option_a, row.option_b, row.option_c, row.option_d],
    correctOption: row.correct_option,
    explanation: row.explanation ?? "",
    orderNo
  };
}

function mapAnswer(row: AnswerRow): PlayerAnswer {
  return {
    playerId: row.player_id,
    questionId: row.question_id,
    roundNo: row.round_no,
    selectedOption: row.selected_option ?? undefined,
    answerStatus: row.answer_status,
    isCorrect: row.is_correct,
    responseMs: row.response_ms,
    score: row.score,
    answeredAt: row.answered_at
  };
}

function mapRoundResult(row: RoundResultRow): RoundResult {
  return {
    roundNo: row.round_no,
    publishedAt: row.published_at,
    aliveCount: row.alive_count,
    eliminatedCount: row.eliminated_count
  };
}

function mapPlayerRoundStatus(row: PlayerRoundStatusRow): PlayerRoundStatus {
  return {
    playerId: row.player_id,
    roundNo: row.round_no,
    answerStatus: row.answer_status,
    survived: row.survived,
    eliminatedInRound: row.eliminated_in_round
  };
}

function computeCompetitionScore(responseMs: number, competitionSeconds: number) {
  const durationMs = Math.max(competitionSeconds, 1) * 1000;
  const clamped = Math.min(Math.max(responseMs, 0), durationMs);
  const remainingRatio = (durationMs - clamped) / durationMs;
  return Math.round(10 + 90 * remainingRatio);
}

async function fetchGameQuestionMappings(gameId: string) {
  const { data, error } = await supabase
    .from("game_questions")
    .select("question_id, order_no")
    .eq("game_id", gameId)
    .order("order_no", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as GameQuestionRow[];
}

export async function fetchGames() {
  if (hasAdminSession()) {
    const result = await runAdminAction<{ games: GameRow[] }>("listGames", {});
    return (result.games ?? []).map((row) => mapGame(row));
  }

  assertConfigured();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, mode, status, question_count, current_round, join_code, competition_seconds, leaderboard_size, started_at, ended_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapGame(row as GameRow));
}

export async function fetchGameById(gameId: string) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取場次內容。");
  }

  const result = await runAdminAction<{ game: GameRow | null }>("getGameById", { gameId });
  return result.game ? mapGame(result.game) : null;
}

export async function fetchGameByJoinCode(joinCode: string) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能查詢場次代碼。");
  }

  const result = await runAdminAction<{ game: GameRow | null }>("getGameByJoinCode", { joinCode });
  return result.game ? mapGame(result.game) : null;
}

export async function fetchPlayers(gameId: string) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取完整玩家名單。");
  }

  const result = await runAdminAction<{ players: PlayerRow[] }>("listPlayers", { gameId });
  return (result.players ?? []).map((row) => mapPlayer(row));
}

export async function fetchPlayerById(playerId: string) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取玩家資料。");
  }

  const result = await runAdminAction<{ player: PlayerRow | null }>("getPlayerById", { playerId });
  return result.player ? mapPlayer(result.player) : null;
}

export async function fetchQuestions() {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取完整題庫。");
  }

  const result = await runAdminAction<{ questions: QuestionRow[] }>("listQuestions", {});
  return (result.questions ?? []).map((row) => mapQuestion(row));
}

export async function upsertQuestionRecord(payload: {
  id?: string;
  content: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  isActive?: boolean;
}) {
  await runAdminAction("upsertQuestion", payload);
}

export async function deleteQuestionRecord(id: string) {
  await runAdminAction("deleteQuestion", { id });
}

export async function importQuestionsRecord(
  rows: Array<{
    content: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation: string;
  }>
) {
  await runAdminAction("importQuestions", { rows });
}

export async function ensureSeedQuestions() {
  const existing = await fetchQuestions();
  const existingPrompts = new Set(existing.map((question) => question.prompt));
  const missing = seededQuestionBank.filter((question) => !existingPrompts.has(question.content));

  if (missing.length > 0) {
    await importQuestionsRecord(
      missing.map((question) => ({
        content: question.content,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        explanation: question.explanation
      }))
    );
  }

  return fetchQuestions();
}

export async function ensureDefaultGame() {
  await ensureSeedQuestions();
  const existing = (await fetchGames()).find((game) => game.joinCode === DEFAULT_JOIN_CODE) ?? null;
  if (existing) {
    return existing;
  }

  return createGameRecord({
    title: "兆豐期貨春酒搶答賽",
    mode: "competition",
    questionCount: 10,
    joinCode: DEFAULT_JOIN_CODE,
    leaderboardSize: DEFAULT_LEADERBOARD_SIZE
  });
}

export async function ensureGameQuestions(gameId: string, requestedCount: number) {
  assertConfigured();
  const existingMappings = await fetchGameQuestionMappings(gameId);
  if (existingMappings.length >= requestedCount) {
    return existingMappings.slice(0, requestedCount);
  }

  const questions = await ensureSeedQuestions();
  const targetQuestions = questions.slice(0, Math.min(requestedCount, questions.length));
  const existingIds = new Set(existingMappings.map((mapping) => mapping.question_id));

  const inserts = targetQuestions
    .filter((question) => !existingIds.has(question.id))
    .map((question, index) => ({
      game_id: gameId,
      question_id: question.id,
      order_no: existingMappings.length + index + 1
    }));

  if (inserts.length > 0) {
    const { error } = await supabase.from("game_questions").insert(inserts);
    if (error) {
      throw error;
    }
  }

  return fetchGameQuestionMappings(gameId);
}

export async function fetchQuestionForRound(gameId: string, roundNo: number) {
  const result = await runAdminAction<{ question: QuestionRow & { order_no?: number } | null }>(
    "getRoundQuestion",
    { gameId, roundNo }
  );
  return result.question ? mapQuestion(result.question, result.question.order_no) : null;
}

export async function fetchAnswersForRound(gameId: string, roundNo: number) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取作答紀錄。");
  }

  const result = await runAdminAction<{ answers: AnswerRow[] }>("listAnswersForRound", {
    gameId,
    roundNo
  });
  return (result.answers ?? []).map((row) => mapAnswer(row));
}

export async function fetchCurrentPlayerAnswer(gameId: string, playerId: string, roundNo: number) {
  assertConfigured();
  const answers = await fetchAnswersForRound(gameId, roundNo);
  return answers.find((answer) => answer.playerId === playerId) ?? null;
}

export async function fetchRoundResults(gameId: string) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取回合紀錄。");
  }

  const result = await runAdminAction<{ roundHistory: RoundResultRow[] }>("getControlSnapshot", { gameId });
  return (result.roundHistory ?? []).map((row) => mapRoundResult(row));
}

export async function fetchPlayerRoundStatuses(gameId: string, roundNo: number) {
  if (!hasAdminSession()) {
    throw new Error("需要主持人登入後才能讀取玩家回合狀態。");
  }

  const result = await runAdminAction<{ statuses: PlayerRoundStatusRow[] }>(
    "listPlayerRoundStatuses",
    { gameId, roundNo }
  );
  return (result.statuses ?? []).map((row) => mapPlayerRoundStatus(row));
}

export async function fetchLeaderboard(gameId: string, mode: GameMode) {
  const players = await fetchPlayers(gameId);
  const visible = players.filter((player) => player.valid);

  if (mode === "competition") {
    return visible.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (left.totalMs ?? 0) - (right.totalMs ?? 0);
    });
  }

  return visible.sort((left, right) => {
    const leftAlive = left.status !== "eliminated";
    const rightAlive = right.status !== "eliminated";
    if (leftAlive !== rightAlive) {
      return leftAlive ? -1 : 1;
    }
    return (left.joinedAt ?? "").localeCompare(right.joinedAt ?? "");
  });
}

export async function fetchJoinStats(joinCode: string) {
  return readJoinStats(joinCode);
}

export async function fetchAdminControlSnapshot(gameId: string) {
  const result = await runAdminAction<{
    game: GameRow | null;
    players: PlayerRow[];
    question: (QuestionRow & { order_no?: number }) | null;
    submittedCount: number;
    roundHistory: RoundResultRow[];
  }>("getControlSnapshot", { gameId });

  return {
    game: result.game ? mapGame(result.game) : null,
    players: (result.players ?? []).map((row) => mapPlayer(row)),
    question: result.question ? mapQuestion(result.question, result.question.order_no) : null,
    submittedCount: result.submittedCount ?? 0,
    roundHistory: (result.roundHistory ?? []).map((row) => mapRoundResult(row))
  };
}

export async function createGameRecord(payload: {
  title: string;
  mode: GameMode;
  questionCount: number;
  joinCode: string;
  leaderboardSize: number;
}) {
  const result = await runAdminAction<{ game: GameRow | null }>("createGame", payload);
  if (!result.game) {
    throw new Error("場次建立後無法讀取。");
  }
  return mapGame(result.game);
}

export async function openRegistrationRecord(gameId: string) {
  await runAdminAction("openRegistration", { gameId });
}

export async function startGameRecord(gameId: string) {
  await runAdminAction("startGame", { gameId });
}

export async function startNextRoundRecord(gameId: string) {
  await runAdminAction("startNextRound", { gameId });
}

export async function endGameRecord(gameId: string) {
  await runAdminAction("endGame", { gameId });
}

export async function setGameStatusRecord(gameId: string, status: GameStatus) {
  if (status === "registering") {
    return openRegistrationRecord(gameId);
  }
  if (status === "live_question") {
    return startGameRecord(gameId);
  }
  if (status === "ended") {
    return endGameRecord(gameId);
  }

  const { error } = await supabase.from("games").update({ status }).eq("id", gameId);
  if (error) {
    throw error;
  }
}

export async function joinGameRecord(params: {
  joinCode: string;
  nickname: string;
  department: string;
  employeeId: string;
}) {
  const result = await joinGameServer(params);
  if (!result.game || !result.player) {
    throw new Error("加入場次後無法讀取玩家資料。");
  }
  return {
    game: mapGame(result.game as GameRow),
    player: mapPlayer(result.player as PlayerRow)
  };
}

export async function updatePlayerRecord(gameId: string, playerId: string, payload: {
  nickname: string;
  department: string;
  employeeId: string;
}) {
  await runAdminAction("updatePlayer", { gameId, playerId, ...payload });
}

export async function togglePlayerValidityRecord(playerId: string, valid: boolean) {
  await runAdminAction("togglePlayerValidity", { playerId, valid });
}

export async function submitAnswerRecord(params: {
  gameId: string;
  playerId: string;
  selectedOption: "A" | "B" | "C" | "D";
}) {
  await submitAnswerServer(params);
}

export async function resolveCurrentRoundRecord(gameId: string) {
  await runAdminAction("resolveRound", { gameId });
}

export function subscribeToGameRealtime(gameId: string, onChange: () => void) {
  const channel = supabase
    .channel(`game-${gameId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function fetchPlayerSnapshot(gameId: string, playerId: string) {
  const result = await readPlayerSnapshot({ gameId, playerId });

  return {
    game: result.game
      ? ({
          id: result.game.id,
          title: result.game.title,
          mode: result.game.mode,
          status: result.game.status,
          questionCount: result.game.questionCount,
          currentRound: result.game.currentRound,
          competitionSeconds: result.game.competitionSeconds,
          leaderboardSize: result.game.leaderboardSize,
          startedAt: result.game.startedAt,
          endedAt: result.game.endedAt,
          joinCode: ""
        } as LiveGame)
      : null,
    player: result.player
      ? ({
          id: result.player.id,
          nickname: result.player.nickname,
          department: result.player.department,
          employeeId: result.player.employeeId,
          status: result.player.status,
          score: result.player.score,
          totalMs: result.player.totalMs,
          valid: result.player.valid
        } as Player)
      : null,
    question: result.question
      ? ({
          id: result.question.id,
          prompt: result.question.prompt,
          options: result.question.options,
          orderNo: result.question.orderNo,
          correctOption: result.question.correctOption,
          explanation: result.question.explanation ?? ""
        } as Question)
      : null,
    answer: result.answer
      ? ({
          playerId,
          questionId: result.question?.id ?? "",
          roundNo: Number(result.game.currentRound ?? 0),
          selectedOption: result.answer.selectedOption,
          answerStatus: result.answer.answerStatus,
          isCorrect: result.answer.answerStatus === "correct",
          score: Number(result.answer.score ?? 0)
        } as PlayerAnswer)
      : null,
    leaderboard: (result.leaderboard ?? []).map(
      (entry) =>
        ({
          id: String(entry.id),
          nickname: String(entry.nickname),
          department: "",
          employeeId: "",
          status: entry.status as PlayerStatus,
          score: Number(entry.score ?? 0),
          valid: true
        }) as Player
    ),
    roundResult: result.roundResult
      ? ({
          roundNo: Number(result.roundResult.round_no ?? result.roundResult.roundNo ?? 0),
          publishedAt: String(result.roundResult.published_at ?? result.roundResult.publishedAt ?? ""),
          aliveCount: Number(result.roundResult.alive_count ?? result.roundResult.aliveCount ?? 0),
          eliminatedCount: Number(
            result.roundResult.eliminated_count ?? result.roundResult.eliminatedCount ?? 0
          )
        } as RoundResult)
      : null,
    playerRoundStatus: result.playerRoundStatus
      ? ({
          playerId: String(result.playerRoundStatus.player_id ?? result.playerRoundStatus.playerId ?? playerId),
          roundNo: Number(result.playerRoundStatus.round_no ?? result.playerRoundStatus.roundNo ?? 0),
          answerStatus: result.playerRoundStatus.answer_status ?? result.playerRoundStatus.answerStatus,
          survived: Boolean(result.playerRoundStatus.survived),
          eliminatedInRound: Boolean(
            result.playerRoundStatus.eliminated_in_round ?? result.playerRoundStatus.eliminatedInRound
          )
        } as PlayerRoundStatus)
      : null
  };
}
