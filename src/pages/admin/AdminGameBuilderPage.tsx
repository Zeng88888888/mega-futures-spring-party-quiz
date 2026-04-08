import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { createGameRecord } from "../../lib/gameApi";
import type { GameMode } from "../../types/domain";

export function AdminGameBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("兆豐期貨春酒搶答賽");
  const [mode, setMode] = useState<GameMode>("competition");
  const [questionCount, setQuestionCount] = useState(10);
  const [joinCode, setJoinCode] = useState("MEGA2026");
  const [leaderboardSize, setLeaderboardSize] = useState(10);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createGameRecord({ title, mode, questionCount, joinCode, leaderboardSize });
    navigate("/admin/games");
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 建立場次</p>
        <h1>建立新的活動場次</h1>
      </section>

      <SectionCard title="基本設定" subtitle="這一版已改成直接建立 Supabase 場次資料。">
        <form className="form-grid form-grid--wide" onSubmit={handleSubmit}>
          <label>
            場次名稱
            <input onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label>
            場次模式
            <select onChange={(event) => setMode(event.target.value as GameMode)} value={mode}>
              <option value="competition">競賽模式</option>
              <option value="survival">淘汰賽模式</option>
            </select>
          </label>
          <label>
            題目數量
            <input onChange={(event) => setQuestionCount(Number(event.target.value))} type="number" value={questionCount} />
          </label>
          <label>
            入場代碼
            <input onChange={(event) => setJoinCode(event.target.value.toUpperCase())} value={joinCode} />
          </label>
          <label>
            排行顯示名次
            <input onChange={(event) => setLeaderboardSize(Number(event.target.value))} type="number" value={leaderboardSize} />
          </label>
          <div className="button-row">
            <button className="button button--primary" type="submit">
              儲存場次
            </button>
            <Link className="button button--ghost" to="/admin/games">
              返回場次列表
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
