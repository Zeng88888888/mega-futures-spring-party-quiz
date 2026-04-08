import { Link } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";

export function HomePage() {
  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">SPRING PARTY INTERACTIVE GAME</p>
          <h1>春酒活動專用的手機答題平台</h1>
          <p className="hero-text">
            掃描 QR code 後即可加入場次，由主持人統一控場，支援競賽模式與淘汰賽模式，
            並同步管理玩家、排行榜與題庫。
          </p>
          <div className="cta-row">
            <Link className="button button--primary" to="/player/join">
              看玩家流程
            </Link>
            <Link className="button button--ghost" to="/admin/login">
              看主持人後台
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <MetricCard label="支援模式" tone="accent" value="2 種" />
          <MetricCard label="排行榜" value="前 10 名" />
          <MetricCard label="玩家管理" value="可修正 / 無效化" />
          <MetricCard label="部署方式" value="Netlify + Supabase" />
        </div>
      </section>

      <div className="grid-2">
        <SectionCard title="競賽模式" subtitle="10 秒內作答，答對得分，越快分數越高。">
          <ul className="plain-list">
            <li>送出答案後先鎖定，等待主持人公布結果。</li>
            <li>每題顯示正解與前 10 名排行榜。</li>
            <li>最後依總分排序，同分再比總作答時間。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="淘汰賽模式"
          subtitle="答錯或未作答直接淘汰，直到剩餘有效玩家小於等於 10 人。"
        >
          <ul className="plain-list">
            <li>送出後僅顯示等待揭曉，避免旁邊偷看。</li>
            <li>主持人公布結果後才統一顯示存活或淘汰。</li>
            <li>結果頁顯示最後存活的前 10 名名單。</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
