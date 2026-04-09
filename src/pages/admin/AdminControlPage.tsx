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
    round_result: "已公布結果",
    ended: "已結束"
  };

  return map[status] ?? status;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type RoundDetail = {
  roundNo: number;
  publishedAt?: string | null;
  aliveCount: number;
  eliminatedCount: number;
  alivePlayers: Player[];
  eliminatedPlayers: Player[];
};

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
  const [roundStatusHistory, setRoundStatusHistory] = useState<PlayerRoundStatus[]>([]);
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
            setRoundStatusHistory([]);
            setSubmittedCount(0);
          }
          return;
        }

        const snapshot = await fetchAdminControlSnapshot(currentGame.id);
        if (cancelled) {
          return;
        }

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

        setGames(loadedGames);
        setGame(currentGame);
        setPlayers(currentPlayers);
        setLeaderboard(currentLeaderboard.slice(0, currentGame.leaderboardSize || 10));
        setQuestion(snapshot.question);
        setRoundHistory(snapshot.roundHistory);
        setRoundStatuses(snapshot.roundStatuses);
        setRoundStatusHistory(snapshot.roundStatusHistory ?? []);
        setSubmittedCount(snapshot.submittedCount);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "載入控制台資料失敗。");
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
  const currentRoundStatuses = useMemo(() => {
    if (!game) {
      return roundStatuses;
    }

    const fromHistory = roundStatusHistory.filter((item) => item.roundNo === game.currentRound);
    return fromHistory.length > 0 ? fromHistory : roundStatuses;
  }, [game, roundStatuses, roundStatusHistory]);

  const currentAlivePlayers = useMemo(() => {
    const aliveIds = new Set(currentRoundStatuses.filter((item) => item.survived).map((item) => item.playerId));
    return players.filter((player) => aliveIds.has(player.id));
  }, [currentRoundStatuses, players]);

  const currentEliminatedPlayers = useMemo(() => {
    const eliminatedIds = new Set(
      currentRoundStatuses.filter((item) => item.eliminatedInRound).map((item) => item.playerId)
    );
    return players.filter((player) => eliminatedIds.has(player.id));
  }, [currentRoundStatuses, players]);

  const roundDetails = useMemo<RoundDetail[]>(() => {
    const playerMap = new Map(players.map((player) => [player.id, player]));
    const resultMap = new Map(roundHistory.map((item) => [item.roundNo, item]));
    const roundNos = [...new Set([...roundHistory.map((item) => item.roundNo), ...roundStatusHistory.map((item) => item.roundNo)])].sort(
      (left, right) => left - right
    );

    return roundNos.map((roundNo) => {
      const statuses = roundStatusHistory.filter((item) => item.roundNo === roundNo);
      const alivePlayers = statuses
        .filter((item) => item.survived)
        .map((item) => playerMap.get(item.playerId))
        .filter((player): player is Player => Boolean(player));
      const eliminatedPlayers = statuses
        .filter((item) => item.eliminatedInRound)
        .map((item) => playerMap.get(item.playerId))
        .filter((player): player is Player => Boolean(player));
      const baseResult = resultMap.get(roundNo);

      return {
        roundNo,
        publishedAt: baseResult?.publishedAt ?? null,
        aliveCount: statuses.length > 0 ? alivePlayers.length : Number(baseResult?.aliveCount ?? 0),
        eliminatedCount: statuses.length > 0 ? eliminatedPlayers.length : Number(baseResult?.eliminatedCount ?? 0),
        alivePlayers,
        eliminatedPlayers
      };
    });
  }, [players, roundHistory, roundStatusHistory]);

  const canResolveRound = game?.status === "live_question";
  const canGoNextRound = game?.status === "round_result";

  async function runAction(action: () => Promise<void>) {
    try {
      setError("");
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失敗，請稍後再試。");
    }
  }

  async function handleResetGame() {
    if (!game) {
      return;
    }

    const confirmed = window.confirm("確定要重設本場次嗎？所有作答紀錄與回合結果都會清除。");
    if (!confirmed) {
      return;
    }

    await runAction(() => resetGameRecord(game.id));
  }

  function exportRoundPlayers(roundNo: number, kind: "alive" | "eliminated", targetPlayers: Player[]) {
    if (!game) {
      return;
    }

    if (targetPlayers.length === 0) {
      setError(kind === "alive" ? "這一輪沒有存活名單可下載。" : "這一輪沒有淘汰名單可下載。");
      return;
    }

    const rows = [
      ["場次", "回合", "結果", "暱稱", "部門", "員編", "目前狀態"],
      ...targetPlayers.map((player) => [
        game.title,
        String(roundNo),
        kind === "alive" ? "存活" : "淘汰",
        player.nickname,
        player.department,
        player.employeeId,
        player.status
      ])
    ];

    downloadCsv(
      `${game.title}-第${roundNo}題-${kind === "alive" ? "存活明細" : "淘汰明細"}.csv`,
      rows
    );
  }

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard title="尚未建立場次" subtitle="請先建立場次，再進入控制台。">
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
          {game.mode === "competition" ? (
            <span className="pill">每題 {game.competitionSeconds ?? 10} 秒</span>
          ) : (
            <span className="pill">剩餘 {game.survivalThreshold ?? 10} 人內結束</span>
          )}
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

      <SectionCard title="切換場次" subtitle="可以直接切換到其他場次控制台。">
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
        <MetricCard label="已刪除 / 無效玩家" tone="danger" value={invalidPlayers.length} />
        <MetricCard
          label="本題已送出"
          value={`${submittedCount} / ${game.mode === "survival" ? validPlayers.filter((player) => player.status !== "eliminated").length : validPlayers.length}`}
        />
        <MetricCard label="題庫" value={game.bankTitle ?? "-"} />
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
          title={game.mode === "competition" ? `即時前 ${game.leaderboardSize || 10} 名` : "目前存活名單"}
          subtitle={game.mode === "competition" ? "依總分排序，同分比總作答時間。" : "淘汰玩家已自動排除。"}
          aside={<Link to={`/admin/players?gameId=${game.id}`}>管理玩家</Link>}
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

      <SectionCard title="回合摘要" subtitle="每一輪都會顯示存活與淘汰人數。">
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
              {roundDetails.map((item) => (
                <tr key={item.roundNo}>
                  <td>第 {item.roundNo} 題</td>
                  <td>{item.publishedAt ? new Date(item.publishedAt).toLocaleString("zh-TW") : "-"}</td>
                  <td>{item.aliveCount}</td>
                  <td>{item.eliminatedCount}</td>
                </tr>
              ))}
              {roundDetails.length === 0 ? (
                <tr>
                  <td colSpan={4}>目前還沒有已公布的回合紀錄。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {game.mode === "survival" ? (
        <>
          <div className="grid-2 admin-two-column">
            <SectionCard
              title="本輪存活名單"
              subtitle="公布結果後，仍可進入下一輪的玩家。"
              aside={
                <button
                  className="button button--ghost"
                  onClick={() => exportRoundPlayers(game.currentRound, "alive", currentAlivePlayers)}
                  type="button"
                >
                  下載明細
                </button>
              }
            >
              {currentAlivePlayers.length > 0 ? (
                <RankList players={currentAlivePlayers} showMeta={false} showScore={false} />
              ) : (
                <p>本輪尚未產生存活名單。</p>
              )}
            </SectionCard>

            <SectionCard
              title="本輪淘汰名單"
              subtitle="本輪答錯或未作答的玩家。"
              aside={
                <button
                  className="button button--ghost"
                  onClick={() => exportRoundPlayers(game.currentRound, "eliminated", currentEliminatedPlayers)}
                  type="button"
                >
                  下載明細
                </button>
              }
            >
              {currentEliminatedPlayers.length > 0 ? (
                <RankList players={currentEliminatedPlayers} showMeta={false} showScore={false} />
              ) : (
                <p>本輪目前沒有淘汰名單。</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="回合明細" subtitle="可回看每一輪誰存活、誰淘汰。">
            <div className="stack-md">
              {roundDetails.map((item) => (
                <div className="table-card round-detail-card" key={`detail-${item.roundNo}`}>
                  <div className="round-detail-head">
                    <strong>第 {item.roundNo} 題</strong>
                    <span>
                      存活 {item.aliveCount} 人 / 淘汰 {item.eliminatedCount} 人
                    </span>
                  </div>
                  <div className="grid-2">
                    <div>
                      <div className="button-row round-detail-actions">
                        <strong>存活名單</strong>
                        <button
                          className="button button--ghost"
                          onClick={() => exportRoundPlayers(item.roundNo, "alive", item.alivePlayers)}
                          type="button"
                        >
                          下載明細
                        </button>
                      </div>
                      {item.alivePlayers.length > 0 ? (
                        <RankList players={item.alivePlayers} showMeta={false} showScore={false} />
                      ) : (
                        <p>本輪無存活名單。</p>
                      )}
                    </div>

                    <div>
                      <div className="button-row round-detail-actions">
                        <strong>淘汰名單</strong>
                        <button
                          className="button button--ghost"
                          onClick={() => exportRoundPlayers(item.roundNo, "eliminated", item.eliminatedPlayers)}
                          type="button"
                        >
                          下載明細
                        </button>
                      </div>
                      {item.eliminatedPlayers.length > 0 ? (
                        <RankList players={item.eliminatedPlayers} showMeta={false} showScore={false} />
                      ) : (
                        <p>本輪無淘汰名單。</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
