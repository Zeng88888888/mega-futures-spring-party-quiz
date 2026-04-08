import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { MetricCard } from "../../components/MetricCard";
import { SectionCard } from "../../components/SectionCard";
import { deleteGameRecord, fetchGames, fetchPlayers, fetchQuestionBanks } from "../../lib/gameApi";
import type { LiveGame, Player, QuestionBank } from "../../types/domain";

function getPlayerJoinUrl(joinCode: string) {
  if (typeof window === "undefined") {
    return `/player/join?code=${encodeURIComponent(joinCode)}`;
  }

  return `${window.location.origin}/player/join?code=${encodeURIComponent(joinCode)}`;
}

function formatMode(mode: LiveGame["mode"]) {
  return mode === "competition" ? "競賽模式" : "淘汰賽模式";
}

function formatStatus(status: LiveGame["status"]) {
  const map: Record<LiveGame["status"], string> = {
    draft: "草稿",
    registering: "報名中",
    live_question: "進行中",
    round_result: "公佈結果",
    ended: "已結束"
  };
  return map[status] ?? status;
}

export function AdminGamesPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<LiveGame[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [error, setError] = useState("");
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboard(preferredGameId?: string) {
    const [loadedGames, loadedBanks] = await Promise.all([fetchGames(), fetchQuestionBanks()]);
    setGames(loadedGames);
    setBanks(loadedBanks);

    const activeGame =
      loadedGames.find((game) => game.id === preferredGameId) ??
      loadedGames.find((game) => game.id === selectedGame?.id) ??
      loadedGames[0] ??
      null;

    setSelectedGame(activeGame);
    if (activeGame) {
      setPlayers(await fetchPlayers(activeGame.id));
    } else {
      setPlayers([]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError("");
        setIsLoading(true);
        await loadDashboard();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "讀取場次列表失敗。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayersForSelectedGame() {
      if (!selectedGame) {
        setPlayers([]);
        return;
      }

      try {
        const loadedPlayers = await fetchPlayers(selectedGame.id);
        if (!cancelled) {
          setPlayers(loadedPlayers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "讀取玩家資料失敗。");
        }
      }
    }

    void loadPlayersForSelectedGame();
    return () => {
      cancelled = true;
    };
  }, [selectedGame]);

  useEffect(() => {
    let cancelled = false;

    async function generateQrCode() {
      if (!selectedGame) {
        setQrCodeUrl("");
        return;
      }

      const dataUrl = await QRCode.toDataURL(getPlayerJoinUrl(selectedGame.joinCode), {
        width: 220,
        margin: 1,
        color: {
          dark: "#7f140d",
          light: "#fffdf8"
        }
      });

      if (!cancelled) {
        setQrCodeUrl(dataUrl);
      }
    }

    void generateQrCode();
    return () => {
      cancelled = true;
    };
  }, [selectedGame]);

  const invalidPlayers = useMemo(() => players.filter((player) => !player.valid).length, [players]);
  const totalQuestions = useMemo(
    () => banks.reduce((sum, bank) => sum + (bank.questionCount ?? 0), 0),
    [banks]
  );
  const joinUrl = selectedGame ? getPlayerJoinUrl(selectedGame.joinCode) : "";

  async function handleCopyLink() {
    if (!joinUrl) {
      return;
    }

    await navigator.clipboard.writeText(joinUrl);
    setCopyMessage("玩家連結已複製。");
    window.setTimeout(() => setCopyMessage(""), 2200);
  }

  async function handleDelete(game: LiveGame) {
    const confirmed = window.confirm(`確定要刪除場次「${game.title}」嗎？`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      await deleteGameRecord(game.id);
      await loadDashboard(selectedGame?.id === game.id ? undefined : selectedGame?.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除場次失敗。");
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 場次總覽</p>
        <h1>春酒遊戲控制首頁</h1>
        <div className="admin-nav-row">
          <Link className="button button--primary" to="/admin/games/new">
            建立新場次
          </Link>
          <Link className="button button--ghost" to={selectedGame ? `/admin/control?gameId=${selectedGame.id}` : "/admin/control"}>
            進入控制台
          </Link>
          <Link className="button button--ghost" to={selectedGame ? `/admin/players?gameId=${selectedGame.id}` : "/admin/players"}>
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
      {isLoading ? <p className="inline-success">載入場次資料中...</p> : null}

      <div className="grid-4">
        <MetricCard label="場次數量" tone="accent" value={games.length} />
        <MetricCard label="玩家數量" value={players.length} />
        <MetricCard label="題庫題數" value={totalQuestions} />
        <MetricCard label="無效玩家" tone="danger" value={invalidPlayers} />
      </div>

      <div className="grid-2 admin-two-column">
        <SectionCard subtitle="題庫管理與匯入題目都放在這裡。" title="快速入口">
          <div className="button-row">
            <Link className="button button--primary" to="/admin/questions">
              新增 / 編輯題目
            </Link>
            <Link className="button button--ghost" to="/admin/import">
              CSV / Excel 匯入
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          subtitle="選一個場次後，玩家掃碼就能直接填資料加入，不必再輸入加入碼。"
          title="玩家入場 QR code"
        >
          {selectedGame ? (
            <div className="stack-md">
              <div className="pill-row">
                <span className="pill">目前場次：{selectedGame.title}</span>
                <span className="pill">模式：{formatMode(selectedGame.mode)}</span>
                <span className="pill">題庫：{selectedGame.bankTitle ?? "-"}</span>
                <span className="pill">狀態：{formatStatus(selectedGame.status)}</span>
              </div>

              {qrCodeUrl ? (
                <div className="qr-card">
                  <img alt={`${selectedGame.title} 玩家入場 QR code`} className="qr-preview" src={qrCodeUrl} />
                </div>
              ) : null}

              <label className="form-grid">
                <span className="status-note">玩家連結</span>
                <input className="mono-input" readOnly value={joinUrl} />
              </label>

              {copyMessage ? <p className="inline-success">{copyMessage}</p> : null}

              <div className="button-row">
                <button className="button button--primary" onClick={() => void handleCopyLink()} type="button">
                  複製玩家連結
                </button>
                <a className="button button--ghost" download={`${selectedGame.joinCode}-qr.png`} href={qrCodeUrl || undefined}>
                  下載 QR code
                </a>
              </div>
            </div>
          ) : (
            <p>請先建立場次。</p>
          )}
        </SectionCard>
      </div>

      <SectionCard subtitle="點選某一場即可切換右側 QR code 與管理入口。" title="場次列表">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>場次名稱</th>
                <th>模式</th>
                <th>狀態</th>
                <th>題庫</th>
                <th>題目數</th>
                <th>玩家入口</th>
                <th>管理</th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 ? (
                <tr>
                  <td colSpan={7}>目前還沒有場次。</td>
                </tr>
              ) : null}
              {games.map((game) => (
                <tr key={game.id}>
                  <td>
                    <button className="link-button" onClick={() => setSelectedGame(game)} type="button">
                      {game.title}
                    </button>
                  </td>
                  <td>{formatMode(game.mode)}</td>
                  <td>{formatStatus(game.status)}</td>
                  <td>{game.bankTitle ?? "-"}</td>
                  <td>{game.questionCount}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => setSelectedGame(game)} type="button">
                        顯示 QR
                      </button>
                      <a href={getPlayerJoinUrl(game.joinCode)} rel="noreferrer" target="_blank">
                        開玩家頁
                      </a>
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => navigate(`/admin/control?gameId=${game.id}`)} type="button">
                        控制台
                      </button>
                      <button onClick={() => navigate(`/admin/games/new?gameId=${game.id}`)} type="button">
                        編輯
                      </button>
                      <button onClick={() => navigate(`/admin/players?gameId=${game.id}`)} type="button">
                        玩家
                      </button>
                      <button onClick={() => void handleDelete(game)} type="button">
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
