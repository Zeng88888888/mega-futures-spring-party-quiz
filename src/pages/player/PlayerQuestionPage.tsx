import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import {
  fetchPlayerSnapshot,
  fetchPlayerState,
  submitAnswerRecord,
  subscribeToGameRealtime
} from "../../lib/gameApi";
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

async function submitAnswerWithTimeout(
  payload: {
    gameId: string;
    playerId: string;
    questionId: string;
    roundNo: number;
    selectedOption: "A" | "B" | "C" | "D";
    answeredAt: string;
  },
  timeoutMs = 6000
) {
  return Promise.race([
    submitAnswerRecord(payload),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("答案送出較慢，系統會自動重試。")), timeoutMs);
    })
  ]);
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
  const answerLockRef = useRef(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    if (!session) {
      navigate("/player/join");
      return;
    }

    const currentSession = session;
    let cancelled = false;
    let timer: number | null = null;
    let isPolling = false;

    const shouldPoll = () =>
      document.visibilityState === "visible" &&
      game?.status === "live_question" &&
      !answerLockRef.current;
    const getPollDelay = () => 5000;
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

      setGame(snapshot.game);
      setPlayer(snapshot.player);
      setQuestion(snapshot.question);

      const pendingAnswer = getPendingAnswerSession();
      setAnswer((current) => {
        if (!snapshot.game) {
          return snapshot.answer;
        }

        if (snapshot.answer) {
          answerLockRef.current = true;
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
          answerLockRef.current = true;
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
          answerLockRef.current = false;
          return snapshot.answer;
        }

        if (current.roundNo !== snapshot.game.currentRound) {
          answerLockRef.current = false;
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

    const unsubscribe = subscribeToGameRealtime(
      currentSession.gameId,
      () => {
        void fetchPlayerState(currentSession.gameId, currentSession.playerId)
          .then((state) => {
            if (cancelled) {
              return;
            }

            if (state.game.status === "round_result" || state.game.hasPublishedResult) {
              navigate("/player/round-result");
              return;
            }

            if (state.game.status === "ended") {
              navigate("/player/final");
              return;
            }

            void load();
          })
          .catch(() => {
            void load();
          });
      },
      currentSession.playerId
    );

    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }

      if (!shouldPoll()) {
        clearPollTimer();
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

            const statusChanged =
              state.game.status !== game?.status || state.game.currentRound !== game?.currentRound;
            const survivalChanged =
              state.game.mode === "survival" && state.player.status !== player?.status;

            if (statusChanged || survivalChanged || state.game.hasPublishedResult) {
              if (state.game.status === "round_result" || state.game.hasPublishedResult) {
                navigate("/player/round-result");
                return;
              }

              if (state.game.status === "ended") {
                navigate("/player/final");
                return;
              }

              void load();
            }
          })
          .catch(() => {
            // ignore
          })
          .finally(() => {
            isPolling = false;
            scheduleNextPoll();
          });
      }, getPollDelay());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isPolling) {
        void load().finally(() => {
          scheduleNextPoll();
        });
      } else if (document.visibilityState !== "visible") {
        clearPollTimer();
      }
    };

    scheduleNextPoll();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearPollTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribe();
    };
  }, [game?.currentRound, game?.status, navigate, session]);

  useEffect(() => {
    if (!session || !game || !question || !answer?.selectedOption) {
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

    let cancelled = false;
    let timer: number | null = null;

    const queueRetry = (delayMs: number) => {
      if (cancelled) {
        return;
      }

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(() => {
        void runRetry();
      }, delayMs);
    };

    const runRetry = async () => {
      if (cancelled) {
        return;
      }

      const latestPendingAnswer = getPendingAnswerSession();
      if (
        !latestPendingAnswer ||
        latestPendingAnswer.gameId !== session.gameId ||
        latestPendingAnswer.playerId !== session.playerId ||
        latestPendingAnswer.roundNo !== game.currentRound ||
        latestPendingAnswer.questionId !== question.id ||
        latestPendingAnswer.selectedOption !== pendingAnswer.selectedOption
      ) {
        return;
      }

      if (submitInFlightRef.current) {
        queueRetry(2000);
        return;
      }

      setIsRecoveringPendingAnswer(true);
      submitInFlightRef.current = true;

      try {
        await submitAnswerWithTimeout({
          gameId: game.id,
          playerId: session.playerId,
          questionId: question.id,
          roundNo: game.currentRound,
          selectedOption: latestPendingAnswer.selectedOption,
          answeredAt: latestPendingAnswer.answeredAt
        });
        if (!cancelled) {
          clearPendingAnswerSession();
          setError("");
        }
      } catch (submissionError) {
        if (!cancelled) {
          setError(
            submissionError instanceof Error ? submissionError.message : "答案送出較慢，系統會自動重試。"
          );
          queueRetry(2000);
        }
      } finally {
        submitInFlightRef.current = false;
        if (!cancelled) {
          setIsSubmitting(false);
          setIsRecoveringPendingAnswer(false);
        }
      }
    };

    queueRetry(1500);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [
    answer?.selectedOption,
    game?.currentRound,
    game?.id,
    game?.status,
    question?.id,
    session?.gameId,
    session?.playerId
  ]);

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

      if (prepMs === 0 && nextRemainingMs === 0 && !answer && !answerLockRef.current) {
        answerLockRef.current = true;
        setAnswer(createTimeoutAnswer(session.playerId, question.id, game.currentRound, durationMs));
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
    Boolean(game.startedAt) &&
    new Date(game.startedAt as string).getTime() > Date.now();

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
    answerLockRef.current = true;
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
      submitInFlightRef.current = true;
      await submitAnswerWithTimeout({
        gameId: game.id,
        playerId: session.playerId,
        questionId: question.id,
        roundNo: game.currentRound,
        selectedOption: option,
        answeredAt
      });
      clearPendingAnswerSession();
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "答案送出較慢，系統會自動重試。"
      );
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (!game || !question) {
    return (
      <div className="player-layout">
        <SectionCard title="正在載入題目">
          <p>請稍候，系統正在同步最新題目。</p>
        </SectionCard>
      </div>
    );
  }

  const timeoutLocked =
    game.mode === "competition" &&
    answer?.answerStatus === "no_answer" &&
    !answer.selectedOption;
  const answerLocked = Boolean(answer);
  const submittedOption = answer?.selectedOption ?? "-";
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
              {isPreparePhase
                ? `共同倒數 ${prepSeconds ?? 1} 秒`
                : `剩餘 ${remainingSeconds ?? game.competitionSeconds} 秒`}
            </span>
          ) : (
            <span className="pill pill--accent">不限時作答</span>
          )}
        </div>
        <h1>{question.prompt}</h1>
      </section>

      <SectionCard
        title={answerLocked ? "答案已鎖定" : "請選擇答案"}
        subtitle={
          answerLocked
            ? "系統會持續同步送出結果，主持人公布後會自動切到結果頁。"
            : player
              ? `${player.nickname}，請在題目時間內完成作答。`
              : undefined
        }
      >
        {answerLocked ? (
          <div className={`result-box ${timeoutLocked ? "result-box--danger" : ""}`}>
            <strong>{timeoutLocked ? "已超過作答時間" : `已鎖定：${submittedOption}`}</strong>
            <p>
              {timeoutLocked
                ? "本題已逾時，系統將以未作答 / 作答錯誤處理。"
                : isSubmitting || isRecoveringPendingAnswer
                  ? "答案送出中，系統若未收到會自動補送。"
                  : "答案已鎖定，等待主持人公布結果。"}
            </p>
            {elapsedSeconds ? <p>本題用時：{elapsedSeconds} 秒</p> : null}
          </div>
        ) : isPreparePhase ? (
          <div className="result-box">
            <strong>{prepSeconds ?? 1}</strong>
            <p>題目已送達，倒數結束後才會開始正式作答。</p>
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
