import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { deleteQuestionRecord, fetchQuestions, upsertQuestionRecord } from "../../lib/gameApi";
import type { Question } from "../../types/domain";

const emptyForm = {
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  async function loadQuestions() {
    const data = await fetchQuestions();
    setQuestions(data);
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  function fillForm(question?: Question) {
    if (!question) {
      setForm(emptyForm);
      setError("");
      return;
    }

    setForm({
      id: question.id,
      content: question.prompt,
      optionA: question.options[0],
      optionB: question.options[1],
      optionC: question.options[2],
      optionD: question.options[3],
      correctOption: question.correctOption,
      explanation: question.explanation
    });
    setError("");
  }

  async function saveQuestion() {
    try {
      setError("");
      await upsertQuestionRecord(form);
      fillForm();
      await loadQuestions();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "題目儲存失敗。");
    }
  }

  async function removeQuestion(id: string) {
    try {
      setError("");
      await deleteQuestionRecord(id);
      if (form.id === id) {
        fillForm();
      }
      await loadQuestions();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "題目刪除失敗。");
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 題庫管理</p>
        <h1>新增、編輯與整理活動題目</h1>
        <div className="cta-row">
          <button className="button button--primary" onClick={() => fillForm()} type="button">
            新增題目
          </button>
          <Link className="button button--ghost" to="/admin/import">
            匯入 CSV / Excel
          </Link>
        </div>
      </section>

      <div className="grid-2">
        <SectionCard title="題目列表" subtitle="這一頁現在會直接讀取 Supabase 題庫。">
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>題目</th>
                  <th>正確答案</th>
                  <th>說明</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.id}>
                    <td>{question.prompt}</td>
                    <td>{question.correctOption}</td>
                    <td>{question.explanation}</td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => fillForm(question)} type="button">
                          編輯
                        </button>
                        <button onClick={() => void removeQuestion(question.id)} type="button">
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

        <SectionCard title={form.id ? "編輯題目" : "新增題目"} subtitle="管理寫入已改走受密碼保護的 Netlify Function。">
          <div className="form-grid">
            <label>
              題目
              <textarea
                className="textarea"
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                rows={4}
                value={form.content}
              />
            </label>
            <label>
              選項 A
              <input onChange={(event) => setForm((current) => ({ ...current, optionA: event.target.value }))} value={form.optionA} />
            </label>
            <label>
              選項 B
              <input onChange={(event) => setForm((current) => ({ ...current, optionB: event.target.value }))} value={form.optionB} />
            </label>
            <label>
              選項 C
              <input onChange={(event) => setForm((current) => ({ ...current, optionC: event.target.value }))} value={form.optionC} />
            </label>
            <label>
              選項 D
              <input onChange={(event) => setForm((current) => ({ ...current, optionD: event.target.value }))} value={form.optionD} />
            </label>
            <label>
              正確答案
              <select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    correctOption: event.target.value as "A" | "B" | "C" | "D"
                  }))
                }
                value={form.correctOption}
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
                onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))}
                rows={3}
                value={form.explanation}
              />
            </label>
            {error ? <p className="inline-error">{error}</p> : null}
            <div className="button-row">
              <button className="button button--primary" onClick={() => void saveQuestion()} type="button">
                {form.id ? "儲存修改" : "新增題目"}
              </button>
              <button className="button button--ghost" onClick={() => fillForm()} type="button">
                清空表單
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
