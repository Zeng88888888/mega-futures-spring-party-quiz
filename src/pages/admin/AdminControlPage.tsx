import { useEffect, useMemo, useState } from "react";
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
  startNextRoundRecord
} from "../../lib/gameApi";
import type { LiveGame, Player, Question, RoundResult } from "../../types/domain";

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

      if (!currentGame || cancelled) {
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

  const validPlayers = useMemo(() => players.filter((player) => player.valid), [players]);
  const invalidPlayers = useMemo(() => players.filter((player) => !player.valid), [players]);
  const alivePlayers = useMemo(
    () => validPlayers.filter((player) => player.status !== "eliminated"),
    [validPlayers]
  );

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard title="尚未建立場次" subtitle="請先建立場次後再進入控制台。">
          <Link className="button button--primary" to="/admin/games/new">
            建立場次
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
          <span className="pill">模式：{formatMode(game.mode)}</span>
          <span className="pill">題庫：{game.bankTitle ?? "未指定"}</span>
          <span className="pill">目前第 {game.currentRound || 0} 題</span>
          <span className="pill">狀態：{formatStatus(game.status)}</span>
        </div>
        <div className="admin-nav-row">
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
        <MetricCard label="入場代碼" value={game.joinCode} />
      </div>

      <div className="grid-2 admin-two-column">
        <SectionCard title="本題資訊" subtitle="主持人公布結果後，玩家端會同步切到結果頁。">
          {question ? (
            <div className="stack-md">
              <div className="result-box result-box--compact">
                <strong>Q{game.currentRound}</strong>
                <p>{question.prompt}</p>
              </div>
              <ul className="plain-list">
                {question.options.map((option, index) => (
                  <li key={option}>
                    {String.fromCharCode(65 + index)}. {option}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>目前尚未進入題目回合。</p>
          )}
        </SectionCard>

        <SectionCard
          title={game.mode === "competition" ? "即時前 10 名" : "目前存活名單"}
          subtitle="無效玩家會自動排除。"
          aside={<Link to="/admin/players">管理玩家</Link>}
        >
          <RankList
            players={game.mode === "competition" ? leaderboard : leaderboard.filter((player) => player.status !== "eliminated")}
            showMeta={false}
            showScore={game.mode === "competition"}
          />
        </SectionCard>
      </div>

      <SectionCard title="每輪紀錄" subtitle="淘汰賽可查看每一輪剩餘與淘汰人數。">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>回合</th>
                <th>公布時間</th>
                <th>存活</th>
                <th>淘汰</th>
              </tr>
            </thead>
            <tbody>
              {roundHistory.map((item) => (
                <tr key={item.roundNo}>
                  <td>第 {item.roundNo} 題</td>
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
