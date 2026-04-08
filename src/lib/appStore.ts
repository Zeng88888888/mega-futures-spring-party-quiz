import type { GameMode, GameStatus, LiveGame, Player, PlayerStatus, Question } from "../types/domain";

export interface StoredGame extends LiveGame {
  createdAt: string;
}

export interface AppState {
  games: StoredGame[];
  playersByGame: Record<string, Player[]>;
  questions: Question[];
  currentPlayerId?: string;
  currentGameId?: string;
}

const STORAGE_KEY = "mega-futures-spring-party-quiz-app";

const demoQuestions: Question[] = [
  {
    id: "q1",
    prompt: "下列哪一項最符合兆豐期貨春酒競賽系統中的玩家唯一識別欄位？",
    options: ["暱稱", "部門", "員編", "手機號碼"],
    correctOption: "C",
    explanation: "同一場次以員編作為唯一識別，避免重複報名與排行錯誤。"
  },
  {
    id: "q2",
    prompt: "淘汰賽中玩家送出答案後，系統應立即顯示 still alive 嗎？",
    options: ["要，讓玩家安心", "不要，避免隔壁偷看", "只顯示給主持人", "只顯示給前十名"],
    correctOption: "B",
    explanation: "淘汰賽送出後只顯示等待公布，主持人公布結果後才統一揭曉。"
  }
];

function makeStoredGame(
  id: string,
  title: string,
  mode: GameMode,
  status: GameStatus,
  questionCount: number,
  currentRound: number,
  joinCode: string
): StoredGame {
  return {
    id,
    title,
    mode,
    status,
    questionCount,
    currentRound,
    joinCode,
    leaderboardSize: 10,
    createdAt: new Date().toISOString()
  };
}

function seedState(): AppState {
  const liveGame = makeStoredGame(
    "game-2026-spring-01",
    "兆豐期貨春酒搶答賽",
    "competition",
    "registering",
    10,
    0,
    "MEGA2026"
  );

  const survivalGame = makeStoredGame(
    "game-2026-spring-02",
    "春酒壓軸淘汰賽",
    "survival",
    "draft",
    12,
    0,
    "MEGAFINAL"
  );

  return {
    games: [liveGame, survivalGame],
    playersByGame: {
      [liveGame.id]: [
        {
          id: "p1",
          nickname: "小瑜",
          department: "營業二部",
          employeeId: "A1023",
          status: "waiting",
          score: 0,
          totalMs: 0,
          valid: true
        },
        {
          id: "p2",
          nickname: "志明",
          department: "管理部",
          employeeId: "B2046",
          status: "waiting",
          score: 0,
          totalMs: 0,
          valid: true
        },
        {
          id: "p3",
          nickname: "冠廷",
          department: "結算科",
          employeeId: "C1401",
          status: "invalid",
          score: 0,
          totalMs: 0,
          valid: false
        }
      ],
      [survivalGame.id]: []
    },
    questions: demoQuestions,
    currentGameId: liveGame.id
  };
}

function persist(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getAppState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedState();
    persist(seeded);
    return seeded;
  }

  try {
    return JSON.parse(raw) as AppState;
  } catch {
    const seeded = seedState();
    persist(seeded);
    return seeded;
  }
}

export function resetAppState() {
  const seeded = seedState();
  persist(seeded);
  return seeded;
}

export function getGameByCode(joinCode: string) {
  const state = getAppState();
  return state.games.find((game) => game.joinCode.toLowerCase() === joinCode.toLowerCase());
}

export function getGame(gameId: string) {
  return getAppState().games.find((game) => game.id === gameId);
}

export function getPlayers(gameId: string) {
  return getAppState().playersByGame[gameId] ?? [];
}

export function getCurrentContext() {
  const state = getAppState();
  const game = state.currentGameId ? state.games.find((item) => item.id === state.currentGameId) : undefined;
  const player =
    state.currentGameId && state.currentPlayerId
      ? (state.playersByGame[state.currentGameId] ?? []).find((item) => item.id === state.currentPlayerId)
      : undefined;

  return { game, player, state };
}

export function joinGame(params: {
  joinCode: string;
  nickname: string;
  department: string;
  employeeId: string;
}) {
  const state = getAppState();
  const game = state.games.find(
    (item) => item.joinCode.toLowerCase() === params.joinCode.trim().toLowerCase()
  );

  if (!game) {
    throw new Error("找不到對應的場次代碼。");
  }

  if (game.status !== "draft" && game.status !== "registering") {
    throw new Error("本場次已開始或已結束，現在不能加入。");
  }

  const players = state.playersByGame[game.id] ?? [];
  const duplicated = players.find(
    (player) => player.employeeId.trim().toLowerCase() === params.employeeId.trim().toLowerCase()
  );

  if (duplicated) {
    throw new Error("此員編已在本場次報名。");
  }

  const player: Player = {
    id: crypto.randomUUID(),
    nickname: params.nickname.trim(),
    department: params.department.trim(),
    employeeId: params.employeeId.trim(),
    status: "waiting",
    score: 0,
    totalMs: 0,
    valid: true
  };

  const nextState: AppState = {
    ...state,
    currentPlayerId: player.id,
    currentGameId: game.id,
    playersByGame: {
      ...state.playersByGame,
      [game.id]: [...players, player]
    }
  };

  persist(nextState);
  return { game, player };
}

export function updatePlayer(gameId: string, playerId: string, payload: {
  nickname: string;
  department: string;
  employeeId: string;
}) {
  const state = getAppState();
  const players = state.playersByGame[gameId] ?? [];
  const collision = players.find(
    (player) =>
      player.id !== playerId &&
      player.employeeId.trim().toLowerCase() === payload.employeeId.trim().toLowerCase()
  );

  if (collision) {
    throw new Error("修改後的員編會和同場其他玩家重複。");
  }

  const nextPlayers = players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          nickname: payload.nickname.trim(),
          department: payload.department.trim(),
          employeeId: payload.employeeId.trim()
        }
      : player
  );

  persist({
    ...state,
    playersByGame: {
      ...state.playersByGame,
      [gameId]: nextPlayers
    }
  });
}

export function togglePlayerValidity(gameId: string, playerId: string) {
  const state = getAppState();
  const players = state.playersByGame[gameId] ?? [];
  const nextPlayers = players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          valid: !player.valid,
          status: !player.valid ? ("waiting" as PlayerStatus) : ("invalid" as PlayerStatus)
        }
      : player
  );

  persist({
    ...state,
    playersByGame: {
      ...state.playersByGame,
      [gameId]: nextPlayers
    }
  });
}

export function setGameStatus(gameId: string, status: GameStatus) {
  const state = getAppState();
  persist({
    ...state,
    games: state.games.map((game) => (game.id === gameId ? { ...game, status } : game))
  });
}

export function createGame(payload: {
  title: string;
  mode: GameMode;
  questionCount: number;
  joinCode: string;
  leaderboardSize: number;
}) {
  const state = getAppState();
  const game = makeStoredGame(
    crypto.randomUUID(),
    payload.title.trim(),
    payload.mode,
    "draft",
    payload.questionCount,
    0,
    payload.joinCode.trim().toUpperCase()
  );

  persist({
    ...state,
    currentGameId: game.id,
    games: [game, ...state.games],
    playersByGame: {
      ...state.playersByGame,
      [game.id]: []
    }
  });

  return game;
}
