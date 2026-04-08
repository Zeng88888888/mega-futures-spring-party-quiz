import { Navigate, NavLink, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { PlayerJoinPage } from "./pages/player/PlayerJoinPage";
import { PlayerWaitingPage } from "./pages/player/PlayerWaitingPage";
import { PlayerQuestionPage } from "./pages/player/PlayerQuestionPage";
import { PlayerRoundResultPage } from "./pages/player/PlayerRoundResultPage";
import { PlayerFinalPage } from "./pages/player/PlayerFinalPage";
import { PlayerEliminatedPage } from "./pages/player/PlayerEliminatedPage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminGamesPage } from "./pages/admin/AdminGamesPage";
import { AdminGameBuilderPage } from "./pages/admin/AdminGameBuilderPage";
import { AdminControlPage } from "./pages/admin/AdminControlPage";
import { AdminPlayersPage } from "./pages/admin/AdminPlayersPage";
import { AdminQuestionBankPage } from "./pages/admin/AdminQuestionBankPage";
import { AdminImportPage } from "./pages/admin/AdminImportPage";
import { hasAdminSession } from "./lib/adminSession";

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
      { index: true, element: <HomePage /> },
      { path: "player/join", element: <PlayerJoinPage /> },
      { path: "player/waiting", element: <PlayerWaitingPage /> },
      { path: "player/question", element: <PlayerQuestionPage /> },
      { path: "player/round-result", element: <PlayerRoundResultPage /> },
      { path: "player/final", element: <PlayerFinalPage /> },
      { path: "player/eliminated", element: <PlayerEliminatedPage /> },
      { path: "admin/login", element: <AdminLoginPage /> },
      {
        path: "admin",
        element: <AdminGuard />,
        children: [
          { path: "games", element: <AdminGamesPage /> },
          { path: "games/new", element: <AdminGameBuilderPage /> },
          { path: "control", element: <AdminControlPage /> },
          { path: "players", element: <AdminPlayersPage /> },
          { path: "questions", element: <AdminQuestionBankPage /> },
          { path: "import", element: <AdminImportPage /> }
        ]
      }
    ]
  }
]);
