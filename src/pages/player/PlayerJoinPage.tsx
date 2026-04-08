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
    live_question: "答題中",
    round_result: "公布結果",
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
  const [error, setError] = useState("");
  const [joinStats, setJoinStats] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      const availableGames = await fetchJoinableGames();
      if (cancelled) {
        return;
      }

      setGames(availableGames);
      if (presetJoinCode) {
        setSelectedGame(availableGames.find((game) => game.joinCode === presetJoinCode) ?? null);
      } else {
        setSelectedGame(availableGames[0] ?? null);
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

      const result = await fetchJoinStats(selectedGame.joinCode);
      if (cancelled || !result.game) {
        return;
      }

      setJoinStats(`目前 ${result.playerCount} 人已加入`);
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
        nickname,
        department,
        employeeId,
        joinCode: selectedGame.joinCode
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
        <p className="eyebrow">玩家端</p>
        <h1>加入場次</h1>
      </section>

      {!presetJoinCode ? (
        <SectionCard title="選擇場次" subtitle="點選要加入的場次。">
          <div className="join-game-grid">
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

      <SectionCard title="填寫資料" subtitle={joinStats || "請填寫暱稱、部門與員編。"}>
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
            <input onChange={(event) => setNickname(event.target.value)} placeholder="例如：小智" value={nickname} />
          </label>
          <label>
            部門
            <input onChange={(event) => setDepartment(event.target.value)} placeholder="例如：資訊部" value={department} />
          </label>
          <label>
            員編
            <input onChange={(event) => setEmployeeId(event.target.value)} placeholder="例如：A1234" value={employeeId} />
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
