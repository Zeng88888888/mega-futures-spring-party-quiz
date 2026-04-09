const PLAYER_SESSION_KEY = "mega-futures-player-session";

export interface PlayerSession {
  gameId: string;
  playerId: string;
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
