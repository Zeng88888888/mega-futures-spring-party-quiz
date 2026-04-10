import { getAdminPassword } from "./adminSession";

async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function normalizeFunctionError(data: Record<string, unknown>) {
  const message = String(data.message ?? data.error ?? "");
  const errorCode = String(data.error ?? "");

  if (errorCode === "usage_exceeded" || /usage exceeded/i.test(message)) {
    return "目前這個 Netlify 站的 Functions 額度已用完，請改用正式站或等待額度重置。";
  }

  return message || "函式呼叫失敗。";
}

async function callFunction<T>(
  name: string,
  payload: Record<string, unknown>,
  options?: { admin?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options?.admin) {
    headers["x-admin-password"] = getAdminPassword();
  }

  const response = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(normalizeFunctionError(data));
  }

  return data as T;
}

export async function loginAdmin(password: string) {
  return callFunction<{ ok: true }>("admin-login", { password });
}

export async function readPlayerSnapshot(payload: {
  gameId: string;
  playerId: string;
}) {
  return callFunction<{
    game: Record<string, unknown>;
    player: Record<string, unknown>;
    question: Record<string, unknown> | null;
    answer: Record<string, unknown> | null;
    leaderboard: Array<Record<string, unknown>>;
    roundResult: Record<string, unknown> | null;
    playerRoundStatus: Record<string, unknown> | null;
  }>("game-read", { action: "getPlayerSnapshot", payload });
}

export async function readPlayerState(payload: {
  gameId: string;
  playerId: string;
}) {
  return callFunction<{
    game: {
      id: string;
      status: string;
      currentRound: number;
      mode: string;
    };
    player: {
      id: string;
      status: string;
      valid: boolean;
    };
  }>("game-read", { action: "getPlayerState", payload });
}

export async function readJoinStats(joinCode: string) {
  return callFunction<{
    game: {
      id: string;
      title: string;
      status: string;
      mode: string;
      questionCount: number;
    } | null;
    playerCount: number;
  }>("game-read", { action: "getJoinStats", payload: { joinCode } });
}

export async function readJoinableGames() {
  return callFunction<{
    games: Array<{
      id: string;
      title: string;
      mode: string;
      status: string;
      bankId?: string;
      bankTitle?: string;
      questionCount: number;
      currentRound: number;
      joinCode: string;
      competitionSeconds?: number | null;
      survivalThreshold?: number | null;
      leaderboardSize: number;
      startedAt?: string | null;
      endedAt?: string | null;
    }>;
  }>("game-read", { action: "listJoinableGames", payload: {} });
}

export async function joinGameServer(payload: {
  joinCode: string;
  nickname: string;
  department: string;
  employeeId: string;
}) {
  return callFunction<{
    game: Record<string, unknown> | null;
    player: Record<string, unknown> | null;
  }>("player-action", { action: "joinGame", payload });
}

export async function submitAnswerServer(payload: {
  gameId: string;
  playerId: string;
  selectedOption: "A" | "B" | "C" | "D";
  answeredAt: string;
}) {
  return callFunction<{ ok: true }>("player-action", { action: "submitAnswer", payload });
}

export async function runAdminAction<T = { ok: true }>(action: string, payload: Record<string, unknown>) {
  return callFunction<T>("admin-action", { action, payload }, { admin: true });
}
