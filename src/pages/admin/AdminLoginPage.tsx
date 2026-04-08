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
        <h1>登入控制台</h1>
        <p className="hero-text">輸入管理密碼後即可進入主持人後台。</p>
      </section>

      <SectionCard title="管理登入">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            後台密碼
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="請輸入主持人密碼"
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
