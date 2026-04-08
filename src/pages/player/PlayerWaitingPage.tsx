import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player } from "../../types/domain";

export function PlayerWaitingPage() {
  const navigate = useNavigate();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const session = getPlayerSession();

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

      if (nextGame?.status === "live_question") {
        navigate("/player/question");
      }
      if (nextGame?.status === "round_result") {
        navigate("/player/round-result");
      }
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
      <section className="player-stage">
        <p className="eyebrow">玩家端 / 等待開始</p>
        <h1>已加入，等待主持人開始</h1>
        <p className="hero-text">
          場次一旦開始就會鎖定新玩家。請留意主持人口令，題目開啟後會自動切換到作答頁面。
        </p>
      </section>

      <SectionCard title="目前狀態" subtitle="這一頁已會即時跟著主持人操作更新。">
        <div className="pill-row">
          <span className="pill">場次：{game?.title ?? "尚未加入"}</span>
          <span className="pill">場次狀態：{game?.status ?? "未知"}</span>
          <span className="pill">
            你的身分：{player ? `${player.nickname} / ${player.department} / ${player.employeeId}` : "讀取中"}
          </span>
        </div>
        <div className="cta-row">
          <Link className="button button--ghost" to="/player/question">
            題目頁
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
