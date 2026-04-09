import { Suspense, lazy } from "react";
import { Navigate, NavLink, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { hasAdminSession } from "./lib/adminSession";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const PlayerJoinPage = lazy(() =>
  import("./pages/player/PlayerJoinPage").then((module) => ({ default: module.PlayerJoinPage }))
);
const PlayerWaitingPage = lazy(() =>
  import("./pages/player/PlayerWaitingPage").then((module) => ({ default: module.PlayerWaitingPage }))
);
const PlayerQuestionPage = lazy(() =>
  import("./pages/player/PlayerQuestionPage").then((module) => ({ default: module.PlayerQuestionPage }))
);
const PlayerRoundResultPage = lazy(() =>
  import("./pages/player/PlayerRoundResultPage").then((module) => ({ default: module.PlayerRoundResultPage }))
);
const PlayerFinalPage = lazy(() =>
  import("./pages/player/PlayerFinalPage").then((module) => ({ default: module.PlayerFinalPage }))
);
const PlayerEliminatedPage = lazy(() =>
  import("./pages/player/PlayerEliminatedPage").then((module) => ({ default: module.PlayerEliminatedPage }))
);
const AdminLoginPage = lazy(() =>
  import("./pages/admin/AdminLoginPage").then((module) => ({ default: module.AdminLoginPage }))
);
const AdminGamesPage = lazy(() =>
  import("./pages/admin/AdminGamesPage").then((module) => ({ default: module.AdminGamesPage }))
);
const AdminGameBuilderPage = lazy(() =>
  import("./pages/admin/AdminGameBuilderPage").then((module) => ({ default: module.AdminGameBuilderPage }))
);
const AdminControlPage = lazy(() =>
  import("./pages/admin/AdminControlPage").then((module) => ({ default: module.AdminControlPage }))
);
const AdminPlayersPage = lazy(() =>
  import("./pages/admin/AdminPlayersPage").then((module) => ({ default: module.AdminPlayersPage }))
);
const AdminQuestionBankPage = lazy(() =>
  import("./pages/admin/AdminQuestionBankPage").then((module) => ({ default: module.AdminQuestionBankPage }))
);
const AdminImportPage = lazy(() =>
  import("./pages/admin/AdminImportPage").then((module) => ({ default: module.AdminImportPage }))
);

function RouteFallback() {
  return (
    <div className="page-loading">
      <p>頁面載入中...</p>
    </div>
  );
}

function withLazyPage(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function RootLayout() {
  const location = useLocation();
  const isPlayerRoute = location.pathname.startsWith("/player/");
  const adminTarget = hasAdminSession() ? "/admin/games" : "/admin/login";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MEGA FUTURES SPRING PARTY</p>
          <NavLink className="brand" to="/">
            春酒答題平台
          </NavLink>
        </div>
        {!isPlayerRoute ? (
          <nav className="topnav">
            <NavLink to="/player/join">玩家端</NavLink>
            <NavLink to={adminTarget}>主持人後台</NavLink>
          </nav>
        ) : null}
      </header>
      <main className="page-wrap">
        <Outlet />
      </main>
    </div>
  );
}

function AdminGuard() {
  if (!hasAdminSession()) {
    return <Navigate replace to="/admin/login" />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: withLazyPage(<HomePage />) },
      { path: "player/join", element: withLazyPage(<PlayerJoinPage />) },
      { path: "player/waiting", element: withLazyPage(<PlayerWaitingPage />) },
      { path: "player/question", element: withLazyPage(<PlayerQuestionPage />) },
      { path: "player/round-result", element: withLazyPage(<PlayerRoundResultPage />) },
      { path: "player/final", element: withLazyPage(<PlayerFinalPage />) },
      { path: "player/eliminated", element: withLazyPage(<PlayerEliminatedPage />) },
      { path: "admin/login", element: withLazyPage(<AdminLoginPage />) },
      {
        path: "admin",
        element: <AdminGuard />,
        children: [
          { path: "games", element: withLazyPage(<AdminGamesPage />) },
          { path: "games/new", element: withLazyPage(<AdminGameBuilderPage />) },
          { path: "control", element: withLazyPage(<AdminControlPage />) },
          { path: "players", element: withLazyPage(<AdminPlayersPage />) },
          { path: "questions", element: withLazyPage(<AdminQuestionBankPage />) },
          { path: "import", element: withLazyPage(<AdminImportPage />) }
        ]
      }
    ]
  }
]);
