import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchJoinableGames, fetchJoinStats, joinGameRecord } from "../../lib/gameApi";
import { setPlayerSession } from "../../lib/playerSession";
import type { LiveGame } from "../../types/domain";

function formatMode(mode: LiveGame["mode"]) {
  return mode === "competition" ? "競賽模式" : "淘汰賽模式";
}

function formatStatus(status: LiveGame["status"]) {
  const map: Record<LiveGame["status"], string> = {
    draft: "草稿",
    registering: "報名中",
    live_question: "作答中",
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
  const [joinStats, setJoinStats] = useState("請選擇一個場次後，再填寫資料加入。");
  const [isLoadingGames, setIsLoadingGames] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      try {
        setIsLoadingGames(true);
        const availableGames = await fetchJoinableGames();
        if (cancelled) {
          return;
        }

        setGames(availableGames);
        if (presetJoinCode) {
          setSelectedGame(
            availableGames.find((game) => game.joinCode === presetJoinCode) ?? null
          );
        } else {
          setSelectedGame(availableGames[0] ?? null);
        }
      } catch {
        if (!cancelled) {
          setJoinStats("場次清單載入失敗，請稍後再試。");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGames(false);
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
        if (!cancelled) {
          if (presetJoinCode) {
            setJoinStats("這個 QR code 對應的場次目前不可加入，請向主持人確認。");
          } else {
            setJoinStats("請先選擇一個場次，再填寫資料。");
          }
        }
        return;
      }

      try {
        const result = await fetchJoinStats(selectedGame.joinCode);
        if (!result.game) {
          if (!cancelled) {
            setJoinStats("找不到這個場次，請重新選擇。");
          }
          return;
        }

        if (!cancelled) {
          setJoinStats(`目前已有 ${result.playerCount} 位玩家加入，狀態為 ${formatStatus(result.game.status as LiveGame["status"])}。`);
        }
      } catch {
        if (!cancelled) {
          setJoinStats("場次資訊載入失敗，請稍後再試。");
        }
      }
    }

    void loadJoinStats();
    return () => {
      cancelled = true;
    };
  }, [selectedGame, presetJoinCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedGame) {
      setError("請先選擇一個可加入的場次。");
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
        <p className="eyebrow">玩家端 / 掃碼入場</p>
        <h1>選擇場次後填寫資料即可加入</h1>
        <p className="hero-text">
          如果你是掃描主持人提供的 QR code 進來，場次會自動幫你選好。若是手動開啟頁面，也可以直接點選要加入的場次，不需要輸入場次代碼。
        </p>
      </section>

      <SectionCard title="先選擇場次" subtitle={presetJoinCode ? "你是從 QR code 進來的，系統已優先幫你鎖定對應場次。" : "請先點選下方其中一個可加入場次。"}>
        {isLoadingGames ? <p className="inline-success">正在載入可加入場次...</p> : null}
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

      <SectionCard title="玩家資料" subtitle={joinStats}>
        {selectedGame ? (
          <div className="result-box">
            <strong>{selectedGame.title}</strong>
            <p>
              {formatMode(selectedGame.mode)} / {formatStatus(selectedGame.status)}
            </p>
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            暱稱
            <input
              onChange={(event) => setNickname(event.target.value)}
              placeholder="例如：小智"
              value={nickname}
            />
          </label>
          <label>
            部門
            <input
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="例如：資訊部"
              value={department}
            />
          </label>
          <label>
            員編
            <input
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder="例如：A1234"
              value={employeeId}
            />
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
