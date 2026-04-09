const PLAYER_SESSION_KEY = "mega-futures-player-session";
const PENDING_ANSWER_KEY = "mega-futures-pending-answer";

export interface PlayerSession {
  gameId: string;
  playerId: string;
}

export interface PendingAnswerSession {
  gameId: string;
  playerId: string;
  roundNo: number;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
  answeredAt: string;
  responseMs?: number | null;
}

export function getPlayerSession(): PlayerSession | null {
  const raw = localStorage.getItem(PLAYER_SESSION_KEY) ?? sessionStorage.getItem(PLAYER_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function setPlayerSession(session: PlayerSession) {
  localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
}

export function clearPlayerSession() {
  localStorage.removeItem(PLAYER_SESSION_KEY);
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

export function getPendingAnswerSession(): PendingAnswerSession | null {
  const raw = localStorage.getItem(PENDING_ANSWER_KEY) ?? sessionStorage.getItem(PENDING_ANSWER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingAnswerSession;
  } catch {
    return null;
  }
}

export function setPendingAnswerSession(answer: PendingAnswerSession) {
  const serialized = JSON.stringify(answer);
  localStorage.setItem(PENDING_ANSWER_KEY, serialized);
  sessionStorage.setItem(PENDING_ANSWER_KEY, serialized);
}

export function clearPendingAnswerSession() {
  localStorage.removeItem(PENDING_ANSWER_KEY);
  sessionStorage.removeItem(PENDING_ANSWER_KEY);
}
