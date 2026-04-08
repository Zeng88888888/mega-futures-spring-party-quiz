import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchJoinStats, joinGameRecord } from "../../lib/gameApi";
import { setPlayerSession } from "../../lib/playerSession";

export function PlayerJoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetJoinCode = useMemo(
    () => (searchParams.get("code") ?? searchParams.get("joinCode") ?? "").trim().toUpperCase(),
    [searchParams]
  );
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [joinCode, setJoinCode] = useState(presetJoinCode);
  const [error, setError] = useState("");
  const [joinStats, setJoinStats] = useState("請先掃描主持人提供的 QR code，或輸入場次加入碼。");
  const [gameTitle, setGameTitle] = useState("");

  useEffect(() => {
    if (presetJoinCode) {
      setJoinCode(presetJoinCode);
    }
  }, [presetJoinCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadJoinStats() {
      if (!joinCode.trim()) {
        if (!cancelled) {
          setGameTitle("");
          setJoinStats("請先掃描主持人提供的 QR code，或輸入場次加入碼。");
        }
        return;
      }

      try {
        const result = await fetchJoinStats(joinCode);
        if (!result.game) {
          if (!cancelled) {
            setGameTitle("");
            setJoinStats("找不到這個場次，請重新掃描 QR code 或確認連結是否正確。");
          }
          return;
        }

        if (!cancelled) {
          setGameTitle(result.game.title);
          setJoinStats(`目前已有 ${result.playerCount} 位玩家加入，場次狀態為 ${result.game.status}。`);
        }
      } catch {
        if (!cancelled) {
          setGameTitle("");
          setJoinStats("場次資訊載入失敗，請稍後再試。");
        }
      }
    }

    void loadJoinStats();
    return () => {
      cancelled = true;
    };
  }, [joinCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const { game, player } = await joinGameRecord({
        nickname,
        department,
        employeeId,
        joinCode
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
        <h1>掃描 QR code 後填寫資料即可加入</h1>
        <p className="hero-text">
          進入頁面後只要填寫暱稱、部門與員編即可。若你是從主持人提供的 QR code 進來，系統會自動帶入場次，不需要再手動輸入代碼。
        </p>
      </section>

      <SectionCard title="玩家資料" subtitle={joinStats}>
        {gameTitle ? (
          <div className="result-box">
            <strong>{gameTitle}</strong>
            <p>場次已鎖定為這一場，直接填資料即可加入。</p>
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
          {!presetJoinCode ? (
            <label>
              場次加入碼
              <input
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="例如：MEGA2026"
                value={joinCode}
              />
            </label>
          ) : null}
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button button--primary" type="submit">
            加入場次
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
