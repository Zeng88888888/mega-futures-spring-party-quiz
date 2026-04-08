import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../../components/MetricCard";
import { RankList } from "../../components/RankList";
import { SectionCard } from "../../components/SectionCard";
import {
  fetchAdminControlSnapshot,
  fetchGameById,
  fetchGames,
  openRegistrationRecord,
  resolveCurrentRoundRecord,
  startGameRecord,
  startNextRoundRecord,
} from "../../lib/gameApi";
import type { LiveGame, Player, Question, RoundResult } from "../../types/domain";

export function AdminControlPage() {
  const [game, setGame] = useState<LiveGame | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function load(targetGameId?: string) {
      const games = targetGameId ? [await fetchGameById(targetGameId)].filter(Boolean) : await fetchGames();
      const currentGame = (games[0] as LiveGame | undefined) ?? null;

      if (!currentGame) {
        if (!cancelled) {
          setGame(null);
          setPlayers([]);
          setLeaderboard([]);
          setQuestion(null);
          setRoundHistory([]);
          setSubmittedCount(0);
        }
        return;
      }

      const snapshot = await fetchAdminControlSnapshot(currentGame.id);
      const currentPlayers = snapshot.players;
      const currentLeaderboard = [...currentPlayers]
        .filter((player) => player.valid)
        .sort((left, right) => {
          if (currentGame.mode === "competition") {
            if (right.score !== left.score) {
              return right.score - left.score;
            }
            return (left.totalMs ?? 0) - (right.totalMs ?? 0);
          }
          const leftAlive = left.status !== "eliminated";
          const rightAlive = right.status !== "eliminated";
          if (leftAlive !== rightAlive) {
            return leftAlive ? -1 : 1;
          }
          return (left.joinedAt ?? "").localeCompare(right.joinedAt ?? "");
        });

      if (cancelled) {
        return;
      }

      setGame(currentGame);
      setPlayers(currentPlayers);
      setLeaderboard(currentLeaderboard.slice(0, currentGame.leaderboardSize || 10));
      setQuestion(snapshot.question);
      setRoundHistory(snapshot.roundHistory);
      setSubmittedCount(snapshot.submittedCount);
    }

    void load();
    timer = window.setInterval(() => {
      void load(game?.id);
    }, 2000);
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [game?.id]);

  const validPlayers = players.filter((player) => player.valid);
  const invalidPlayers = players.filter((player) => !player.valid);
  const alivePlayers = validPlayers.filter((player) => player.status !== "eliminated");

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard title="尚無場次" subtitle="先建立一個場次，再回到控台操作。">
          <Link className="button button--primary" to="/admin/games/new">
            建立新場次
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 場次控制台</p>
        <h1>{game.title}</h1>
        <div className="pill-row">
          <span className="pill">模式：{game.mode === "competition" ? "競賽模式" : "淘汰賽模式"}</span>
          <span className="pill">目前第 {game.currentRound || 0} 題</span>
          <span className="pill">狀態：{game.status}</span>
        </div>
        <div className="cta-row">
          <button className="button button--primary" onClick={() => void openRegistrationRecord(game.id)} type="button">
            開始報名
          </button>
          {game.currentRound <= 0 ? (
            <button className="button button--ghost" onClick={() => void startGameRecord(game.id)} type="button">
              開始第一題
            </button>
          ) : null}
          <button className="button button--ghost" onClick={() => void resolveCurrentRoundRecord(game.id)} type="button">
            公布結果
          </button>
          <button className="button button--ghost" onClick={() => void startNextRoundRecord(game.id)} type="button">
            下一題
          </button>
        </div>
      </section>

      <div className="grid-4">
        <MetricCard label="有效玩家" value={validPlayers.length} tone="accent" />
        <MetricCard label="無效玩家" value={invalidPlayers.length} tone="danger" />
        <MetricCard label="本題已送出" value={`${submittedCount} / ${game.mode === "survival" ? alivePlayers.length : validPlayers.length}`} />
        <MetricCard label="入場網址代碼" value={game.joinCode} />
      </div>

      <div className="grid-2">
        <SectionCard title="本題資訊" subtitle="主持人公布結果後，玩家端會即時切到結果頁。">
          {question ? (
            <div className="stack-md">
              <div className="result-box">
                <strong>Q{game.currentRound}</strong>
                <p>{question.prompt}</p>
              </div>
              <ul className="plain-list">
                <li>模式：{game.mode === "competition" ? "競賽模式" : "淘汰賽模式"}</li>
                <li>已送出：{submittedCount} 人</li>
                <li>
                  可參與人數：
                  {game.mode === "survival" ? alivePlayers.length : validPlayers.length} 人
                </li>
                <li>正確答案：公布後由系統自動計算本輪結果</li>
              </ul>
            </div>
          ) : (
            <p>目前尚未進入題目回合。</p>
          )}
        </SectionCard>

        <SectionCard
          title={game.mode === "competition" ? "即時前 10 名" : "目前存活名單"}
          subtitle="無效玩家已自動排除。"
          aside={<Link to="/admin/players">管理玩家</Link>}
        >
          <RankList
            players={
              game.mode === "competition"
                ? leaderboard
                : leaderboard.filter((player) => player.status !== "eliminated")
            }
            showMeta={false}
            showScore={game.mode === "competition"}
          />
        </SectionCard>
      </div>

      <SectionCard title="輪次紀錄" subtitle="淘汰賽可在這裡看到每輪剩餘存活與淘汰人數。">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>輪次</th>
                <th>公布時間</th>
                <th>存活</th>
                <th>淘汰</th>
              </tr>
            </thead>
            <tbody>
              {roundHistory.map((item) => (
                <tr key={item.roundNo}>
                  <td>第 {item.roundNo} 輪</td>
                  <td>{item.publishedAt ? new Date(item.publishedAt).toLocaleString("zh-TW") : "-"}</td>
                  <td>{item.aliveCount ?? "-"}</td>
                  <td>{item.eliminatedCount ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
