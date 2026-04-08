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
      if (cancelled) {
        return;
      }

      setGame(snapshot.game);
      setPlayer(snapshot.player);

      if (snapshot.game?.status === "ended") {
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
        <p className="eyebrow">淘汰通知</p>
        <h1>你已被淘汰</h1>
      </section>

      <SectionCard title="本輪狀態">
        <div className="result-box result-box--danger">
          <strong>已被淘汰</strong>
          <p>
            {player?.nickname ?? "玩家"} / 場次狀態：{game?.status ?? "-"}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
