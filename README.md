# 兆豐期貨春酒答題平台

這是一套部署在 Netlify、資料儲存在 Supabase 的手機答題系統，支援：

- 競賽模式：10 秒內四選一答題，答對才得分，越快分數越高
- 淘汰賽模式：答錯或未作答即淘汰，直到剩餘人數小於等於前十名門檻
- 主持人後台：建立場次、控制題目流程、管理玩家、管理題庫、CSV 匯入
- 玩家手機頁：掃 QR code 加入場次、等待開始、作答、中場結果、最終結果

## 技術架構

- React 19
- Vite 7
- React Router 7
- Supabase
- Netlify Functions

## 本機啟動

1. 安裝套件

```bash
npm install
```

2. 建立前端環境變數

```bash
copy .env.example .env
```

3. 填入 `.env`

```env
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
VITE_APP_TITLE=兆豐期貨春酒答題平台
```

4. 如果只跑前端

```bash
npm run dev
```

5. 如果要一起測 Netlify Functions

```bash
npm run dev:netlify
```

## Supabase 設定

1. 建立 Supabase 專案
2. 把 [schema.sql](/C:/Users/dark8207/Documents/CODEX/supabase/schema.sql) 貼到 SQL Editor 執行
3. 取得下列資訊
   - `Project URL`
   - `anon public key`
   - `service_role key`

## Netlify 環境變數

正式部署時，請在 Netlify Project Settings > Environment variables 設定：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `VITE_APP_TITLE`

可參考 [`.env.netlify.example`](/C:/Users/dark8207/Documents/CODEX/.env.netlify.example)

## 安全設計

- 玩家加入與送答案改走 `player-action` Netlify Function
- 主持人登入與後台操作改走 `admin-login` / `admin-action` Netlify Function
- 玩家端畫面快照改走 `game-read` Netlify Function
- `players`、`game_questions`、`round_results`、`player_round_statuses`、`questions` 已移除公開讀取 policy
- 目前只保留 `games` 的基本公開讀取，供場次入口與狀態同步使用

## 重要檔案

- 路由：[src/router.tsx](/C:/Users/dark8207/Documents/CODEX/src/router.tsx)
- 玩家 API：[src/lib/gameApi.ts](/C:/Users/dark8207/Documents/CODEX/src/lib/gameApi.ts)
- Function 封裝：[src/lib/serverApi.ts](/C:/Users/dark8207/Documents/CODEX/src/lib/serverApi.ts)
- 場次/計分邏輯：[gameService.mjs](/C:/Users/dark8207/Documents/CODEX/netlify/functions/shared/gameService.mjs)
- 管理函式：[admin-action.mjs](/C:/Users/dark8207/Documents/CODEX/netlify/functions/admin-action.mjs)
- 玩家函式：[player-action.mjs](/C:/Users/dark8207/Documents/CODEX/netlify/functions/player-action.mjs)
- 玩家安全快照：[game-read.mjs](/C:/Users/dark8207/Documents/CODEX/netlify/functions/game-read.mjs)

## 建置驗證

```bash
npm run build
```

目前 build 已通過。

## 上線前建議

1. 在 Netlify 設好正式環境變數
2. 把 `ADMIN_PASSWORD` 換成正式強密碼
3. 匯入正式題庫
4. 建立正式場次並實機測試 QR code 加入與多手機同時作答
5. 活動前重新產生新的 Supabase Personal Access Token，舊 token 建議撤銷
