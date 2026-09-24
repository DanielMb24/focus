import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useWorkspace } from "../store/ui";
import { useWorkspaces } from "../lib/hooks";
import { Topbar } from "../components/layout/Shell";
import { Card, Button, EmptyState } from "../components/ui/primitives";

/** Cible de partage PWA (texte/liens partagés depuis le système → note). */
export function ShareTarget() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { data: workspaces = [] } = useWorkspaces();
  const qc = useQueryClient();
  const [wsId, setWsId] = useState(activeWorkspaceId ?? "");
  const [done, setDone] = useState(false);

  const title = params.get("title") ?? "";
  const text = params.get("text") ?? "";
  const url = params.get("url") ?? "";
  const shared = [title, text, url].filter(Boolean).join("\n");

  const create = useMutation({
    mutationFn: () =>
      api("/api/v1/notes", {
        method: "POST",
        body: JSON.stringify({ workspaceId: wsId || activeWorkspaceId, title: title || url || "Élément partagé", content: shared }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); setDone(true); },
  });

  if (!shared) {
    return (
      <div>
        <Topbar title="Partage" subtitle="Aucun contenu reçu" />
        <EmptyState title="Rien à importer" hint="Partagez du texte ou un lien depuis une autre application vers Focus." action={<Link to="/notes"><Button>Voir mes notes</Button></Link>} />
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Recevoir le partage" subtitle="Enregistrer dans Focus" />
      <Card className="max-w-lg">
        <p className="whitespace-pre-wrap text-sm">{shared}</p>
        <label className="mt-4 block text-sm font-medium">Destination
          <select value={wsId || activeWorkspaceId || ""} onChange={(e) => setWsId(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {workspaces.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
        </label>
        {done
          ? <div className="mt-4"><p className="text-sm font-bold text-emerald-700">Enregistré en note.</p><Button className="mt-2" onClick={() => nav("/notes")}>Voir mes notes</Button></div>
          : <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => nav("/")}>Annuler</Button>
              <Button disabled={create.isPending || (!wsId && !activeWorkspaceId)} onClick={() => create.mutate()}>Enregistrer</Button>
            </div>}
      </Card>
    </div>
  );
}
