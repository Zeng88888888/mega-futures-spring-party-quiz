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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const games = await fetchGames();
      const currentGame = games[0] ?? null;
      const currentPlayers = currentGame ? await fetchPlayers(currentGame.id) : [];

      if (!cancelled) {
        setGame(currentGame);
        setPlayers(currentPlayers);
        if (currentPlayers[0]) {
          setSelectedPlayerId(currentPlayers[0].id);
          setNickname(currentPlayers[0].nickname);
          setDepartment(currentPlayers[0].department);
          setEmployeeId(currentPlayers[0].employeeId);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
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

  function syncSelection(next: Player | undefined) {
    setSelectedPlayerId(next?.id ?? "");
    setNickname(next?.nickname ?? "");
    setDepartment(next?.department ?? "");
    setEmployeeId(next?.employeeId ?? "");
    setError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game || !selectedPlayerId) {
      return;
    }

    try {
      await updatePlayerRecord(game.id, selectedPlayerId, { nickname, department, employeeId });
      window.location.reload();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "更新玩家失敗。");
    }
  }

  if (!game) {
    return (
      <div className="admin-layout">
        <SectionCard title="尚無場次" subtitle="先建立場次後再管理玩家。">
          <p>目前沒有可管理的場次。</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 玩家管理</p>
        <h1>修正玩家資料與管理有效性</h1>
        <p className="hero-text">
          若玩家輸入錯誤，主持人可直接修正暱稱、部門與員編；標記為無效後，該玩家會完全排除於排行榜與淘汰統計之外。
        </p>
      </section>

      <div className="grid-2">
        <SectionCard title="玩家列表" subtitle="點選玩家後可在右側直接修正資料。">
          <div className="form-grid">
            <label>
              搜尋關鍵字
              <input onChange={(event) => setKeyword(event.target.value)} placeholder="輸入暱稱 / 部門 / 員編" value={keyword} />
            </label>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>暱稱</th>
                  <th>部門</th>
                  <th>員編</th>
                  <th>有效性</th>
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
                            window.location.reload();
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

        <SectionCard title="編輯玩家" subtitle="會檢查同一場次內員編是否重複。">
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
