import { useEffect, useState } from "react";
import { RankList } from "../../components/RankList";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player } from "../../types/domain";

export function PlayerFinalPage() {
  const session = getPlayerSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [leaders, setLeaders] = useState<Player[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session) {
        return;
      }

      const snapshot = await fetchPlayerSnapshot(session.gameId, session.playerId);
      if (!snapshot.game || cancelled) {
        return;
      }

      setGame(snapshot.game);
      setLeaders(snapshot.leaderboard.slice(0, snapshot.game.leaderboardSize || 10));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <div className="player-layout">
      <section className="player-stage">
        <p className="eyebrow">最終結果</p>
        <h1>本場活動已結束</h1>
      </section>

      <SectionCard
        title={game?.mode === "survival" ? "最後存活名單" : "前 10 名排行榜"}
        subtitle={game?.mode === "survival" ? "依最後存活名單顯示，不再細分名次。" : "依分數與作答速度排序。"}
      >
        <RankList players={leaders} showMeta={false} showScore={game?.mode !== "survival"} />
      </SectionCard>
    </div>
  );
}
