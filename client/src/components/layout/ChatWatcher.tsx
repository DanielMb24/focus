import { useEffect, useRef } from "react";
import { queryClient } from "../../lib/queryClient";
import { notify } from "../../lib/notify";
import { maybeSendDailyDigest } from "../../lib/digest";
import type { Conversation } from "../../types";

function unreadSum(): { total: number; top: Conversation | null } {
  let total = 0;
  let top: Conversation | null = null;
  for (const [, data] of queryClient.getQueriesData<Conversation[]>({ queryKey: ["conversations"] })) {
    if (!Array.isArray(data)) continue;
    for (const c of data) {
      total += c.unread ?? 0;
      if ((c.unread ?? 0) > 0 && (!top || (top.unread ?? 0) < (c.unread ?? 0))) top = c;
    }
  }
  return { total, top };
}

function convoLabel(c: Conversation, meId?: string): string {
  if (c.type === "group") return c.name ?? `Groupe (${c.members.length})`;
  const other = c.members.find((m) => m.userId !== meId) ?? c.members[0];
  return other ? `${other.firstName} ${other.lastName}`.trim() : "Discussion";
}

/** Surveille les non-lus (zéro requête en plus : branché sur le cache existant).
 *  Notifie uniquement quand l'onglet est caché (sinon le fil est sous les yeux).
 *  Lance aussi le bilan quotidien au démarrage. */
export function ChatWatcher() {
  const last = useRef<number>(-1);

  useEffect(() => {
    last.current = unreadSum().total;
    void maybeSendDailyDigest();
    const onVisible = () => {
      if (document.visibilityState === "visible") void maybeSendDailyDigest();
    };
    document.addEventListener("visibilitychange", onVisible);
    const unsub = queryClient.getQueryCache().subscribe(() => {
      const { total, top } = unreadSum();
      const prev = last.current;
      last.current = total;
      if (prev >= 0 && total > prev && top && document.hidden) {
        const me = queryClient.getQueryData<{ user?: { _id?: string } }>(["me"])?.user?._id;
        const label = convoLabel(top, me);
        const text = top.lastMessage?.text ?? "";
        const body = text.length > 120 ? `${text.slice(0, 120)}…` : text;
        void notify(`Message de ${label}`, body || undefined, "chat", `chat-${top._id}-${top.lastMessageAt}`);
      }
    });
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      unsub();
    };
  }, []);

  return null;
}
