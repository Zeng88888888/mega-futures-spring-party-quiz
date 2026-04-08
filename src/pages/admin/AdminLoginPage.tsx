import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { hasAdminSession, setAdminPassword } from "../../lib/adminSession";
import { loginAdmin } from "../../lib/serverApi";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("host");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasAdminSession()) {
      navigate("/admin/games", { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await loginAdmin(password);
      setAdminPassword(password);
      navigate("/admin/games");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "主持人登入失敗。");
    }
  }

  return (
    <div className="admin-layout">
      <section className="player-stage">
        <p className="eyebrow">主持人後台 / 登入</p>
        <h1>輸入主持人密碼後進入控制頁</h1>
        <p className="hero-text">
          後台登入狀態會保留在這台裝置中，所以在同一台電腦切換後台頁面時，不需要每次重新登入。
        </p>
      </section>

      <SectionCard title="主持人登入" subtitle="請輸入你在 Netlify 設定的 ADMIN_PASSWORD。">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            帳號顯示
            <input onChange={(event) => setUsername(event.target.value)} placeholder="host" value={username} />
          </label>
          <label>
            密碼
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="請輸入主持人密碼"
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button button--primary" type="submit">
            登入後台
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
