import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RankList } from "../../components/RankList";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, fetchPlayerState, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type {
  LiveGame,
  Player,
  PlayerAnswer,
  PlayerRoundStatus,
  Question,
  RoundResult
} from "../../types/domain";

function formatElapsedSeconds(responseMs?: number | null) {
  if (responseMs === null || responseMs === undefined) {
    return null;
  }

  return (responseMs / 1000).toFixed(2);
}

export function PlayerRoundResultPage() {
  const navigate = useNavigate();
  const session = getPlayerSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<PlayerAnswer | null>(null);
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
    let timer: number | null = null;
    let isPolling = false;

    const getPollDelay = () => (document.visibilityState === "visible" ? 5000 : 12000);
    const clearPollTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

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
      setAnswer(snapshot.answer);
      setLeaderboard(snapshot.leaderboard);
      setRoundResult(snapshot.roundResult);
      setPlayerRoundStatus(snapshot.playerRoundStatus);
    }

    void load();
    const unsubscribe = subscribeToGameRealtime(currentSession.gameId, () => {
      void load();
    });
    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }

      clearPollTimer();
      timer = window.setTimeout(() => {
        if (isPolling) {
          scheduleNextPoll();
          return;
        }

        isPolling = true;
        void fetchPlayerState(currentSession.gameId, currentSession.playerId)
          .then((state) => {
            if (cancelled) {
              return;
            }

            if (state.game.status !== game?.status || state.game.currentRound !== game?.currentRound) {
              void load();
            }
          })
          .catch(() => {
            // Ignore fallback polling errors and keep waiting for the next cycle.
          })
          .finally(() => {
            isPolling = false;
            scheduleNextPoll();
          });
      }, getPollDelay());
    };

    scheduleNextPoll();

    return () => {
      cancelled = true;
      clearPollTimer();
      unsubscribe();
    };
  }, [game?.currentRound, game?.status, navigate, session]);

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

  const optionIndex =
    question.correctOption && /^[A-D]$/.test(question.correctOption)
      ? question.correctOption.charCodeAt(0) - 65
      : -1;
  const correctOptionLabel = optionIndex >= 0 ? question.options[optionIndex] : "";
  const elapsedSeconds = formatElapsedSeconds(answer?.responseMs);

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
            <p>{correctOptionLabel}</p>
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

      {game.mode === "competition" ? (
        <SectionCard title="你的本題成績">
          <ul className="plain-list">
            <li>本題結果：{answer?.answerStatus ?? "-"}</li>
            <li>本題得分：{answer?.score ?? 0} 分</li>
            <li>累積總分：{player?.score ?? 0} 分</li>
            <li>本題用時：{elapsedSeconds ? `${elapsedSeconds} 秒` : "-"}</li>
          </ul>
        </SectionCard>
      ) : (
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
      )}

      {player ? (
        <SectionCard title="你的目前狀態">
          <ul className="plain-list">
            <li>暱稱：{player.nickname}</li>
            <li>玩家狀態：{player.status}</li>
            <li>本題結果：{playerRoundStatus?.answerStatus ?? answer?.answerStatus ?? "-"}</li>
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
