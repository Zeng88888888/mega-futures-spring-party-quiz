import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, submitAnswerRecord, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player, PlayerAnswer, Question } from "../../types/domain";

function formatMode(mode: LiveGame["mode"]) {
  return mode === "competition" ? "競賽模式" : "淘汰賽模式";
}

export function PlayerQuestionPage() {
  const navigate = useNavigate();
  const session = getPlayerSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<PlayerAnswer | null>(null);
  const [error, setError] = useState("");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setQuestion(snapshot.question);
      setAnswer((currentAnswer) => currentAnswer ?? snapshot.answer);
      setIsSubmitting(false);

      if (snapshot.game?.status === "round_result") {
        navigate("/player/round-result");
        return;
      }
      if (snapshot.game?.status === "ended") {
        navigate("/player/final");
        return;
      }
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
    return () => window.clearInterval(timer);
  }, [game]);

  const remainingSeconds = useMemo(() => {
    if (remainingMs === null) {
      return null;
    }
    return Math.ceil(remainingMs / 1000);
  }, [remainingMs]);

  async function submit(option: "A" | "B" | "C" | "D") {
    const currentSession = session;
    if (!currentSession || !game || !question || answer || isSubmitting) {
      return;
    }

    const optimisticAnswer: PlayerAnswer = {
      playerId: currentSession.playerId,
      questionId: question.id,
      roundNo: game.currentRound,
      selectedOption: option,
      answerStatus: "wrong",
      isCorrect: false,
      responseMs: game.mode === "competition" && remainingMs !== null ? Math.max(0, remainingMs) : null,
      score: 0,
      answeredAt: new Date().toISOString()
    };

    setError("");
    setIsSubmitting(true);
    setAnswer(optimisticAnswer);

    try {
      await submitAnswerRecord({
        gameId: game.id,
        playerId: currentSession.playerId,
        selectedOption: option
      });
    } catch (submissionError) {
      setAnswer(null);
      setIsSubmitting(false);
      setError(submissionError instanceof Error ? submissionError.message : "送出答案失敗，請再試一次。");
    }
  }

  if (!game || !question) {
    return (
      <div className="player-layout">
        <SectionCard title="載入題目中">
          <p>正在同步最新題目與作答狀態，請稍候。</p>
        </SectionCard>
      </div>
    );
  }

  const answerLocked = Boolean(answer);
  const submittedOption = answer?.selectedOption ?? "-";

  return (
    <div className="player-layout">
      <section className="player-stage">
        <div className="stage-meta">
          <span className="pill">{formatMode(game.mode)}</span>
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
        title={answerLocked ? "已送出答案" : "請選擇答案"}
        subtitle={
          answerLocked
            ? "答案已鎖定，等待主持人公布結果。"
            : player
              ? `${player.nickname}，請在確認後點選一個選項。`
              : undefined
        }
      >
        {answerLocked ? (
          <div className="result-box">
            <strong>{submittedOption}</strong>
            <p>{isSubmitting ? "答案送出中，已先為你鎖定選項。" : "答案已送出，等待主持人公布結果。"}</p>
          </div>
        ) : (
          <div className="answer-grid">
            {question.options.map((option, index) => {
              const code = String.fromCharCode(65 + index) as "A" | "B" | "C" | "D";
              return (
                <button
                  className="answer-card"
                  disabled={answerLocked || isSubmitting}
                  key={`${question.id}-${code}`}
                  onClick={() => void submit(code)}
                  type="button"
                >
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
