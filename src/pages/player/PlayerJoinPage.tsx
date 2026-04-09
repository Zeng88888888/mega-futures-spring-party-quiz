import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchJoinStats, fetchJoinableGames, joinGameRecord } from "../../lib/gameApi";
import { setPlayerSession } from "../../lib/playerSession";
import type { LiveGame } from "../../types/domain";

function formatMode(mode: LiveGame["mode"]) {
  return mode === "competition" ? "競賽模式" : "淘汰賽模式";
}

function formatStatus(status: LiveGame["status"]) {
  const map: Record<LiveGame["status"], string> = {
    draft: "草稿",
    registering: "報名中",
    live_question: "進行中",
    round_result: "公佈結果",
    ended: "已結束"
  };
  return map[status] ?? status;
}

export function PlayerJoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetJoinCode = useMemo(
    () => (searchParams.get("code") ?? searchParams.get("joinCode") ?? "").trim().toUpperCase(),
    [searchParams]
  );

  const [games, setGames] = useState<LiveGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [joinStats, setJoinStats] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      try {
        const availableGames = await fetchJoinableGames();
        if (cancelled) {
          return;
        }

        setGames(availableGames);
        if (presetJoinCode) {
          const matchedGame = availableGames.find((game) => game.joinCode === presetJoinCode) ?? null;
          if (matchedGame) {
            setSelectedGame(matchedGame);
          } else {
            const stats = await fetchJoinStats(presetJoinCode);
            if (cancelled) {
              return;
            }

            if (stats.game) {
              setSelectedGame({
                id: stats.game.id,
                title: stats.game.title,
                mode: stats.game.mode as LiveGame["mode"],
                status: stats.game.status as LiveGame["status"],
                bankId: "",
                bankTitle: "",
                questionCount: stats.game.questionCount,
                currentRound: 0,
                joinCode: presetJoinCode,
                competitionSeconds: null,
                survivalThreshold: null,
                leaderboardSize: 10,
                startedAt: null,
                endedAt: null
              });
            } else {
              setSelectedGame(null);
            }
          }
        } else {
          setSelectedGame(availableGames[0] ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "讀取場次失敗。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadGames();
    return () => {
      cancelled = true;
    };
  }, [presetJoinCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadJoinStats() {
      if (!selectedGame) {
        setJoinStats("");
        return;
      }

      try {
        const result = await fetchJoinStats(selectedGame.joinCode);
        if (cancelled || !result.game) {
          return;
        }
        setJoinStats(`目前已有 ${result.playerCount} 位玩家加入`);
      } catch {
        if (!cancelled) {
          setJoinStats("");
        }
      }
    }

    void loadJoinStats();
    return () => {
      cancelled = true;
    };
  }, [selectedGame]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedGame) {
      setError("請先選擇場次。");
      return;
    }

    try {
      const { game, player } = await joinGameRecord({
        joinCode: selectedGame.joinCode,
        nickname,
        department,
        employeeId
      });
      setPlayerSession({ gameId: game.id, playerId: player.id });
      navigate("/player/waiting");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "加入場次失敗。");
    }
  }

  return (
    <div className="player-layout">
      <section className="player-stage">
        <p className="eyebrow">玩家端 / 掃碼入場</p>
        <h1>選擇場次後填寫資料即可加入</h1>
      </section>

      {!presetJoinCode ? (
        <SectionCard title="場次列表">
          <div className="join-game-grid">
            {games.length === 0 && !isLoading ? <p>目前沒有可加入的場次。</p> : null}
            {games.map((game) => (
              <button
                className={`join-game-card${selectedGame?.id === game.id ? " join-game-card--active" : ""}`}
                key={game.id}
                onClick={() => setSelectedGame(game)}
                type="button"
              >
                <strong>{game.title}</strong>
                <span>{formatMode(game.mode)}</span>
                <span>{formatStatus(game.status)}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="玩家資料" subtitle={joinStats || undefined}>
        {selectedGame ? (
          <div className="result-box result-box--compact">
            <strong>{selectedGame.title}</strong>
            <p>
              {formatMode(selectedGame.mode)} / {formatStatus(selectedGame.status)}
            </p>
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            暱稱
            <input onChange={(event) => setNickname(event.target.value)} value={nickname} />
          </label>
          <label>
            部門
            <input onChange={(event) => setDepartment(event.target.value)} value={department} />
          </label>
          <label>
            員編
            <input onChange={(event) => setEmployeeId(event.target.value)} value={employeeId} />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button button--primary" disabled={!selectedGame} type="submit">
            加入場次
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
