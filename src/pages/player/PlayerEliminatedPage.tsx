import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player } from "../../types/domain";

export function PlayerEliminatedPage() {
  const navigate = useNavigate();
  const session = getPlayerSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    const currentSession = session;
    if (!currentSession) {
      navigate("/player/join");
      return;
    }
    const sessionData = currentSession;

    let cancelled = false;

    async function load() {
      const snapshot = await fetchPlayerSnapshot(sessionData.gameId, sessionData.playerId);
      const nextGame = snapshot.game;
      const nextPlayer = snapshot.player;

      if (cancelled) {
        return;
      }

      setGame(nextGame);
      setPlayer(nextPlayer);

      if (nextGame?.status === "ended") {
        navigate("/player/final");
      }
    }

    void load();
    const unsubscribe = subscribeToGameRealtime(sessionData.gameId, () => {
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate, session]);

  return (
    <div className="player-layout">
      <section className="player-stage player-stage--danger">
        <p className="eyebrow">淘汰賽結果</p>
        <h1>本輪你已被淘汰</h1>
        <p className="hero-text">
          你可以繼續留在畫面上觀看最後結果。系統會在主持人結束場次後顯示最後存活名單。
        </p>
      </section>

      <SectionCard title="目前狀態" subtitle="這一頁會即時等待主持人結束整場。">
        <div className="result-box result-box--danger">
          <strong>已被淘汰</strong>
          <p>
            玩家 {player?.nickname ?? ""} 目前狀態為 {player?.status ?? "未知"}，場次狀態 {game?.status ?? "未知"}。
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
