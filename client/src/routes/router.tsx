import { Suspense, lazy, useEffect } from "react";
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { getAccessToken } from "../lib/api";
import { Sidebar, MobileNav } from "../components/layout/Shell";
import { QuickAdd } from "../features/tasks/QuickAdd";
import { CommandPalette } from "../components/layout/CommandPalette";
import { UpdatePrompt } from "../components/layout/UpdatePrompt";
import { InstallPrompt } from "../components/layout/InstallPrompt";
import { UploadManager } from "../components/layout/UploadManager";
import { Toasts } from "../components/layout/Toasts";
import { useUI, useWorkspace } from "../store/ui";
import { useWorkspaces } from "../lib/hooks";
import { Skeleton } from "../components/ui/primitives";
import { Login, Register } from "../pages/Auth";
import { Onboarding } from "../pages/Onboarding";

const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Today = lazy(() => import("../pages/Today").then((m) => ({ default: m.Today })));
const Tasks = lazy(() => import("../pages/Tasks").then((m) => ({ default: m.Tasks })));
const Projects = lazy(() => import("../pages/Projects").then((m) => ({ default: m.Projects })));
const ProjectDetail = lazy(() => import("../pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail })));
const Calendar = lazy(() => import("../pages/Calendar").then((m) => ({ default: m.Calendar })));
const Files = lazy(() => import("../pages/Files").then((m) => ({ default: m.Files })));
const FileDetail = lazy(() => import("../pages/FileDetail").then((m) => ({ default: m.FileDetail })));
const ShareTarget = lazy(() => import("../pages/ShareTarget").then((m) => ({ default: m.ShareTarget })));
const Goals = lazy(() => import("../pages/Secondary").then((m) => ({ default: m.Goals })));
const Notes = lazy(() => import("../pages/Secondary").then((m) => ({ default: m.Notes })));
const Focus = lazy(() => import("../pages/Secondary").then((m) => ({ default: m.Focus })));
const Settings = lazy(() => import("../pages/Settings").then((m) => ({ default: m.Settings })));

function RequireAuth() {
  const loc = useLocation();
  if (!getAccessToken()) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}

function AppShell() {
  const { setOnline, apiDown } = useUI();
  const { pathname } = useLocation();
  const { data: workspaces } = useWorkspaces();
  const { activeWorkspaceId, setActive } = useWorkspace();
  useEffect(() => {
    if (workspaces?.length && !workspaces.some((w) => w._id === activeWorkspaceId)) {
      setActive(workspaces[0]._id);
    }
  }, [workspaces, activeWorkspaceId, setActive]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setOnline]);
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
        {apiDown && (
          <div role="alert" className="animate-pop mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            <span>Serveur injoignable — vérifiez votre connexion, l'URL de l'API et la configuration CORS.</span>
            <button onClick={() => window.location.reload()} className="ml-auto rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white">Réessayer</button>
          </div>
        )}
        <Suspense fallback={<Skeleton className="h-40" />}>
          <div key={pathname} className="anim-page">
            <Outlet />
          </div>
        </Suspense>
      </main>
      <MobileNav />
      <QuickAdd />
      <CommandPalette />
      <UpdatePrompt />
      <InstallPrompt />
      <UploadManager />
      <Toasts />
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/onboarding", element: <Onboarding /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/today", element: <Today /> },
          { path: "/tasks", element: <Tasks /> },
          { path: "/projects", element: <Projects /> },
          { path: "/projects/:projectId", element: <ProjectDetail /> },
          { path: "/files", element: <Files /> },
          { path: "/files/:fileId", element: <FileDetail /> },
          { path: "/share-target", element: <ShareTarget /> },
          { path: "/calendar", element: <Calendar /> },
          { path: "/goals", element: <Goals /> },
          { path: "/notes", element: <Notes /> },
          { path: "/focus", element: <Focus /> },
          { path: "/settings", element: <Settings /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
