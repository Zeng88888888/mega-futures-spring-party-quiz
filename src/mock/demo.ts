import type { LiveGame, Player, Question } from "../types/domain";

export const demoGame: LiveGame = {
  id: "game-2026-spring-01",
  title: "兆豐期貨春酒搶答賽",
  mode: "competition",
  questionCount: 10,
  currentRound: 4,
  status: "round_result",
  joinCode: "MEGA2026",
  leaderboardSize: 10
};

export const demoPlayers: Player[] = [
  {
    id: "p1",
    nickname: "小瑜",
    department: "營業二部",
    employeeId: "A1023",
    status: "active",
    score: 358,
    totalMs: 18700,
    valid: true
  },
  {
    id: "p2",
    nickname: "志明",
    department: "管理部",
    employeeId: "B2046",
    status: "submitted",
    score: 346,
    totalMs: 19220,
    valid: true
  },
  {
    id: "p3",
    nickname: "Nina",
    department: "資訊部",
    employeeId: "I3312",
    status: "active",
    score: 335,
    totalMs: 20400,
    valid: true
  },
  {
    id: "p4",
    nickname: "冠廷",
    department: "結算科",
    employeeId: "C1401",
    status: "invalid",
    score: 312,
    totalMs: 22800,
    valid: false
  },
  {
    id: "p5",
    nickname: "Anita",
    department: "風控部",
    employeeId: "R1108",
    status: "eliminated",
    score: 0,
    aliveRound: 3,
    valid: true
  }
];

export const topTen = demoPlayers.filter((player) => player.valid).slice(0, 3);

export const demoQuestion: Question = {
  id: "q4",
  prompt: "下列哪一項最符合兆豐期貨春酒競賽系統中的玩家唯一識別欄位？",
  options: ["暱稱", "部門", "員編", "手機號碼"],
  correctOption: "C",
  explanation: "同一場次以員編作為唯一識別，避免重複報名與排行錯誤。"
};

export const csvHeaders = [
  "content",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "explanation"
];
