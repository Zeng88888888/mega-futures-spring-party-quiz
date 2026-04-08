import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../../components/MetricCard";
import { SectionCard } from "../../components/SectionCard";
import {
  ensureDefaultGame,
  ensureSeedQuestions,
  fetchGames,
  fetchPlayers,
  fetchQuestions
} from "../../lib/gameApi";
import type { LiveGame, Player, Question } from "../../types/domain";

export function AdminGamesPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError("");
        await ensureSeedQuestions();
        await ensureDefaultGame();
        const [loadedGames, loadedQuestions] = await Promise.all([fetchGames(), fetchQuestions()]);
        const loadedPlayers = loadedGames[0] ? await fetchPlayers(loadedGames[0].id) : [];

        if (!cancelled) {
          setGames(loadedGames);
          setPlayers(loadedPlayers);
          setQuestions(loadedQuestions);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "後台資料載入失敗。");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const invalidPlayers = players.filter((player) => !player.valid).length;

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 場次總覽</p>
        <h1>春酒遊戲控制首頁</h1>
        <div className="cta-row">
          <Link className="button button--primary" to="/admin/games/new">
            建立新場次
          </Link>
          <Link className="button button--ghost" to="/admin/control">
            進入控制台
          </Link>
          <Link className="button button--ghost" to="/admin/players">
            玩家管理
          </Link>
          <Link className="button button--ghost" to="/admin/questions">
            題庫管理
          </Link>
          <Link className="button button--ghost" to="/admin/import">
            匯入題目
          </Link>
        </div>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="grid-4">
        <MetricCard label="場次數量" value={games.length} tone="accent" />
        <MetricCard label="玩家數量" value={players.length} />
        <MetricCard label="題庫題數" value={questions.length} />
        <MetricCard label="無效玩家" value={invalidPlayers} tone="danger" />
      </div>

      <SectionCard title="快速入口" subtitle="你要找的題庫管理和匯入題目都放在這裡。">
        <div className="cta-row">
          <Link className="button button--primary" to="/admin/questions">
            新增 / 編輯題目
          </Link>
          <Link className="button button--ghost" to="/admin/import">
            CSV / Excel 匯入
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="場次列表" subtitle="目前已建立的場次與加入碼。">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>場次名稱</th>
                <th>模式</th>
                <th>狀態</th>
                <th>題目數</th>
                <th>加入碼</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td>{game.title}</td>
                  <td>{game.mode === "competition" ? "競賽模式" : "淘汰賽模式"}</td>
                  <td>{game.status}</td>
                  <td>{game.questionCount}</td>
                  <td>{game.joinCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
