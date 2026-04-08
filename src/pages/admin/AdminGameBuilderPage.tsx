import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { createGameRecord } from "../../lib/gameApi";
import type { GameMode } from "../../types/domain";

function generateJoinCode() {
  const date = new Date();
  const stamp = `${date.getMonth() + 1}${date.getDate()}${String(date.getHours()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 900 + 100);
  return `MEGA${stamp}${random}`;
}

export function AdminGameBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("兆豐期貨春酒活動");
  const [mode, setMode] = useState<GameMode>("competition");
  const [questionCount, setQuestionCount] = useState(10);
  const [joinCode, setJoinCode] = useState(generateJoinCode);
  const [leaderboardSize, setLeaderboardSize] = useState(10);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await createGameRecord({
        title: title.trim(),
        mode,
        questionCount: Math.max(1, questionCount),
        joinCode: joinCode.trim().toUpperCase(),
        leaderboardSize: Math.max(1, leaderboardSize)
      });
      navigate("/admin/games");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "建立場次失敗，請檢查加入碼是否重複。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 建立場次</p>
        <h1>建立新的遊戲場次</h1>
      </section>

      <SectionCard title="場次設定" subtitle="建立後會回到場次列表，你也可以再從控制台開始遊戲。">
        <form className="form-grid form-grid--wide" onSubmit={handleSubmit}>
          <label>
            場次名稱
            <input onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label>
            遊戲模式
            <select onChange={(event) => setMode(event.target.value as GameMode)} value={mode}>
              <option value="competition">競賽模式</option>
              <option value="survival">淘汰賽模式</option>
            </select>
          </label>
          <label>
            題目數量
            <input
              min={1}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              type="number"
              value={questionCount}
            />
          </label>
          <label>
            玩家加入碼
            <input onChange={(event) => setJoinCode(event.target.value.toUpperCase())} value={joinCode} />
          </label>
          <label>
            榜單顯示名次
            <input
              min={1}
              onChange={(event) => setLeaderboardSize(Number(event.target.value))}
              type="number"
              value={leaderboardSize}
            />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <div className="button-row">
            <button className="button button--primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "建立中..." : "儲存場次"}
            </button>
            <button
              className="button button--ghost"
              onClick={() => setJoinCode(generateJoinCode())}
              type="button"
            >
              重新產生加入碼
            </button>
            <Link className="button button--ghost" to="/admin/games">
              回場次列表
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
