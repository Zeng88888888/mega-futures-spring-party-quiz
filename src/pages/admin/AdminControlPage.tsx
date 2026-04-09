import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MetricCard } from "../../components/MetricCard";
import { RankList } from "../../components/RankList";
import { SectionCard } from "../../components/SectionCard";
import {
  fetchAdminControlSnapshot,
  fetchGames,
  openRegistrationRecord,
  resetGameRecord,
  resolveCurrentRoundRecord,
  startGameRecord,
  startNextRoundRecord
} from "../../lib/gameApi";
import type { LiveGame, Player, PlayerRoundStatus, Question, RoundResult } from "../../types/domain";

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

export function AdminControlPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preferredGameId = searchParams.get("gameId") ?? "";
  const [games, setGames] = useState<LiveGame[]>([]);
  const [game, setGame] = useState<LiveGame | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);
  const [roundStatuses, setRoundStatuses] = useState<PlayerRoundStatus[]>([]);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function load(targetGameId?: string) {
      try {
        setError("");
        const loadedGames = await fetchGames();
        const currentGame =
          loadedGames.find((item) => item.id === targetGameId) ??
          loadedGames.find((item) => item.id === preferredGameId) ??
          loadedGames[0] ??
          null;

        if (!currentGame || cancelled) {
          if (!cancelled) {
            setGames(loadedGames);
            setGame(null);
            setPlayers([]);
            setLeaderboard([]);
            setQuestion(null);
            setRoundHistory([]);
            setRoundStatuses([]);
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

        setGames(loadedGames);
        setGame(currentGame);
        setPlayers(currentPlayers);
        setLeaderboard(currentLeaderboard.slice(0, currentGame.leaderboardSize || 10));
        setQuestion(snapshot.question);
        setRoundHistory(snapshot.roundHistory);
        setRoundStatuses(snapshot.roundStatuses);
        setSubmittedCount(snapshot.submittedCount);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "讀取控制台失敗，請稍後再試。");
        }
      }
    }

    void load(game?.id);
    timer = window.setInterval(() => {
      void load(game?.id);
    }, 2000);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [game?.id, preferredGameId]);

  const validPlayers = useMemo(() => players.filter((player) => player.valid), [players]);
  const invalidPlayers = useMemo(() => players.filter((player) => !player.valid), [players]);
  const alivePlayers = useMemo(
    () => validPlayers.filter((player) => player.status !== "eliminated"),
    [validPlayers]
  );
  const alivePlayersInRound = useMemo(() => {
    const aliveIds = new Set(roundStatuses.filter((item) => item.survived).map((item) => item.playerId));
    return players.filter((player) => aliveIds.has(player.id));
  }, [players, roundStatuses]);
  const eliminatedPlayersInRound = useMemo(() => {
    const eliminatedIds = new Set(roundStatuses.filter((item) => item.eliminatedInRound).map((item) => item.playerId));
    return players.filter((player) => eliminatedIds.has(player.id));
  }, [players, roundStatuses]);
  const canResolveRound = game?.status === "live_question";
  const canGoNextRound = game?.status === "round_result";

  async function runAction(action: () => Promise<void>) {
    try {
      setError("");
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "執行操作失敗，請稍後再試。");
    }
  }

  async function handleResetGame() {
    if (!game) {
      return;
    }

    const confirmed = window.confirm("重設後會清除本場作答紀錄、每輪結果與分數，確定要重新開始嗎？");
    if (!confirmed) {
      return;
    }

    await runAction(() => resetGameRecord(game.id));
  }

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard subtitle="目前還沒有場次，先建立一場才能開始控制流程。" title="尚未建立場次">
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
          <span className="pill">模式：{formatMode(game.mode)}</span>
          <span className="pill">題庫：{game.bankTitle ?? "-"}</span>
          <span className="pill">目前第 {game.currentRound || 0} 題</span>
          <span className="pill">狀態：{formatStatus(game.status)}</span>
        </div>
        <div className="admin-nav-row">
          <button className="button button--primary" onClick={() => void runAction(() => openRegistrationRecord(game.id))} type="button">
            開始報名
          </button>
          {game.currentRound <= 0 ? (
            <button className="button button--ghost" onClick={() => void runAction(() => startGameRecord(game.id))} type="button">
              開始第一題
            </button>
          ) : null}
          <button
            className="button button--ghost"
            disabled={!canResolveRound}
            onClick={() => void runAction(() => resolveCurrentRoundRecord(game.id))}
            type="button"
          >
            公布結果
          </button>
          <button
            className="button button--ghost"
            disabled={!canGoNextRound}
            onClick={() => void runAction(() => startNextRoundRecord(game.id))}
            type="button"
          >
            下一題
          </button>
          <button className="button button--ghost" onClick={() => void handleResetGame()} type="button">
            重設場次
          </button>
        </div>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}

      <SectionCard subtitle="可切換不同場次查看目前題目、玩家與排行榜。" title="切換場次">
        <div className="form-grid">
          <label>
            目前場次
            <select
              onChange={(event) => {
                const nextId = event.target.value;
                navigate(`/admin/control?gameId=${nextId}`, { replace: true });
              }}
              value={game.id}
            >
              {games.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <div className="grid-4">
        <MetricCard label="有效玩家" tone="accent" value={validPlayers.length} />
        <MetricCard label="無效玩家" tone="danger" value={invalidPlayers.length} />
        <MetricCard
          label="本題已送出"
          value={`${submittedCount} / ${game.mode === "survival" ? alivePlayers.length : validPlayers.length}`}
        />
        <MetricCard label="使用題庫" value={game.bankTitle ?? "-"} />
      </div>

      <div className="grid-2 admin-two-column">
        <SectionCard subtitle="主持人公布結果後，玩家端才會切到結果頁。" title="本題資訊">
          {question ? (
            <div className="stack-md">
              <div className="result-box result-box--compact">
                <strong>Q{game.currentRound}</strong>
                <p>{question.prompt}</p>
              </div>
              <ul className="plain-list">
                {question.options.map((option, index) => (
                  <li key={`${question.id}-${index}`}>
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
          aside={<Link to={`/admin/players?gameId=${game.id}`}>管理玩家</Link>}
          subtitle={game.mode === "competition" ? "無效玩家已自動排除。" : "只顯示目前仍存活的玩家。"}
          title={game.mode === "competition" ? "即時前 10 名" : "存活玩家名單"}
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

      <SectionCard subtitle="淘汰賽會顯示每輪存活與淘汰人數。" title="回合紀錄">
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
              {roundHistory.length === 0 ? (
                <tr>
                  <td colSpan={4}>目前還沒有回合紀錄。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {game.mode === "survival" ? (
        <div className="grid-2 admin-two-column">
          <SectionCard subtitle="本輪公布結果後仍存活的玩家。" title="本輪存活名單">
            {alivePlayersInRound.length > 0 ? (
              <RankList players={alivePlayersInRound} showMeta={false} showScore={false} />
            ) : (
              <p>本輪尚未公布結果，或目前沒有存活名單。</p>
            )}
          </SectionCard>

          <SectionCard subtitle="本輪答錯或未作答而被淘汰的玩家。" title="本輪淘汰名單">
            {eliminatedPlayersInRound.length > 0 ? (
              <RankList players={eliminatedPlayersInRound} showMeta={false} showScore={false} />
            ) : (
              <p>本輪尚未有人被淘汰。</p>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
