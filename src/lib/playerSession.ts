const PLAYER_SESSION_KEY = "mega-futures-player-session";

export interface PlayerSession {
  gameId: string;
  playerId: string;
}

export function getPlayerSession(): PlayerSession | null {
  const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
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
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
}

export function clearPlayerSession() {
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}
