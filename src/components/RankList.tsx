import type { Player } from "../types/domain";

interface RankListProps {
  players: Player[];
  showScore?: boolean;
  showMeta?: boolean;
}

export function RankList({ players, showScore = true, showMeta = true }: RankListProps) {
  return (
    <ol className="rank-list">
      {players.map((player, index) => (
        <li key={player.id}>
          <div>
            <span className="rank-badge">{index + 1}</span>
            <div>
              <strong>{player.nickname}</strong>
              {showMeta ? (
                <p>
                  {player.department} / {player.employeeId}
                </p>
              ) : null}
            </div>
          </div>
          <div className="rank-meta">
            {showScore ? <strong>{player.score} 分</strong> : <strong>{player.status === "eliminated" ? "已淘汰" : "存活"}</strong>}
          </div>
        </li>
      ))}
    </ol>
  );
}
