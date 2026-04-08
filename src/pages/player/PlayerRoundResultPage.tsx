import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RankList } from "../../components/RankList";
import { SectionCard } from "../../components/SectionCard";
import {
  fetchPlayerSnapshot,
  subscribeToGameRealtime
} from "../../lib/gameApi";
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
      const nextGame = snapshot.game;
      const nextPlayer = snapshot.player;

      if (!nextGame || cancelled) {
        setGame(nextGame);
        setPlayer(nextPlayer);
        return;
      }

      if (nextGame.status === "live_question") {
        navigate("/player/question");
        return;
      }

      if (nextGame.status === "ended") {
        navigate("/player/final");
        return;
      }

      if (cancelled) {
        return;
      }

      setGame(nextGame);
      setPlayer(nextPlayer);
      setQuestion(snapshot.question);
      setLeaderboard(snapshot.leaderboard.slice(0, nextGame.leaderboardSize || 10));
      setRoundResult(snapshot.roundResult);
      setPlayerRoundStatus(snapshot.playerRoundStatus);

      if (nextGame.mode === "survival" && nextPlayer?.status === "eliminated") {
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
        <SectionCard title="等待結果" subtitle="主持人公布後，這裡會顯示正解與排行榜。">
          <p>目前尚未有可顯示的回合結果。</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="player-layout">
      <section className="player-stage">
        <p className="eyebrow">題目結果</p>
        <h1>本題結果已公布</h1>
        <p className="hero-text">{question.explanation}</p>
      </section>

      <div className="grid-2">
        <SectionCard title="正確答案" subtitle="主持人公布後才會一起揭曉。">
          <div className="result-box">
            <strong>{question.correctOption}</strong>
            <p>{question.options[question.correctOption.charCodeAt(0) - 65]}</p>
          </div>
        </SectionCard>

        {game.mode === "competition" ? (
          <SectionCard title="即時前 10 名" subtitle="無效玩家不會進入排行榜。">
            <RankList players={leaderboard} showMeta={false} />
          </SectionCard>
        ) : (
          <SectionCard title="本輪狀態" subtitle="淘汰賽會在主持人公布時統一揭曉。">
            <div className="result-box">
              <strong>{playerRoundStatus?.survived ? "still alive" : "已被淘汰"}</strong>
              <p>
                剩餘存活 {roundResult?.aliveCount ?? "-"} 人，本輪淘汰 {roundResult?.eliminatedCount ?? "-"} 人。
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      {game.mode === "competition" ? null : (
        <SectionCard title="目前前 10 名名單" subtitle="淘汰賽最終會顯示最後存活者名單。">
          <RankList players={leaderboard} showMeta={false} showScore={false} />
        </SectionCard>
      )}

      {player ? (
        <SectionCard title="你的狀態" subtitle="這裡會反映你在本輪公布後的狀態。">
          <ul className="plain-list">
            <li>玩家：{player.nickname}</li>
            <li>狀態：{player.status}</li>
            <li>本輪結果：{playerRoundStatus?.answerStatus ?? "未結算"}</li>
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
