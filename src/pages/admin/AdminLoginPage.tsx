import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { setAdminPassword } from "../../lib/adminSession";
import { loginAdmin } from "../../lib/serverApi";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("host");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await loginAdmin(password);
      setAdminPassword(password);
      navigate("/admin/games");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "登入失敗。");
    }
  }

  return (
    <div className="admin-layout">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 登入</p>
        <h1>用管理密碼進入控台</h1>
        <p className="hero-text">
          現在登入驗證已改走 Netlify Function，管理寫入操作不再直接從前端打資料庫。
        </p>
      </section>

      <SectionCard title="登入後可管理場次、玩家、題庫" subtitle="部署到 Netlify 後請設定 ADMIN_PASSWORD 與 SUPABASE_SERVICE_ROLE_KEY。">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            管理帳號
            <input onChange={(event) => setUsername(event.target.value)} placeholder="host" value={username} />
          </label>
          <label>
            密碼
            <input onChange={(event) => setPassword(event.target.value)} placeholder="請輸入管理密碼" type="password" value={password} />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button button--primary" type="submit">
            進入後台
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
