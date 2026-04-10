import { supabase } from "./supabase";
import {
  joinGameServer,
  readJoinStats,
  readJoinableGames,
  readPlayerState,
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
  QuestionBank,
  RoundResult
} from "../types/domain";

export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !String(import.meta.env.VITE_SUPABASE_URL).includes("placeholder");

type GameRow = {
  id: string;
  title: string;
  mode: GameMode;
  status: GameStatus;
  join_code: string;
  bank_id: string;
  bank_title?: string | null;
  question_count: number;
  current_round: number;
  competition_seconds: number | null;
  leaderboard_size: number;
  started_at: string | null;
  ended_at: string | null;
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
  bank_id: string;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
};

type QuestionBankRow = {
  id: string;
  title: string;
  description: string;
  question_count?: number;
  created_at?: string;
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

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase 尚未正確設定。");
  }
}

function mapGame(row: GameRow): LiveGame {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    bankId: row.bank_id,
    bankTitle: row.bank_title ?? undefined,
    questionCount: row.question_count,
    currentRound: row.current_round,
    status: row.status,
    joinCode: row.join_code,
    competitionSeconds: row.mode === "competition" ? row.competition_seconds : null,
    leaderboardSize: row.leaderboard_size,
    survivalThreshold: row.mode === "survival" ? row.competition_seconds : null,
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
    bankId: row.bank_id,
    prompt: row.content,
    options: [row.option_a, row.option_b, row.option_c, row.option_d],
    correctOption: row.correct_option,
    explanation: row.explanation ?? "",
    orderNo
  };
}

function mapQuestionBank(row: QuestionBankRow): QuestionBank {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questionCount: row.question_count ?? 0,
    createdAt: row.created_at
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

export async function fetchQuestionBanks() {
  const result = await runAdminAction<{ banks: QuestionBankRow[] }>("listQuestionBanks", {});
  return (result.banks ?? []).map(mapQuestionBank);
}

export async function createQuestionBankRecord(payload: { title: string; description?: string }) {
  const result = await runAdminAction<{ bank: QuestionBankRow }>("createQuestionBank", payload);
  return mapQuestionBank(result.bank);
}

export async function updateQuestionBankRecord(payload: { id: string; title: string; description?: string }) {
  await runAdminAction("updateQuestionBank", payload);
}

export async function deleteQuestionBankRecord(id: string) {
  await runAdminAction("deleteQuestionBank", { id });
}

export async function fetchGames() {
  if (hasAdminSession()) {
    const result = await runAdminAction<{ games: GameRow[] }>("listGames", {});
    return (result.games ?? []).map(mapGame);
  }

  assertConfigured();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, mode, status, join_code, question_count, current_round, competition_seconds, leaderboard_size, started_at, ended_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapGame({
      ...(row as GameRow),
      bank_id: "",
      bank_title: null
    })
  );
}

export async function fetchGameById(gameId: string) {
  const result = await runAdminAction<{ game: GameRow | null }>("getGameById", { gameId });
  return result.game ? mapGame(result.game) : null;
}

export async function fetchPlayers(gameId: string) {
  const result = await runAdminAction<{ players: PlayerRow[] }>("listPlayers", { gameId });
  return (result.players ?? []).map(mapPlayer);
}

export async function fetchQuestions(bankId?: string) {
  const result = await runAdminAction<{ questions: QuestionRow[] }>("listQuestions", bankId ? { bankId } : {});
  return (result.questions ?? []).map((question, index) => mapQuestion(question, index + 1));
}

export async function reorderQuestionsRecord(bankId: string, questionIds: string[]) {
  await runAdminAction("reorderQuestions", { bankId, questionIds });
}

export async function shuffleQuestionsRecord(bankId: string) {
  await runAdminAction("shuffleQuestions", { bankId });
}

