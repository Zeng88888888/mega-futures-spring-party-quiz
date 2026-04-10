import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchPlayerSnapshot, fetchPlayerState, subscribeToGameRealtime } from "../../lib/gameApi";
import { getPlayerSession } from "../../lib/playerSession";
import type { LiveGame, Player } from "../../types/domain";

function formatStatus(status?: LiveGame["status"]) {
  const map: Record<LiveGame["status"], string> = {
    draft: "草稿",
    registering: "報名中",
    live_question: "進行中",
    round_result: "公佈結果",
    ended: "已結束"
  };
  return status ? map[status] ?? status : "-";
}

export function PlayerWaitingPage() {
  const navigate = useNavigate();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const session = getPlayerSession();

  useEffect(() => {
    const currentSession = session;
    if (!currentSession) {
      navigate("/player/join");
      return;
    }
    const sessionData = currentSession;

    let cancelled = false;
    let timer: number | null = null;
    let isPolling = false;

    const shouldPoll = () =>
      document.visibilityState === "visible" && game?.status !== "ended";
    const getPollDelay = () => 5000;
    const clearPollTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    async function load() {
      const snapshot = await fetchPlayerSnapshot(sessionData.gameId, sessionData.playerId);
      if (cancelled) {
        return;
      }

      setGame(snapshot.game);
      setPlayer(snapshot.player);

      if (snapshot.game?.status === "live_question") {
        navigate("/player/question");
      } else if (snapshot.game?.status === "round_result") {
        navigate("/player/round-result");
      } else if (snapshot.game?.status === "ended") {
        navigate("/player/final");
      }
    }

    void load();
    const unsubscribe = subscribeToGameRealtime(sessionData.gameId, () => {
      void fetchPlayerState(sessionData.gameId, sessionData.playerId)
        .then((state) => {
          if (cancelled) {
            return;
          }

          if (state.game.status === "live_question") {
            navigate("/player/question");
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
    }, sessionData.playerId);
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
        void fetchPlayerState(sessionData.gameId, sessionData.playerId)
          .then((state) => {
            if (cancelled) {
              return;
            }

            if (
              state.game.status !== game?.status ||
              state.game.currentRound !== game?.currentRound ||
              state.game.hasPublishedResult
            ) {
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

  return (
    <div className="player-layout">
      <section className="player-stage">
        <p className="eyebrow">玩家端</p>
        <h1>等待主持人開始</h1>
      </section>

      <SectionCard title="目前資訊">
        <div className="pill-row">
          <span className="pill">場次：{game?.title ?? "-"}</span>
          <span className="pill">狀態：{formatStatus(game?.status)}</span>
          <span className="pill">
            玩家：{player ? `${player.nickname} / ${player.department} / ${player.employeeId}` : "-"}
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
