import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player } from "../../types/domain";

function formatStatus(status?: LiveGame["status"]) {
  const map: Record<LiveGame["status"], string> = {
    draft: "草稿",
    registering: "報名中",
    live_question: "答題中",
    round_result: "公布結果",
    ended: "已結束"
  };
  return status ? map[status] ?? status : "-";
}

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
      if (cancelled) {
        return;
      }

      setGame(snapshot.game);
      setPlayer(snapshot.player);

      if (snapshot.game?.status === "live_question") {
        navigate("/player/question");
      }
      if (snapshot.game?.status === "round_result") {
        navigate("/player/round-result");
      }
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
      <section className="player-stage">
        <p className="eyebrow">玩家端</p>
        <h1>等待主持人開始</h1>
      </section>

      <SectionCard title="目前資訊" subtitle="主持人開始後會自動進入答題頁。">
        <div className="pill-row">
          <span className="pill">場次：{game?.title ?? "-"}</span>
          <span className="pill">狀態：{formatStatus(game?.status)}</span>
          <span className="pill">
            玩家：{player ? `${player.nickname} / ${player.department} / ${player.employeeId}` : "-"}
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
