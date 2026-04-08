export type GameMode = "competition" | "survival";
export type GameStatus =
  | "draft"
  | "registering"
  | "live_question"
  | "round_result"
  | "ended";

export type AnswerStatus = "correct" | "wrong" | "no_answer";

export type PlayerStatus =
  | "waiting"
  | "active"
  | "submitted"
  | "eliminated"
  | "finished"
  | "invalid";

export interface Player {
  id: string;
  nickname: string;
  department: string;
  employeeId: string;
  status: PlayerStatus;
  score: number;
  totalMs?: number;
  aliveRound?: number;
  valid: boolean;
  joinedAt?: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  orderNo?: number;
}

export interface LiveGame {
  id: string;
  title: string;
  mode: GameMode;
  questionCount: number;
  currentRound: number;
  status: GameStatus;
  joinCode: string;
  competitionSeconds?: number | null;
  leaderboardSize: number;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface PlayerAnswer {
  playerId: string;
  questionId: string;
  roundNo: number;
  selectedOption?: "A" | "B" | "C" | "D";
  answerStatus: AnswerStatus;
  isCorrect: boolean;
  responseMs?: number | null;
  score: number;
  answeredAt?: string | null;
}

export interface RoundResult {
  roundNo: number;
  publishedAt?: string | null;
  aliveCount?: number | null;
  eliminatedCount?: number | null;
}

export interface PlayerRoundStatus {
  playerId: string;
  roundNo: number;
  answerStatus: AnswerStatus;
  survived: boolean;
  eliminatedInRound: boolean;
}
