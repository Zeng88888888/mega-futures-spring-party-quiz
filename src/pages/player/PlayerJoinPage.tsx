import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { fetchJoinStats, joinGameRecord } from "../../lib/gameApi";
import { setPlayerSession } from "../../lib/playerSession";

export function PlayerJoinPage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [joinCode, setJoinCode] = useState("MEGA2026");
  const [error, setError] = useState("");
  const [joinStats, setJoinStats] = useState("輸入場次代碼後可檢查是否可加入。");

  useEffect(() => {
    let cancelled = false;

    async function loadJoinStats() {
      try {
        const result = await fetchJoinStats(joinCode);
        if (!result.game) {
          if (!cancelled) {
            setJoinStats("找不到這個場次代碼，請確認主持人提供的 QR code。");
          }
          return;
        }

        if (!cancelled) {
          setJoinStats(`目前場次：${result.game.title}，已報名 ${result.playerCount} 人，狀態：${result.game.status}`);
        }
      } catch {
        if (!cancelled) {
          setJoinStats("目前無法讀取場次資訊。");
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
      const { game, player } = await joinGameRecord({ nickname, department, employeeId, joinCode });
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
        <h1>加入本場春酒答題</h1>
        <p className="hero-text">
          請輸入暱稱、部門與員編。場次開始後就不能再加入，同一場次內員編不可重複。
        </p>
      </section>

      <SectionCard title="玩家資料" subtitle={joinStats}>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            暱稱
            <input onChange={(event) => setNickname(event.target.value)} placeholder="例如：小美" value={nickname} />
          </label>
          <label>
            部門
            <input
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="例如：營業一部"
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
          <label>
            場次代碼
            <input onChange={(event) => setJoinCode(event.target.value)} value={joinCode} />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button button--primary" type="submit">
            加入場次
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
