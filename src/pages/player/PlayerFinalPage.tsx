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
      if (!snapshot.game) {
        return;
      }

      const nextGame = snapshot.game;
      const nextLeaders = snapshot.leaderboard;
      if (!cancelled) {
        setGame(nextGame);
        setLeaders(nextLeaders.slice(0, nextGame.leaderboardSize || 10));
      }
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
        <h1>本場已結束</h1>
        <p className="hero-text">
          {game?.mode === "survival"
            ? "以下為最後存活的前 10 名名單。"
            : "恭喜上榜玩家，以下為本場競賽的最終排行榜。"}
        </p>
      </section>

      <SectionCard
        title={game?.mode === "survival" ? "最後存活名單" : "前 10 名"}
        subtitle="無效玩家不會被列入最終榜單。"
      >
        <RankList players={leaders} showMeta={false} showScore={game?.mode !== "survival"} />
      </SectionCard>
    </div>
  );
}
