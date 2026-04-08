import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../../components/MetricCard";
import { SectionCard } from "../../components/SectionCard";
import { ensureDefaultGame, ensureSeedQuestions, fetchGames, fetchPlayers, fetchQuestions } from "../../lib/gameApi";
import type { LiveGame, Player, Question } from "../../types/domain";

export function AdminGamesPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await ensureSeedQuestions();
      await ensureDefaultGame();
      const [loadedGames, loadedQuestions] = await Promise.all([fetchGames(), fetchQuestions()]);
      const loadedPlayers = loadedGames[0] ? await fetchPlayers(loadedGames[0].id) : [];

      if (!cancelled) {
        setGames(loadedGames);
        setPlayers(loadedPlayers);
        setQuestions(loadedQuestions);
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
        <p className="eyebrow">主持人後台 / 場次列表</p>
        <h1>管理活動場次</h1>
        <div className="cta-row">
          <Link className="button button--primary" to="/admin/games/new">
            建立新場次
          </Link>
          <Link className="button button--ghost" to="/admin/control">
            進入進行中場次
          </Link>
        </div>
      </section>

      <div className="grid-4">
        <MetricCard label="場次總數" value={games.length} tone="accent" />
        <MetricCard label="已加入玩家" value={players.length} />
        <MetricCard label="題庫總題數" value={questions.length} />
        <MetricCard label="無效玩家" value={invalidPlayers} tone="danger" />
      </div>

      <SectionCard title="最近場次" subtitle="這一頁已改成直接讀取 Supabase。">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>場次</th>
                <th>模式</th>
                <th>狀態</th>
                <th>題數</th>
                <th>加入代碼</th>
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
