import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RankList } from "../../components/RankList";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player, PlayerRoundStatus, Question, RoundResult } from "../../types/domain";

export function PlayerRoundResultPage() {
  const navigate = useNavigate();
  const session = getPlayerSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [playerRoundStatus, setPlayerRoundStatus] = useState<PlayerRoundStatus | null>(null);

  useEffect(() => {
    if (!session) {
      navigate("/player/join");
      return;
    }
    const currentSession = session;

    let cancelled = false;

    async function load() {
      const snapshot = await fetchPlayerSnapshot(currentSession.gameId, currentSession.playerId);
      if (cancelled) {
        return;
      }

      if (snapshot.game?.status === "live_question") {
        navigate("/player/question");
        return;
      }

      if (snapshot.game?.status === "ended") {
        navigate("/player/final");
        return;
      }

      setGame(snapshot.game);
      setPlayer(snapshot.player);
      setQuestion(snapshot.question);
      setLeaderboard(snapshot.leaderboard);
      setRoundResult(snapshot.roundResult);
      setPlayerRoundStatus(snapshot.playerRoundStatus);
    }

    void load();
    const unsubscribe = subscribeToGameRealtime(currentSession.gameId, () => {
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate, session]);

  const alivePlayers = useMemo(
    () => leaderboard.filter((entry) => entry.status !== "eliminated"),
    [leaderboard]
  );
  const eliminatedPlayers = useMemo(
    () => leaderboard.filter((entry) => entry.status === "eliminated"),
    [leaderboard]
  );

  if (!game || !question) {
    return (
      <div className="player-layout">
        <SectionCard title="正在載入結果">
          <p>系統正在同步本題結果，請稍候。</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="player-layout">
      <section className="player-stage">
        <p className="eyebrow">本題結果</p>
        <h1>主持人已公布第 {game.currentRound} 題結果</h1>
        <p className="hero-text">{question.explanation || "本題已公布，請等待主持人進入下一題。"}</p>
      </section>

      <div className="grid-2">
        <SectionCard title="正確答案">
          <div className="result-box">
            <strong>{question.correctOption}</strong>
            <p>{question.options[question.correctOption.charCodeAt(0) - 65]}</p>
          </div>
        </SectionCard>

        {game.mode === "competition" ? (
          <SectionCard title={`目前前 ${game.leaderboardSize || 10} 名`}>
            <RankList players={leaderboard.slice(0, game.leaderboardSize || 10)} showMeta={false} />
          </SectionCard>
        ) : (
          <SectionCard title="你的淘汰結果">
            <div className={`result-box ${playerRoundStatus?.survived ? "" : "result-box--danger"}`}>
              <strong>{playerRoundStatus?.survived ? "still alive" : "你已被淘汰"}</strong>
              <p>
                存活 {roundResult?.aliveCount ?? 0} 人 / 淘汰 {roundResult?.eliminatedCount ?? 0} 人
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      {game.mode === "survival" ? (
        <div className="grid-2">
          <SectionCard title="目前存活名單" subtitle="主持人公布後，仍可繼續下一輪的玩家。">
            {alivePlayers.length > 0 ? (
              <RankList players={alivePlayers} showMeta={false} showScore={false} />
            ) : (
              <p>本輪結束後沒有存活玩家。</p>
            )}
          </SectionCard>

          <SectionCard title="目前已淘汰名單" subtitle="截至這一輪為止，已被淘汰的玩家。">
            {eliminatedPlayers.length > 0 ? (
              <RankList players={eliminatedPlayers} showMeta={false} showScore={false} />
            ) : (
              <p>本輪沒有玩家被淘汰。</p>
            )}
          </SectionCard>
        </div>
      ) : null}

      {player ? (
        <SectionCard title="你的目前狀態">
          <ul className="plain-list">
            <li>暱稱：{player.nickname}</li>
            <li>玩家狀態：{player.status}</li>
            <li>本題結果：{playerRoundStatus?.answerStatus ?? "-"}</li>
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