export async function upsertQuestionRecord(payload: {
  id?: string;
  bankId: string;
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
  bankId: string,
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
  await runAdminAction("importQuestions", { bankId, rows });
}

export async function fetchQuestionForRound(gameId: string, roundNo: number) {
  const result = await runAdminAction<{ question: (QuestionRow & { order_no?: number }) | null }>(
    "getRoundQuestion",
    { gameId, roundNo }
  );
  return result.question ? mapQuestion(result.question, result.question.order_no) : null;
}

export async function fetchAnswersForRound(gameId: string, roundNo: number) {
  const result = await runAdminAction<{ answers: AnswerRow[] }>("listAnswersForRound", {
    gameId,
    roundNo
  });
  return (result.answers ?? []).map(mapAnswer);
}

export async function fetchPlayerRoundStatuses(gameId: string, roundNo: number) {
  const result = await runAdminAction<{ statuses: PlayerRoundStatusRow[] }>("listPlayerRoundStatuses", {
    gameId,
    roundNo
  });
  return (result.statuses ?? []).map(mapPlayerRoundStatus);
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

export async function fetchJoinableGames() {
  const result = await readJoinableGames();
  return (result.games ?? []).map((row) =>
    mapGame({
      id: String(row.id),
      title: String(row.title),
      mode: row.mode as GameMode,
      status: row.status as GameStatus,
      join_code: String(row.joinCode),
      bank_id: String(row.bankId ?? ""),
      bank_title: row.bankTitle ? String(row.bankTitle) : null,
      question_count: Number(row.questionCount ?? 0),
      current_round: Number(row.currentRound ?? 0),
      competition_seconds: row.competitionSeconds ? Number(row.competitionSeconds) : null,
      leaderboard_size: Number(row.leaderboardSize ?? 10),
      started_at: row.startedAt ? String(row.startedAt) : null,
      ended_at: row.endedAt ? String(row.endedAt) : null
    })
  );
}

export async function fetchAdminControlSnapshot(gameId: string) {
  const result = await runAdminAction<{
    game: GameRow | null;
    players: PlayerRow[];
    question: (QuestionRow & { order_no?: number }) | null;
    submittedCount: number;
    roundHistory: RoundResultRow[];
    roundStatuses: PlayerRoundStatusRow[];
    roundStatusHistory: PlayerRoundStatusRow[];
  }>("getControlSnapshot", { gameId });

  return {
    game: result.game ? mapGame(result.game) : null,
    players: (result.players ?? []).map(mapPlayer),
    question: result.question ? mapQuestion(result.question, result.question.order_no) : null,
    submittedCount: result.submittedCount ?? 0,
    roundHistory: (result.roundHistory ?? []).map(mapRoundResult),
    roundStatuses: (result.roundStatuses ?? []).map(mapPlayerRoundStatus),
    roundStatusHistory: (result.roundStatusHistory ?? []).map(mapPlayerRoundStatus)
  };
}

export async function fetchAdminControlStatus(gameId: string) {
  const result = await runAdminAction<{
    game: {
      id: string;
      status: GameStatus;
      currentRound: number;
      mode: GameMode;
    };
    submittedCount: number;
  }>("getControlStatus", { gameId });

  return {
    game: result.game,
    submittedCount: result.submittedCount ?? 0
  };
}

export async function createGameRecord(payload: {
  title: string;
  mode: GameMode;
  bankId: string;
  questionCount: number;
  joinCode: string;
  competitionSeconds?: number;
  leaderboardSize: number;
  survivalThreshold?: number;
}) {
  const result = await runAdminAction<{ game: GameRow | null }>("createGame", payload);
  if (!result.game) {
    throw new Error("建立場次失敗。");
  }
  return mapGame(result.game);
}

export async function updateGameRecord(payload: {
  gameId: string;
  title: string;
  mode: GameMode;
  bankId: string;
  questionCount: number;
  joinCode: string;
  competitionSeconds?: number;
  leaderboardSize: number;
  survivalThreshold?: number;
}) {
  const result = await runAdminAction<{ game: GameRow | null }>("updateGame", payload);
  return result.game ? mapGame(result.game) : null;
}

export async function deleteGameRecord(gameId: string) {
  await runAdminAction("deleteGame", { gameId });
}

export async function openRegistrationRecord(gameId: string) {
  await runAdminAction("openRegistration", { gameId });
}

export async function resetGameRecord(gameId: string) {
  await runAdminAction("resetGame", { gameId });
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

export async function joinGameRecord(params: {
  joinCode: string;
  nickname: string;
  department: string;
  employeeId: string;
}) {
  const result = await joinGameServer(params);
  if (!result.game || !result.player) {
    throw new Error("加入場次失敗。");
  }
  return {
    game: mapGame(result.game as GameRow),
    player: mapPlayer(result.player as PlayerRow)
  };
}

export async function updatePlayerRecord(
  gameId: string,
  playerId: string,
  payload: {
    nickname: string;
    department: string;
    employeeId: string;
  }
) {
  await runAdminAction("updatePlayer", { gameId, playerId, ...payload });
}

export async function togglePlayerValidityRecord(playerId: string, valid: boolean) {
  await runAdminAction("togglePlayerValidity", { playerId, valid });
}

export async function deletePlayerRecord(playerId: string) {
  await runAdminAction("deletePlayer", { playerId });
}

export async function deletePlayersRecord(playerIds: string[]) {
  await runAdminAction("deletePlayers", { playerIds });
}

export async function submitAnswerRecord(params: {
  gameId: string;
  playerId: string;
  selectedOption: "A" | "B" | "C" | "D";
  answeredAt: string;
}) {
  await submitAnswerServer(params);
}

export async function resolveCurrentRoundRecord(gameId: string) {
  await runAdminAction("resolveRound", { gameId });
}

export function subscribeToGameRealtime(gameId: string, onChange: () => void, playerId?: string) {
  const channel = supabase
    .channel(playerId ? `game-${gameId}-player-${playerId}` : `game-${gameId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, onChange)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "round_results", filter: `game_id=eq.${gameId}` },
      onChange
    );

  if (playerId) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_round_statuses", filter: `player_id=eq.${playerId}` },
      onChange
    );
  }

  channel.subscribe();

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
          bankId: result.game.bankId ?? "",
          bankTitle: result.game.bankTitle ?? "",
          questionCount: result.game.questionCount,
          currentRound: result.game.currentRound,
          competitionSeconds: result.game.competitionSeconds,
          leaderboardSize: result.game.leaderboardSize,
          survivalThreshold: result.game.survivalThreshold,
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
          bankId: result.question.bankId ?? "",
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
          isCorrect:
            typeof result.answer.isCorrect === "boolean"
              ? result.answer.isCorrect
              : result.answer.answerStatus === "correct",
          responseMs:
            result.answer.responseMs === null || result.answer.responseMs === undefined
              ? null
              : Number(result.answer.responseMs),
          score: Number(result.answer.score ?? 0),
          answeredAt: result.answer.answeredAt ?? null
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
          eliminatedCount: Number(result.roundResult.eliminated_count ?? result.roundResult.eliminatedCount ?? 0)
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

export async function fetchPlayerState(gameId: string, playerId: string) {
  const result = await readPlayerState({ gameId, playerId });

  return {
    game: {
      id: String(result.game.id),
      status: result.game.status as GameStatus,
      currentRound: Number(result.game.currentRound ?? 0),
      mode: result.game.mode as GameMode
    },
    player: {
      id: String(result.player.id),
      status: result.player.status as PlayerStatus,
      valid: Boolean(result.player.valid)
    }
  };
}

