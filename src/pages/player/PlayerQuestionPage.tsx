import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import {
  fetchPlayerSnapshot,
  submitAnswerRecord,
  subscribeToGameRealtime
} from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player, PlayerAnswer, Question } from "../../types/domain";

export function PlayerQuestionPage() {
  const navigate = useNavigate();
  const session = getPlayerSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<PlayerAnswer | null>(null);
  const [error, setError] = useState("");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

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

      if (!nextGame) {
        return;
      }

      if (nextGame.status === "round_result") {
        navigate("/player/round-result");
        return;
      }

      if (nextGame.status === "ended") {
        navigate("/player/final");
        return;
      }

      if (nextGame.mode === "survival" && nextPlayer?.status === "eliminated") {
        navigate("/player/eliminated");
        return;
      }

      if (!cancelled) {
        setQuestion(snapshot.question);
        setAnswer(snapshot.answer);
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

  useEffect(() => {
    if (!game || game.mode !== "competition" || !game.startedAt || !game.competitionSeconds) {
      setRemainingMs(null);
      return;
    }

    const endAt = new Date(game.startedAt).getTime() + game.competitionSeconds * 1000;
    const update = () => {
      setRemainingMs(Math.max(0, endAt - Date.now()));
    };

    update();
    const timer = window.setInterval(update, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [game]);

  const remainingSeconds = useMemo(() => {
    if (remainingMs === null) {
      return null;
    }
    return Math.ceil(remainingMs / 1000);
  }, [remainingMs]);

  async function submit(option: "A" | "B" | "C" | "D") {
    const currentSession = session;
    if (!currentSession || !game) {
      return;
    }
    const sessionData = currentSession;

    try {
      setError("");
      await submitAnswerRecord({ gameId: game.id, playerId: sessionData.playerId, selectedOption: option });
      const snapshot = await fetchPlayerSnapshot(game.id, sessionData.playerId);
      setAnswer(snapshot.answer);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "送出失敗。");
    }
  }

  if (!game || !question) {
    return (
      <div className="player-layout">
        <SectionCard title="等待題目" subtitle="主持人開題後，這裡會自動切換成作答畫面。">
          <p>目前尚未進入可作答回合。</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="player-layout">
      <section className="player-stage">
        <div className="stage-meta">
          <span className="pill">{game.mode === "competition" ? "競賽模式" : "淘汰賽模式"}</span>
          <span className="pill">
            第 {game.currentRound} / {game.questionCount} 題
          </span>
          {game.mode === "competition" ? (
            <span className="pill pill--accent">剩餘 {remainingSeconds ?? game.competitionSeconds} 秒</span>
          ) : (
            <span className="pill pill--accent">不限秒數</span>
          )}
        </div>
        <h1>{question.prompt}</h1>
      </section>

      <SectionCard
        title={answer ? "答案已送出" : "請選擇一個答案"}
        subtitle={answer ? "已送出，等待主持人公布結果。" : "送出後會先鎖定，等待主持人公布結果。"}
      >
        {answer ? (
          <div className="result-box">
            <strong>{answer.selectedOption}</strong>
            <p>已送出，請等待主持人公布本題結果。</p>
          </div>
        ) : (
          <div className="answer-grid">
            {question.options.map((option, index) => {
              const code = String.fromCharCode(65 + index) as "A" | "B" | "C" | "D";
              return (
                <button className="answer-card" key={option} onClick={() => void submit(code)} type="button">
                  <span>{code}</span>
                  <strong>{option}</strong>
                </button>
              );
            })}
          </div>
        )}
        {error ? <p className="inline-error">{error}</p> : null}
      </SectionCard>
    </div>
  );
}
