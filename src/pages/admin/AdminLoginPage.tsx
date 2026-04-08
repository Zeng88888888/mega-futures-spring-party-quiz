import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../components/SectionCard";
import { hasAdminSession, setAdminPassword } from "../../lib/adminSession";
import { loginAdmin } from "../../lib/serverApi";

export function AdminLoginPage() {
  const navigate = useNavigate();
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
      setError(submissionError instanceof Error ? submissionError.message : "登入失敗。");
    }
  }

  return (
    <div className="admin-layout">
      <section className="player-stage">
        <p className="eyebrow">主持人後台</p>
        <h1>登入控制後台</h1>
        <p className="hero-text">請輸入你在 Netlify 設定的管理密碼。</p>
      </section>

      <SectionCard title="管理員登入" subtitle="登入後會保留在目前這台電腦。">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            管理密碼
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="請輸入密碼"
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button button--primary" type="submit">
            登入
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
