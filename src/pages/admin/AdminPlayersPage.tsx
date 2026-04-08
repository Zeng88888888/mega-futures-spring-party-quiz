import { FormEvent, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { fetchGames, fetchPlayers, togglePlayerValidityRecord, updatePlayerRecord } from "../../lib/gameApi";
import type { LiveGame, Player } from "../../types/domain";

export function AdminPlayersPage() {
  const [game, setGame] = useState<LiveGame | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const games = await fetchGames();
    const currentGame = games[0] ?? null;
    const currentPlayers = currentGame ? await fetchPlayers(currentGame.id) : [];

    setGame(currentGame);
    setPlayers(currentPlayers);
    if (currentPlayers[0]) {
      syncSelection(currentPlayers[0]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  function syncSelection(player?: Player) {
    setSelectedPlayerId(player?.id ?? "");
    setNickname(player?.nickname ?? "");
    setDepartment(player?.department ?? "");
    setEmployeeId(player?.employeeId ?? "");
    setError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game || !selectedPlayerId) {
      return;
    }

    try {
      setError("");
      await updatePlayerRecord(game.id, selectedPlayerId, { nickname, department, employeeId });
      await load();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "更新玩家資料失敗。");
    }
  }

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard title="尚未建立場次" subtitle="請先建立場次後，再管理玩家。">
          <p>目前沒有可管理的玩家資料。</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 玩家管理</p>
        <h1>玩家資料管理</h1>
        <p className="hero-text">可直接修正暱稱、部門、員編，也能將玩家標記為無效。</p>
      </section>

      <div className="grid-2 admin-two-column">
        <SectionCard title="玩家列表" subtitle={`目前場次：${game.title}`}>
          <div className="form-grid">
            <label>
              搜尋
              <input onChange={(event) => setKeyword(event.target.value)} placeholder="搜尋暱稱 / 部門 / 員編" value={keyword} />
            </label>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
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
                    <td>{player.nickname}</td>
                    <td>{player.department}</td>
                    <td>{player.employeeId}</td>
                    <td>{player.valid ? "有效" : "無效"}</td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => syncSelection(player)} type="button">
                          編輯
                        </button>
                        <button
                          onClick={async () => {
                            await togglePlayerValidityRecord(player.id, !player.valid);
                            await load();
                          }}
                          type="button"
                        >
                          {player.valid ? "標記無效" : "恢復有效"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="編輯玩家" subtitle="修改後會即時同步到排行榜與場次資料。">
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
            {error ? <p className="inline-error">{error}</p> : null}
            <button className="button button--primary" type="submit">
              儲存修改
            </button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
