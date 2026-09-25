import { Suspense, lazy, useEffect, type ComponentType } from "react";
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
import { VerifyEmail, ForgotPassword, ResetPassword } from "../pages/AuthRecovery";
import { useMe } from "../lib/hooks";

const STALE_CHUNK_KEY = "chunk-retry";

/** En cas de chunk périmé (onglet ouvert pendant un redéploiement),
 *  recharge une fois pour récupérer le HTML/assets frais. Anti-boucle via sessionStorage. */
function lazyWithRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(STALE_CHUNK_KEY);
      return mod;
    } catch (e) {
      if (!sessionStorage.getItem(STALE_CHUNK_KEY)) {
        sessionStorage.setItem(STALE_CHUNK_KEY, "1");
        window.location.reload();
      }
      throw e;
    }
  });
}
const Dashboard = lazyWithRetry(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Today = lazyWithRetry(() => import("../pages/Today").then((m) => ({ default: m.Today })));
const Tasks = lazyWithRetry(() => import("../pages/Tasks").then((m) => ({ default: m.Tasks })));
const TaskDetail = lazyWithRetry(() => import("../pages/TaskDetail").then((m) => ({ default: m.TaskDetail })));
const Projects = lazyWithRetry(() => import("../pages/Projects").then((m) => ({ default: m.Projects })));
const ProjectDetail = lazyWithRetry(() => import("../pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail })));
const Calendar = lazyWithRetry(() => import("../pages/Calendar").then((m) => ({ default: m.Calendar })));
const Files = lazyWithRetry(() => import("../pages/Files").then((m) => ({ default: m.Files })));
const FileDetail = lazyWithRetry(() => import("../pages/FileDetail").then((m) => ({ default: m.FileDetail })));
const ShareTarget = lazyWithRetry(() => import("../pages/ShareTarget").then((m) => ({ default: m.ShareTarget })));
const Goals = lazyWithRetry(() => import("../pages/Secondary").then((m) => ({ default: m.Goals })));
const Notes = lazyWithRetry(() => import("../pages/Secondary").then((m) => ({ default: m.Notes })));
const Focus = lazyWithRetry(() => import("../pages/Secondary").then((m) => ({ default: m.Focus })));
const Settings = lazyWithRetry(() => import("../pages/Settings").then((m) => ({ default: m.Settings })));

function RequireAuth() {
  const loc = useLocation();
  if (!getAccessToken()) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}

/** Bloque l'app tant que l'email n'est pas vérifié (comptes antérieurs exemptés). */
function RequireVerified() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <Skeleton className="h-40" />;
  if (me.emailVerified === false) return <Navigate to="/verify-email" replace />;
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
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:pb-10 md:pt-6">
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
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/onboarding", element: <Onboarding /> },
  { path: "/verify-email", element: <VerifyEmail /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireVerified />,
        children: [
          {
            element: <AppShell />,
            children: [
          { path: "/", element: <Dashboard /> },
          { path: "/today", element: <Today /> },
          { path: "/tasks", element: <Tasks /> },
          { path: "/tasks/:taskId", element: <TaskDetail /> },
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
