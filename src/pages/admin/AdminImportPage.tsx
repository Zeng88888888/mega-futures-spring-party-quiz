import { ChangeEvent, useMemo, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { parseCsv } from "../../lib/csv";
import { importQuestionsRecord } from "../../lib/gameApi";
import { csvHeaders } from "../../mock/demo";

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
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    try {
      setError("");
      setMessage("");
      await importQuestionsRecord(validRows);
      setMessage(`已匯入 ${validRows.length} 題。`);
      setRows([]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "匯入失敗。");
    }
  }

  return (
    <div className="admin-layout stack-lg">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 題目匯入</p>
        <h1>支援 CSV / Excel 匯入題庫</h1>
        <p className="hero-text">Excel 建議先另存成 CSV。這一頁現在可以直接預覽並匯入 Supabase 題庫。</p>
      </section>

      <SectionCard title="建議欄位格式" subtitle="請使用以下標題列，順序可相同即可。">
        <div className="chip-grid">
          {csvHeaders.map((header) => (
            <span className="pill" key={header}>
              {header}
            </span>
          ))}
        </div>
        <div className="button-row">
          <a
            className="button button--ghost"
            download="question-import-template.csv"
            href="/templates/question-import-template.csv"
          >
            下載 CSV 模板
          </a>
        </div>
      </SectionCard>

      <SectionCard title="上傳檔案" subtitle="匯入前會先做欄位預覽。">
        <div className="form-grid">
          <label>
            選擇 CSV 檔案
            <input accept=".csv,text/csv" onChange={handleFile} type="file" />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          {message ? <p className="inline-success">{message}</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="匯入預覽" subtitle={`共讀取 ${rows.length} 列，可匯入 ${validRows.length} 列。`}>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>題目</th>
                <th>正解</th>
                <th>說明</th>
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
            匯入有效題目
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
