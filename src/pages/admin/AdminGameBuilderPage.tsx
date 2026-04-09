import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { createGameRecord, fetchGameById, fetchQuestionBanks, updateGameRecord } from "../../lib/gameApi";
import type { GameMode, QuestionBank } from "../../types/domain";

function generateJoinCode() {
  const date = new Date();
  const stamp = `${date.getMonth() + 1}${date.getDate()}${String(date.getHours()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 900 + 100);
  return `MEGA${stamp}${random}`;
}

export function AdminGameBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingGameId = searchParams.get("gameId") ?? "";
  const isEditing = Boolean(editingGameId);

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [title, setTitle] = useState("兆豐期貨春酒活動");
  const [mode, setMode] = useState<GameMode>("competition");
  const [bankId, setBankId] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [joinCode, setJoinCode] = useState(generateJoinCode);
  const [competitionSeconds, setCompetitionSeconds] = useState(10);
  const [leaderboardSize, setLeaderboardSize] = useState(10);
  const [survivalThreshold, setSurvivalThreshold] = useState(10);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === bankId) ?? null,
    [banks, bankId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const loadedBanks = await fetchQuestionBanks();
        if (cancelled) {
          return;
        }

        setBanks(loadedBanks);
        setBankId((current) => current || loadedBanks[0]?.id || "");

        if (editingGameId) {
          const game = await fetchGameById(editingGameId);
          if (!game || cancelled) {
            return;
          }

          setTitle(game.title);
          setMode(game.mode);
          setBankId(game.bankId);
          setQuestionCount(game.questionCount);
          setJoinCode(game.joinCode);
          setCompetitionSeconds(game.competitionSeconds ?? 10);
          setLeaderboardSize(game.leaderboardSize);
          setSurvivalThreshold(game.survivalThreshold ?? 10);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "讀取場次設定失敗，請重新整理後再試。");
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
  }, [editingGameId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!bankId) {
      setError("請先選擇題庫。");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        mode,
        bankId,
        questionCount: Math.max(1, questionCount),
        joinCode: joinCode.trim().toUpperCase(),
        competitionSeconds: Math.max(1, competitionSeconds),
        leaderboardSize: Math.max(1, leaderboardSize),
        survivalThreshold: Math.max(1, survivalThreshold)
      };

      if (isEditing) {
        await updateGameRecord({
          gameId: editingGameId,
          ...payload
        });
      } else {
        await createGameRecord(payload);
      }

      navigate("/admin/games");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "儲存場次失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 場次設定</p>
        <h1>{isEditing ? "更新場次設定" : "建立新場次"}</h1>
        <p className="hero-text">
          每個場次只能綁定一個題庫。競賽模式可自訂作答秒數與排行榜顯示名次，淘汰賽可另外設定結束門檻。
        </p>
      </section>

      <SectionCard subtitle="請選擇模式、題庫與題數。" title={isEditing ? "更新場次設定" : "建立場次"}>
        {isLoading ? <p className="inline-success">讀取場次設定中...</p> : null}

        <form className="form-grid form-grid--wide" onSubmit={handleSubmit}>
          <label>
            場次名稱
            <input onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>

          <label>
            模式
            <select onChange={(event) => setMode(event.target.value as GameMode)} value={mode}>
              <option value="competition">競賽模式</option>
              <option value="survival">淘汰賽模式</option>
            </select>
          </label>

          <label>
            題庫
            <select onChange={(event) => setBankId(event.target.value)} value={bankId}>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.title}（{bank.questionCount ?? 0} 題）
                </option>
              ))}
            </select>
          </label>

          <label>
            題目數
            <input
              min={1}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              type="number"
              value={questionCount}
            />
          </label>

          <label>
            場次識別碼
            <input onChange={(event) => setJoinCode(event.target.value.toUpperCase())} value={joinCode} />
          </label>

          {mode === "competition" ? (
            <label>
              作答秒數
              <input
                min={1}
                onChange={(event) => setCompetitionSeconds(Number(event.target.value))}
                type="number"
                value={competitionSeconds}
              />
              <span className="status-note">例如填 20，代表每題限時 20 秒。</span>
            </label>
          ) : null}

          <label>
            排行榜顯示名次
            <input
              min={1}
              onChange={(event) => setLeaderboardSize(Number(event.target.value))}
              type="number"
              value={leaderboardSize}
            />
            <span className="status-note">例如填 10，代表排行榜顯示前 10 名。</span>
          </label>

          {mode === "survival" ? (
            <label>
              淘汰賽結束門檻（剩餘人數）
              <input
                min={1}
                onChange={(event) => setSurvivalThreshold(Number(event.target.value))}
                type="number"
                value={survivalThreshold}
              />
              <span className="status-note">例如填 10，代表剩餘人數小於或等於 10 人時就結束比賽。</span>
            </label>
          ) : null}

          {selectedBank ? (
            <div className="info-box">
              <strong>目前題庫：{selectedBank.title}</strong>
              <p>{selectedBank.description || "這個題庫尚未填寫說明。"}</p>
              <p>題目數：{selectedBank.questionCount ?? 0}</p>
            </div>
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}

          <div className="button-row">
            <button className="button button--primary" disabled={isSubmitting || isLoading} type="submit">
              {isSubmitting ? "儲存中..." : isEditing ? "儲存場次" : "建立場次"}
            </button>
            <button className="button button--ghost" onClick={() => setJoinCode(generateJoinCode())} type="button">
              重新產生識別碼
            </button>
            <Link className="button button--ghost" to="/admin/games">
              回場次列表
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
