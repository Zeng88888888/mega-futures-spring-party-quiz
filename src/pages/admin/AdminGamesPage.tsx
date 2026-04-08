import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { MetricCard } from "../../components/MetricCard";
import { SectionCard } from "../../components/SectionCard";
import { fetchGames, fetchPlayers, fetchQuestions } from "../../lib/gameApi";
import type { LiveGame, Player, Question } from "../../types/domain";

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
    live_question: "作答中",
    round_result: "公布結果",
    ended: "已結束"
  };
  return map[status] ?? status;
}

export function AdminGamesPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError("");
        setIsLoading(true);
        const [loadedGames, loadedQuestions] = await Promise.all([fetchGames(), fetchQuestions()]);

        if (cancelled) {
          return;
        }

        setGames(loadedGames);
        setQuestions(loadedQuestions);
        setSelectedGame((current) => {
          if (current) {
            return loadedGames.find((game) => game.id === current.id) ?? loadedGames[0] ?? null;
          }
          return loadedGames[0] ?? null;
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "後台資料載入失敗。");
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

    async function loadPlayers() {
      if (!games[0]) {
        setPlayers([]);
        return;
      }

      try {
        const loadedPlayers = await fetchPlayers(games[0].id);
        if (!cancelled) {
          setPlayers(loadedPlayers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "玩家資料載入失敗。");
        }
      }
    }

    void loadPlayers();
    return () => {
      cancelled = true;
    };
  }, [games]);

  useEffect(() => {
    let cancelled = false;

    async function generateQrCode() {
      if (!selectedGame) {
        setQrCodeUrl("");
        return;
      }

      try {
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
      } catch {
        if (!cancelled) {
          setQrCodeUrl("");
        }
      }
    }

    void generateQrCode();
    return () => {
      cancelled = true;
    };
  }, [selectedGame]);

  const invalidPlayers = useMemo(() => players.filter((player) => !player.valid).length, [players]);
  const joinUrl = selectedGame ? getPlayerJoinUrl(selectedGame.joinCode) : "";

  async function handleCopyLink() {
    if (!joinUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyMessage("玩家連結已複製。");
      window.setTimeout(() => setCopyMessage(""), 2200);
    } catch {
      setCopyMessage("複製失敗，請手動選取網址。");
    }
  }

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
      {isLoading ? <p className="inline-success">正在載入場次資料...</p> : null}

      <div className="grid-4">
        <MetricCard label="場次數量" value={games.length} tone="accent" />
        <MetricCard label="玩家數量" value={players.length} />
        <MetricCard label="題庫題數" value={questions.length} />
        <MetricCard label="無效玩家" value={invalidPlayers} tone="danger" />
      </div>

      <div className="grid-2">
        <SectionCard title="快速入口" subtitle="題庫管理和匯入題目都放在這裡。">
          <div className="cta-row">
            <Link className="button button--primary" to="/admin/questions">
              新增 / 編輯題目
            </Link>
            <Link className="button button--ghost" to="/admin/import">
              CSV / Excel 匯入
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="玩家入場 QR code" subtitle="選一個場次，玩家掃碼後就能直接填資料加入，不必再輸入加入碼。">
          {selectedGame ? (
            <div className="stack-md">
              <div className="pill-row">
                <span className="pill">目前場次：{selectedGame.title}</span>
                <span className="pill">模式：{formatMode(selectedGame.mode)}</span>
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
                <a
                  className="button button--ghost"
                  download={`${selectedGame.joinCode}-qr.png`}
                  href={qrCodeUrl || undefined}
                >
                  下載 QR code
                </a>
              </div>
            </div>
          ) : (
            <p>請先建立一個場次，右側才會顯示玩家入場 QR code。</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="場次列表" subtitle="點選某一場即可切換右側的玩家 QR code。">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>場次名稱</th>
                <th>模式</th>
                <th>狀態</th>
                <th>題目數</th>
                <th>玩家入口</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td>
                    <button className="link-button" onClick={() => setSelectedGame(game)} type="button">
                      {game.title}
                    </button>
                  </td>
                  <td>{formatMode(game.mode)}</td>
                  <td>{formatStatus(game.status)}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
