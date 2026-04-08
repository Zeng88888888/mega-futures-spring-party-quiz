import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { parseCsv } from "../../lib/csv";
import { fetchQuestionBanks, importQuestionsRecord } from "../../lib/gameApi";
import { csvHeaders } from "../../mock/demo";
import type { QuestionBank } from "../../types/domain";

type ImportRow = {
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
};

export function AdminImportPage() {
  const [searchParams] = useSearchParams();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState(searchParams.get("bankId") ?? "");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const loadedBanks = await fetchQuestionBanks();
      if (cancelled) {
        return;
      }
      setBanks(loadedBanks);
      setSelectedBankId((current) => current || loadedBanks[0]?.id || "");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === selectedBankId) ?? null,
    [banks, selectedBankId]
  );

  const validRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.content &&
          row.option_a &&
          row.option_b &&
          row.option_c &&
          row.option_d &&
          ["A", "B", "C", "D"].includes(row.correct_option.toUpperCase())
      ),
    [rows]
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setMessage("");
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text).map((row) => ({
      content: row.content ?? "",
      option_a: row.option_a ?? "",
      option_b: row.option_b ?? "",
      option_c: row.option_c ?? "",
      option_d: row.option_d ?? "",
      correct_option: (row.correct_option ?? "").toUpperCase(),
      explanation: row.explanation ?? ""
    }));

    setRows(parsed);
  }

  async function submitImport() {
    if (!selectedBankId) {
      setError("請先選擇題庫。");
      return;
    }

    try {
      setError("");
      setMessage("");
      await importQuestionsRecord(selectedBankId, validRows);
      setMessage(`已匯入 ${validRows.length} 題到 ${selectedBank?.title ?? "目前題庫"}。`);
      setRows([]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "匯入題目失敗。");
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 匯入題目</p>
        <h1>CSV / Excel 匯入題目</h1>
        <p className="hero-text">上傳檔案後會先預覽內容，再匯入到目前選定的題庫。</p>
      </section>

      <SectionCard
        subtitle="欄位需包含 content、option_a、option_b、option_c、option_d、correct_option、explanation。"
        title="匯入設定"
      >
        <div className="form-grid form-grid--wide">
          <label>
            目標題庫
            <select onChange={(event) => setSelectedBankId(event.target.value)} value={selectedBankId}>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.title}（{bank.questionCount ?? 0} 題）
                </option>
              ))}
            </select>
          </label>

          <label>
            上傳 CSV
            <input accept=".csv,text/csv" onChange={handleFile} type="file" />
          </label>
        </div>

        <div className="chip-grid">
          {csvHeaders.map((header) => (
            <span className="pill" key={header}>
              {header}
            </span>
          ))}
        </div>

        <div className="button-row">
          <a className="button button--ghost" download="question-import-template.csv" href="/templates/question-import-template.csv">
            下載 CSV 模板
          </a>
          {selectedBankId ? (
            <Link className="button button--ghost" to={`/admin/questions?bankId=${selectedBankId}`}>
              前往題庫管理
            </Link>
          ) : null}
        </div>

        {error ? <p className="inline-error">{error}</p> : null}
        {message ? <p className="inline-success">{message}</p> : null}
      </SectionCard>

      <SectionCard subtitle={`已讀取 ${rows.length} 筆，符合格式 ${validRows.length} 筆。`} title="匯入預覽">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>題目</th>
                <th>正確答案</th>
                <th>解說</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, index) => (
                <tr key={`${row.content}-${index}`}>
                  <td>{row.content}</td>
                  <td>{row.correct_option}</td>
                  <td>{row.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="button-row">
          <button className="button button--primary" disabled={validRows.length === 0} onClick={() => void submitImport()} type="button">
            開始匯入
          </button>
          {selectedBank ? <span className="status-note">目前題庫：{selectedBank.title}</span> : null}
        </div>
      </SectionCard>
    </div>
  );
}
