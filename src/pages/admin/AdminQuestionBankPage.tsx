import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import {
  createQuestionBankRecord,
  deleteQuestionBankRecord,
  deleteQuestionRecord,
  fetchQuestionBanks,
  fetchQuestions,
  reorderQuestionsRecord,
  shuffleQuestionsRecord,
  updateQuestionBankRecord,
  upsertQuestionRecord
} from "../../lib/gameApi";
import type { Question, QuestionBank } from "../../types/domain";

const emptyQuestionForm = {
  id: "",
  content: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A" as "A" | "B" | "C" | "D",
  explanation: ""
};

export function AdminQuestionBankPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bankParam = searchParams.get("bankId") ?? "";
  const questionEditorRef = useRef<HTMLElement | null>(null);

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [bankTitle, setBankTitle] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === selectedBankId) ?? null,
    [banks, selectedBankId]
  );

  async function loadBanks(nextBankId?: string) {
    const loadedBanks = await fetchQuestionBanks();
    const targetId = nextBankId || bankParam || selectedBankId || loadedBanks[0]?.id || "";
    const activeBank = loadedBanks.find((bank) => bank.id === targetId) ?? loadedBanks[0] ?? null;

    setBanks(loadedBanks);
    setSelectedBankId(activeBank?.id ?? "");
    setBankTitle(activeBank?.title ?? "");
    setBankDescription(activeBank?.description ?? "");
  }

  async function loadQuestions(bankId: string) {
    if (!bankId) {
      setQuestions([]);
      return;
    }

    const loadedQuestions = await fetchQuestions(bankId);
    setQuestions(loadedQuestions);
  }

  useEffect(() => {
    void loadBanks();
  }, []);

  useEffect(() => {
    if (!selectedBankId) {
      setQuestions([]);
      return;
    }

    const activeBank = banks.find((bank) => bank.id === selectedBankId);
    setBankTitle(activeBank?.title ?? "");
    setBankDescription(activeBank?.description ?? "");
    setQuestionForm(emptyQuestionForm);
    void loadQuestions(selectedBankId);
  }, [selectedBankId, banks]);

  function scrollToEditor() {
    window.setTimeout(() => {
      questionEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function startCreateBank() {
    setSelectedBankId("");
    setBankTitle("");
    setBankDescription("");
    setQuestionForm(emptyQuestionForm);
    setError("");
    setMessage("");
    navigate("/admin/questions", { replace: true });
  }

  function editQuestion(question?: Question) {
    if (!question) {
      setQuestionForm(emptyQuestionForm);
      return;
    }

    setQuestionForm({
      id: question.id,
      content: question.prompt,
      optionA: question.options[0] ?? "",
      optionB: question.options[1] ?? "",
      optionC: question.options[2] ?? "",
      optionD: question.options[3] ?? "",
      correctOption: question.correctOption,
      explanation: question.explanation
    });
    setMessage(`正在編輯題目：第 ${question.orderNo ?? "-"} 題`);
    setError("");
    scrollToEditor();
  }

  async function saveBank() {
    if (!bankTitle.trim()) {
      setError("請先輸入題庫名稱。");
      setMessage("");
      return;
    }

    try {
      setError("");
      setMessage("");

      if (!selectedBankId) {
        const bank = await createQuestionBankRecord({
          title: bankTitle.trim(),
          description: bankDescription.trim()
        });
        await loadBanks(bank.id);
        navigate(`/admin/questions?bankId=${bank.id}`, { replace: true });
        setMessage(`已建立題庫「${bank.title}」。`);
      } else {
        await updateQuestionBankRecord({
          id: selectedBankId,
          title: bankTitle.trim(),
          description: bankDescription.trim()
        });
        await loadBanks(selectedBankId);
        setMessage(`已更新題庫「${bankTitle.trim()}」。`);
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "儲存題庫失敗，請稍後再試。");
      setMessage("");
    }
  }

  async function removeBank() {
    if (!selectedBankId || !selectedBank) {
      return;
    }

    const confirmed = window.confirm(`確定要刪除題庫「${selectedBank.title}」嗎？`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      const removedTitle = selectedBank.title;
      await deleteQuestionBankRecord(selectedBankId);
      await loadBanks();
      navigate("/admin/questions", { replace: true });
      setMessage(`已刪除題庫「${removedTitle}」。`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "刪除題庫失敗，請稍後再試。");
    }
  }

  async function saveQuestion() {
    if (!selectedBankId) {
      setError("請先選擇題庫。");
      setMessage("");
      return;
    }

    try {
      setError("");
      setMessage("");
      const isEditing = Boolean(questionForm.id);
      await upsertQuestionRecord({
        ...questionForm,
        bankId: selectedBankId
      });
      setQuestionForm(emptyQuestionForm);
      await loadBanks(selectedBankId);
      await loadQuestions(selectedBankId);
      setMessage(isEditing ? "題目已更新。" : "題目已新增。");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "儲存題目失敗，請稍後再試。");
    }
  }

  async function removeQuestion(id: string) {
    const confirmed = window.confirm("確定要刪除這一題嗎？");
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await deleteQuestionRecord(id);
      if (questionForm.id === id) {
        setQuestionForm(emptyQuestionForm);
      }
      await loadBanks(selectedBankId);
      await loadQuestions(selectedBankId);
      setMessage("題目已刪除。");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "刪除題目失敗，請稍後再試。");
    }
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (!selectedBankId || nextIndex < 0 || nextIndex >= questions.length) {
      return;
    }

    const reordered = [...questions];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];

    try {
      setError("");
      setMessage("");
      await reorderQuestionsRecord(
        selectedBankId,
        reordered.map((question) => question.id)
      );
      await loadQuestions(selectedBankId);
      setMessage("題目順序已更新。");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "更新題目順序失敗，請稍後再試。");
    }
  }

  async function shuffleQuestions() {
    if (!selectedBankId) {
      return;
    }

    const confirmed = window.confirm("確定要將此題庫題目順序隨機打亂嗎？");
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await shuffleQuestionsRecord(selectedBankId);
      await loadQuestions(selectedBankId);
      setMessage("題目順序已隨機打亂。");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "隨機打亂失敗，請稍後再試。");
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 題庫管理</p>
        <h1>題庫分類管理</h1>
        <p className="hero-text">可建立題庫一、題庫二、題庫三等分類，並在各自題庫中管理題目與排序。</p>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}
      {message ? <p className="inline-success">{message}</p> : null}

      <div className="grid-2 admin-two-column">
        <SectionCard subtitle="先選題庫，再決定要更新既有題庫或建立新題庫。" title="題庫列表">
          <div className="stack-md">
            <div className="table-actions">
              {banks.map((bank) => (
                <button
                  className={bank.id === selectedBankId ? "button button--primary" : "button button--ghost"}
                  key={bank.id}
                  onClick={() => {
                    setSelectedBankId(bank.id);
                    setMessage("");
                    setError("");
                    navigate(`/admin/questions?bankId=${bank.id}`, { replace: true });
                  }}
                  type="button"
                >
                  {bank.title}（{bank.questionCount ?? 0} 題）
                </button>
              ))}
              <button className="button button--ghost" onClick={startCreateBank} type="button">
                + 新增新題庫
              </button>
            </div>

            <div className="form-grid">
              <label>
                題庫名稱
                <input onChange={(event) => setBankTitle(event.target.value)} value={bankTitle} />
              </label>
              <label>
                題庫說明
                <textarea
                  className="textarea"
                  onChange={(event) => setBankDescription(event.target.value)}
                  rows={3}
                  value={bankDescription}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="button button--primary" onClick={() => void saveBank()} type="button">
                {selectedBankId ? "儲存題庫" : "建立題庫"}
              </button>
              <button className="button button--ghost" onClick={startCreateBank} type="button">
                清空表單
              </button>
              {selectedBankId ? (
                <>
                  <button className="button button--ghost" onClick={() => void removeBank()} type="button">
                    刪除題庫
                  </button>
                  <Link className="button button--ghost" to={`/admin/import?bankId=${selectedBankId}`}>
                    匯入到此題庫
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          aside={
            selectedBank ? (
              <button className="button button--ghost" onClick={() => void shuffleQuestions()} type="button">
                隨機打亂排序
              </button>
            ) : undefined
          }
          subtitle={selectedBank ? "可在此題庫內增修題目與調整順序。" : "請先選擇題庫。"}
          title={selectedBank ? `${selectedBank.title} 題目列表` : "題目列表"}
        >
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>順序</th>
                  <th>題目</th>
                  <th>正確答案</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={question.id}>
                    <td>{question.orderNo ?? index + 1}</td>
                    <td>{question.prompt}</td>
                    <td>{question.correctOption}</td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => void moveQuestion(index, -1)} type="button">
                          上移
                        </button>
                        <button onClick={() => void moveQuestion(index, 1)} type="button">
                          下移
                        </button>
                        <button onClick={() => editQuestion(question)} type="button">
                          編輯
                        </button>
                        <button onClick={() => void removeQuestion(question.id)} type="button">
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {selectedBank && questions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>此題庫目前還沒有題目。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        aside={questionForm.id ? <span className="pill pill--accent">編輯中</span> : undefined}
        subtitle={selectedBank ? `目前編輯題庫：${selectedBank.title}` : "請先選擇題庫。"}
        title={questionForm.id ? "編輯題目" : "新增題目"}
      >
        <section ref={questionEditorRef}>
          <div className="form-grid">
            <label>
              題目
              <textarea
                className="textarea"
                onChange={(event) => setQuestionForm((current) => ({ ...current, content: event.target.value }))}
                rows={3}
                value={questionForm.content}
              />
            </label>
            <label>
              選項 A
              <input
                onChange={(event) => setQuestionForm((current) => ({ ...current, optionA: event.target.value }))}
                value={questionForm.optionA}
              />
            </label>
            <label>
              選項 B
              <input
                onChange={(event) => setQuestionForm((current) => ({ ...current, optionB: event.target.value }))}
                value={questionForm.optionB}
              />
            </label>
            <label>
              選項 C
              <input
                onChange={(event) => setQuestionForm((current) => ({ ...current, optionC: event.target.value }))}
                value={questionForm.optionC}
              />
            </label>
            <label>
              選項 D
              <input
                onChange={(event) => setQuestionForm((current) => ({ ...current, optionD: event.target.value }))}
                value={questionForm.optionD}
              />
            </label>
            <label>
              正確答案
              <select
                onChange={(event) =>
                  setQuestionForm((current) => ({
                    ...current,
                    correctOption: event.target.value as "A" | "B" | "C" | "D"
                  }))
                }
                value={questionForm.correctOption}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
            <label>
              解說
              <textarea
                className="textarea"
                onChange={(event) => setQuestionForm((current) => ({ ...current, explanation: event.target.value }))}
                rows={3}
                value={questionForm.explanation}
              />
            </label>
            <div className="button-row">
              <button className="button button--primary" onClick={() => void saveQuestion()} type="button">
                {questionForm.id ? "儲存題目" : "新增題目"}
              </button>
              <button className="button button--ghost" onClick={() => editQuestion()} type="button">
                清空表單
              </button>
            </div>
          </div>
        </section>
      </SectionCard>
    </div>
  );
}
