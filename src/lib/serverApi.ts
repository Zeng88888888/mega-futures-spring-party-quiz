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
    throw new Error(String(data.message ?? "伺服器處理失敗。"));
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
}) {
  return callFunction<{ ok: true }>("player-action", { action: "submitAnswer", payload });
}

export async function runAdminAction<T = { ok: true }>(
  action: string,
  payload: Record<string, unknown>
) {
  return callFunction<T>("admin-action", { action, payload }, { admin: true });
}
