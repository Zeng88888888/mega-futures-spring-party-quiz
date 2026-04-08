import { useEffect, useState } from "react";
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
      setLeaderboard(snapshot.leaderboard.slice(0, snapshot.game?.leaderboardSize || 10));
      setRoundResult(snapshot.roundResult);
      setPlayerRoundStatus(snapshot.playerRoundStatus);

      if (snapshot.game?.mode === "survival" && snapshot.player?.status === "eliminated") {
        navigate("/player/eliminated");
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

  if (!game || !question) {
    return (
      <div className="player-layout">
        <SectionCard title="等待結果" subtitle="主持人尚未公布本題結果。">
          <p>請稍候。</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="player-layout">
      <section className="player-stage">
        <p className="eyebrow">本題結果</p>
        <h1>結果已公布</h1>
        <p className="hero-text">{question.explanation}</p>
      </section>

      <div className="grid-2">
        <SectionCard title="正確答案" subtitle="主持人公布後才會看到。">
          <div className="result-box">
            <strong>{question.correctOption}</strong>
            <p>{question.options[question.correctOption.charCodeAt(0) - 65]}</p>
          </div>
        </SectionCard>

        {game.mode === "competition" ? (
          <SectionCard title="即時前 10 名" subtitle="每題結束後更新。">
            <RankList players={leaderboard} showMeta={false} />
          </SectionCard>
        ) : (
          <SectionCard title="本輪結果" subtitle="公布後才會顯示存活或淘汰。">
            <div className="result-box">
              <strong>{playerRoundStatus?.survived ? "still alive" : "已被淘汰"}</strong>
              <p>
                存活 {roundResult?.aliveCount ?? "-"} 人 / 淘汰 {roundResult?.eliminatedCount ?? "-"} 人
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      {game.mode === "survival" ? (
        <SectionCard title="最後存活名單" subtitle="剩餘人數小於等於 10 人時會直接結束。">
          <RankList players={leaderboard} showMeta={false} showScore={false} />
        </SectionCard>
      ) : null}

      {player ? (
        <SectionCard title="你的狀態" subtitle="本題答案狀態如下。">
          <ul className="plain-list">
            <li>玩家：{player.nickname}</li>
            <li>狀態：{player.status}</li>
            <li>本題結果：{playerRoundStatus?.answerStatus ?? "-"}</li>
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
