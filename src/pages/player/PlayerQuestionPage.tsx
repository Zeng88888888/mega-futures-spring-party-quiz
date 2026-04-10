import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, submitAnswerRecord, subscribeToGameRealtime } from "../../lib/gameApi";
import {
  clearPendingAnswerSession,
  getPendingAnswerSession,
  getPlayerSession,
  setPendingAnswerSession
} from "../../lib/playerSession";
import type { LiveGame, Player, PlayerAnswer, Question } from "../../types/domain";

function formatMode(mode: LiveGame["mode"]) {
  return mode === "competition" ? "競賽模式" : "淘汰賽模式";
}

function formatElapsedSeconds(responseMs?: number | null) {
  if (responseMs === null || responseMs === undefined) {
    return null;
  }

  return (responseMs / 1000).toFixed(2);
}

function createTimeoutAnswer(
  playerId: string,
  questionId: string,
  roundNo: number,
  responseMs: number
): PlayerAnswer {
  return {
    playerId,
    questionId,
    roundNo,
    answerStatus: "no_answer",
    isCorrect: false,
    responseMs,
    score: 0,
    answeredAt: null
  };
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
  const [prepRemainingMs, setPrepRemainingMs] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveringPendingAnswer, setIsRecoveringPendingAnswer] = useState(false);

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

      setGame(snapshot.game);
      setPlayer(snapshot.player);
      setQuestion(snapshot.question);
      const pendingAnswer = getPendingAnswerSession();
      setAnswer((current) => {
        if (!snapshot.game) {
          return snapshot.answer;
        }

        if (snapshot.answer) {
          clearPendingAnswerSession();
          return snapshot.answer;
        }

        if (
          pendingAnswer &&
          pendingAnswer.gameId === currentSession.gameId &&
          pendingAnswer.playerId === currentSession.playerId &&
          pendingAnswer.roundNo === snapshot.game.currentRound &&
          pendingAnswer.questionId === snapshot.question?.id
        ) {
          return {
            playerId: currentSession.playerId,
            questionId: pendingAnswer.questionId,
            roundNo: pendingAnswer.roundNo,
            selectedOption: pendingAnswer.selectedOption,
            answerStatus: "wrong",
            isCorrect: false,
            responseMs: pendingAnswer.responseMs,
            score: 0,
            answeredAt: pendingAnswer.answeredAt
          };
        }

        if (!current) {
          return snapshot.answer;
        }

        if (current.roundNo !== snapshot.game.currentRound) {
          return snapshot.answer;
        }

        return snapshot.answer ?? current;
      });
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
    const unsubscribe = subscribeToGameRealtime(currentSession.gameId, () => {
      void load();
    });
    const pollTimer = window.setInterval(() => {
      void load();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      unsubscribe();
    };
  }, [navigate, session]);

  useEffect(() => {
    if (!session || !game || !question || !answer?.selectedOption || isRecoveringPendingAnswer || isSubmitting) {
      return;
    }

    const pendingAnswer = getPendingAnswerSession();
    if (
      !pendingAnswer ||
      pendingAnswer.gameId !== session.gameId ||
      pendingAnswer.playerId !== session.playerId ||
      pendingAnswer.roundNo !== game.currentRound ||
      pendingAnswer.questionId !== question.id ||
      pendingAnswer.selectedOption !== answer.selectedOption ||
      game.status !== "live_question"
    ) {
      return;
    }

    setIsRecoveringPendingAnswer(true);
    void submitAnswerRecord({
      gameId: game.id,
      playerId: session.playerId,
      selectedOption: pendingAnswer.selectedOption,
      answeredAt: pendingAnswer.answeredAt
    })
      .then(() => {
        clearPendingAnswerSession();
      })
      .catch(() => {
        // Keep the local optimistic answer; a later refresh can retry.
      })
      .finally(() => {
        setIsRecoveringPendingAnswer(false);
      });
  }, [answer?.selectedOption, game, isRecoveringPendingAnswer, isSubmitting, question, session]);

  useEffect(() => {
    if (!session || !game || !question || game.mode !== "competition" || !game.startedAt || !game.competitionSeconds) {
      setRemainingMs(null);
      setPrepRemainingMs(null);
      return;
    }

    const startedAtMs = new Date(game.startedAt).getTime();
    const durationMs = Math.max(game.competitionSeconds * 1000, 1000);

    const update = () => {
      const now = Date.now();
      const prepMs = Math.max(0, startedAtMs - now);
      const elapsedMs = Math.max(0, now - startedAtMs);
      const nextRemainingMs = Math.max(0, durationMs - elapsedMs);
      setPrepRemainingMs(prepMs);
      setRemainingMs(nextRemainingMs);

      if (prepMs === 0 && nextRemainingMs === 0 && !answer) {
        setAnswer(
          createTimeoutAnswer(session.playerId, question.id, game.currentRound, durationMs)
        );
        setIsSubmitting(false);
      }
    };

    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [answer, game, question, session]);

  const remainingSeconds = useMemo(() => {
    if (remainingMs === null) {
      return null;
    }

    return Math.ceil(remainingMs / 1000);
  }, [remainingMs]);

  const prepSeconds = useMemo(() => {
    if (prepRemainingMs === null || prepRemainingMs <= 0) {
      return null;
    }

    return Math.ceil(prepRemainingMs / 1000);
  }, [prepRemainingMs]);

  const isPreparePhase =
    game?.mode === "competition" &&
    game.startedAt &&
    new Date(game.startedAt).getTime() > Date.now();

  async function submit(option: "A" | "B" | "C" | "D") {
    if (!session || !game || !question || answer || isSubmitting || isPreparePhase) {
      return;
    }

    const competitionDurationMs = Math.max((game.competitionSeconds ?? 10) * 1000, 1000);
    const startedAtMs = game.startedAt ? new Date(game.startedAt).getTime() : Date.now();
    const actualResponseMs =
      game.mode === "competition"
        ? Math.min(Math.max(Date.now() - startedAtMs, 0), competitionDurationMs)
        : null;

    const answeredAt = new Date().toISOString();

    setError("");
    setIsSubmitting(true);
    setPendingAnswerSession({
      gameId: game.id,
      playerId: session.playerId,
      roundNo: game.currentRound,
      questionId: question.id,
      selectedOption: option,
      answeredAt,
      responseMs: actualResponseMs
    });
    setAnswer({
      playerId: session.playerId,
      questionId: question.id,
      roundNo: game.currentRound,
      selectedOption: option,
      answerStatus: "wrong",
      isCorrect: false,
      responseMs: actualResponseMs,
      score: 0,
      answeredAt
    });

    try {
      await submitAnswerRecord({
        gameId: game.id,
        playerId: session.playerId,
        selectedOption: option,
        answeredAt
      });
      clearPendingAnswerSession();
    } catch (submissionError) {
      setIsSubmitting(false);
      setError(
        submissionError instanceof Error
          ? `${submissionError.message}，系統會保留這次作答並嘗試同步。`
          : "送出答案失敗，系統會保留這次作答並嘗試同步。"
      );
    }
  }

  if (!game || !question) {
    return (
      <div className="player-layout">
        <SectionCard title="正在載入題目">
          <p>系統正在同步目前題目，請稍候。</p>
        </SectionCard>
      </div>
    );
  }

  const timeoutLocked =
    game.mode === "competition" &&
    answer?.answerStatus === "no_answer" &&
    !answer.selectedOption;
  const answerLocked = Boolean(answer);
  const submittedOption = answer?.selectedOption ?? "未作答";
  const elapsedSeconds = formatElapsedSeconds(answer?.responseMs);

  return (
    <div className="player-layout">
      <section className="player-stage">
        <div className="stage-meta">
          <span className="pill">{formatMode(game.mode)}</span>
          <span className="pill">
            第 {game.currentRound} / {game.questionCount} 題
          </span>
          {game.mode === "competition" ? (
            <span className="pill pill--accent">
              {isPreparePhase ? `即將開始 ${prepSeconds ?? 1} 秒` : `剩餘 ${remainingSeconds ?? game.competitionSeconds} 秒`}
            </span>
          ) : (
            <span className="pill pill--accent">不限秒數</span>
          )}
        </div>
        <h1>{question.prompt}</h1>
      </section>

      <SectionCard
        title={answerLocked ? "答案已鎖定" : "請選擇答案"}
        subtitle={
          answerLocked
            ? "答案已鎖定，等待主持人公布結果。"
            : player
              ? `${player.nickname}，請在作答時間內選出你的答案。`
              : undefined
        }
      >
        {answerLocked ? (
          <div className={`result-box ${timeoutLocked ? "result-box--danger" : ""}`}>
            <strong>{timeoutLocked ? "已超過作答時間" : submittedOption}</strong>
            <p>
              {timeoutLocked
                ? "本題已超過時限，系統會以未作答 / 作答錯誤處理。"
                : isSubmitting
                  ? "答案已先鎖定，正在同步到系統。"
                  : "答案已送出，等待主持人公布結果。"}
            </p>
            {elapsedSeconds ? <p>本題用時：{elapsedSeconds} 秒</p> : null}
          </div>
        ) : isPreparePhase ? (
          <div className="result-box">
            <strong>{prepSeconds ?? 1}</strong>
            <p>全體共同倒數中，倒數結束後才會一起開放作答。</p>
          </div>
        ) : (
          <div className="answer-grid">
            {question.options.map((option, index) => {
              const code = String.fromCharCode(65 + index) as "A" | "B" | "C" | "D";
              return (
                <button
                  className="answer-card"
                  disabled={answerLocked || isSubmitting || timeoutLocked}
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
