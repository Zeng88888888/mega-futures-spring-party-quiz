import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import {
  createGameRecord,
  fetchGameById,
  fetchQuestionBanks,
  updateGameRecord
} from "../../lib/gameApi";
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
  const [leaderboardSize, setLeaderboardSize] = useState(10);
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
          setLeaderboardSize(game.leaderboardSize);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "讀取場次設定失敗。");
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
        leaderboardSize: Math.max(1, leaderboardSize)
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
      setError(submissionError instanceof Error ? submissionError.message : "儲存場次失敗。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 場次設定</p>
        <h1>{isEditing ? "編輯場次" : "建立新場次"}</h1>
        <p className="hero-text">每一場只能選一個題庫，題目會依題庫內容自動帶入。</p>
      </section>

      <SectionCard
        title={isEditing ? "更新場次資料" : "建立場次資料"}
        subtitle="先選題庫，再設定題數、模式與入場連結。"
      >
        {isLoading ? <p className="inline-success">正在讀取題庫資料...</p> : null}
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
            場次代碼
            <input onChange={(event) => setJoinCode(event.target.value.toUpperCase())} value={joinCode} />
          </label>

          <label>
            排行榜名次
            <input
              min={1}
              onChange={(event) => setLeaderboardSize(Number(event.target.value))}
              type="number"
              value={leaderboardSize}
            />
          </label>

          {selectedBank ? (
            <div className="info-box">
              <strong>目前題庫：{selectedBank.title}</strong>
              <p>{selectedBank.description || "未填寫題庫說明"}</p>
              <p>可用題數：{selectedBank.questionCount ?? 0}</p>
            </div>
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}

          <div className="button-row">
            <button className="button button--primary" disabled={isSubmitting || isLoading} type="submit">
              {isSubmitting ? "儲存中..." : isEditing ? "更新場次" : "建立場次"}
            </button>
            <button
              className="button button--ghost"
              onClick={() => setJoinCode(generateJoinCode())}
              type="button"
            >
              重新產生代碼
            </button>
            <Link className="button button--ghost" to="/admin/games">
              返回場次列表
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
