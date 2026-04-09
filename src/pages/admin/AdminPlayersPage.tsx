import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import {
  deletePlayerRecord,
  deletePlayersRecord,
  fetchGames,
  fetchPlayers,
  updatePlayerRecord
} from "../../lib/gameApi";
import type { LiveGame, Player } from "../../types/domain";

export function AdminPlayersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preferredGameId = searchParams.get("gameId") ?? "";

  const [game, setGame] = useState<LiveGame | null>(null);
  const [games, setGames] = useState<LiveGame[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  function syncSelection(player?: Player) {
    setSelectedPlayerId(player?.id ?? "");
    setNickname(player?.nickname ?? "");
    setDepartment(player?.department ?? "");
    setEmployeeId(player?.employeeId ?? "");
  }

  async function load(nextGameId?: string, nextSelectedPlayerId?: string) {
    const loadedGames = await fetchGames();
    const currentGame =
      loadedGames.find((item) => item.id === nextGameId) ??
      loadedGames.find((item) => item.id === preferredGameId) ??
      loadedGames[0] ??
      null;
    const currentPlayers = currentGame ? await fetchPlayers(currentGame.id) : [];
    const selectedPlayer =
      currentPlayers.find((player) => player.id === nextSelectedPlayerId) ??
      currentPlayers[0];

    setGames(loadedGames);
    setGame(currentGame);
    setPlayers(currentPlayers);
    setSelectedPlayerIds([]);
    syncSelection(selectedPlayer);
  }

  useEffect(() => {
    void load();
  }, [preferredGameId]);

  const filteredPlayers = useMemo(() => {
    if (!keyword.trim()) {
      return players;
    }

    const normalized = keyword.trim().toLowerCase();
    return players.filter((player) =>
      [player.nickname, player.department, player.employeeId].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [keyword, players]);

  const selectedPlayers = useMemo(
    () => players.filter((player) => selectedPlayerIds.includes(player.id)),
    [players, selectedPlayerIds]
  );

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game || !selectedPlayerId) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await updatePlayerRecord(game.id, selectedPlayerId, { nickname, department, employeeId });
      await load(game.id, selectedPlayerId);
      setMessage("玩家資料已更新。");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "更新玩家資料失敗。");
    }
  }

  function toggleChecked(playerId: string) {
    setSelectedPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  function toggleAllChecked() {
    setSelectedPlayerIds((current) =>
      current.length === filteredPlayers.length ? [] : filteredPlayers.map((player) => player.id)
    );
  }

  async function handleDeleteMany(playerIds: string[], confirmText: string, successMessage: string) {
    if (!game || playerIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(confirmText);
    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setError("");
      setMessage("");
      await deletePlayersRecord(playerIds);
      await load(game.id, selectedPlayerId && !playerIds.includes(selectedPlayerId) ? selectedPlayerId : undefined);
      setMessage(successMessage);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除玩家資料失敗。");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeletePlayer(player: Player) {
    const confirmed = window.confirm(`確定要刪除玩家 ${player.nickname} / ${player.employeeId} 嗎？`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await deletePlayerRecord(player.id);
      await load(game?.id, selectedPlayerId === player.id ? undefined : selectedPlayerId);
      setMessage("玩家資料已刪除。");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除玩家資料失敗。");
    }
  }

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard title="尚未建立場次" subtitle="請先建立場次，再管理玩家資料。">
          <p>目前沒有可管理的場次。</p>
        </SectionCard>
      </div>
    );
  }

  const allFilteredSelected =
    filteredPlayers.length > 0 && filteredPlayers.every((player) => selectedPlayerIds.includes(player.id));

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 玩家管理</p>
        <h1>玩家資料管理</h1>
        <p className="hero-text">可依暱稱、部門或員編搜尋，也可批次刪除或清空整場玩家資料。</p>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}
      {message ? <p className="inline-success">{message}</p> : null}

      <div className="grid-2 admin-two-column">
        <SectionCard title="玩家列表" subtitle={`目前場次：${game.title}`}>
          <div className="form-grid">
            <label>
              選擇場次
              <select
                onChange={(event) => {
                  const nextId = event.target.value;
                  navigate(`/admin/players?gameId=${nextId}`, { replace: true });
                  void load(nextId);
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

            <label>
              搜尋
              <input onChange={(event) => setKeyword(event.target.value)} value={keyword} />
            </label>
          </div>

          <div className="button-row">
            <button
              className="button button--ghost"
              disabled={selectedPlayerIds.length === 0 || isDeleting}
              onClick={() =>
                void handleDeleteMany(
                  selectedPlayerIds,
                  `確定要刪除已勾選的 ${selectedPlayerIds.length} 位玩家嗎？`,
                  `已刪除 ${selectedPlayerIds.length} 位玩家。`
                )
              }
              type="button"
            >
              批次刪除
            </button>
            <button
              className="button button--ghost"
              disabled={players.length === 0 || isDeleting}
              onClick={() =>
                void handleDeleteMany(
                  players.map((player) => player.id),
                  `確定要刪除場次「${game.title}」的全部 ${players.length} 位玩家嗎？`,
                  "本場玩家資料已全部刪除。"
                )
              }
              type="button"
            >
              全部刪除
            </button>
          </div>

          {selectedPlayers.length > 0 ? (
            <p className="status-note">已勾選 {selectedPlayers.length} 位玩家。</p>
          ) : null}

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="全選玩家"
                      checked={allFilteredSelected}
                      onChange={toggleAllChecked}
                      type="checkbox"
                    />
                  </th>
                  <th>暱稱</th>
                  <th>部門</th>
                  <th>員編</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id}>
                    <td>
                      <input
                        aria-label={`選取 ${player.nickname}`}
                        checked={selectedPlayerIds.includes(player.id)}
                        onChange={() => toggleChecked(player.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>{player.nickname}</td>
                    <td>{player.department}</td>
                    <td>{player.employeeId}</td>
                    <td>{player.status}</td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => syncSelection(player)} type="button">
                          編輯
                        </button>
                        <button onClick={() => void handleDeletePlayer(player)} type="button">
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6}>目前沒有符合條件的玩家資料。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="編輯玩家" subtitle="選取左側玩家後，可直接修改資料。">
          <form className="form-grid" onSubmit={handleSave}>
            <label>
              暱稱
              <input onChange={(event) => setNickname(event.target.value)} value={nickname} />
            </label>
            <label>
              部門
              <input onChange={(event) => setDepartment(event.target.value)} value={department} />
            </label>
            <label>
              員編
              <input onChange={(event) => setEmployeeId(event.target.value)} value={employeeId} />
            </label>
            <button className="button button--primary" disabled={!selectedPlayerId} type="submit">
              儲存資料
            </button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
