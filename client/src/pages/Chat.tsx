import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Topbar } from "../components/layout/Shell";
import { Button, Card, EmptyState, Skeleton } from "../components/ui/primitives";
import { useMe } from "../lib/hooks";
import {
  fetchOlderMessages,
  useConversations,
  useCreateConversation,
  useInviteMember,
  useMarkRead,
  useMessages,
  useSendMessage,
  useWorkspaceMembers,
} from "../lib/chat";
import { queryClient } from "../lib/queryClient";
import { useWorkspace } from "../store/ui";
import { cn } from "../lib/cn";
import type { ChatMessage, Conversation } from "../types";

const PAGE_SIZE = 50;

function convoName(c: Conversation, meId?: string): string {
  if (c.type === "group") return c.name ?? `Groupe (${c.members.length})`;
  const other = c.members.find((m) => m.userId !== meId) ?? c.members[0];
  return other ? `${other.firstName} ${other.lastName}`.trim() || "Discussion" : "Discussion";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function bubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hhmm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  if (sameDay) return hhmm;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${hhmm}`;
}

function senderName(c: Conversation, senderId: string): string {
  const m = c.members.find((x) => x.userId === senderId);
  return m ? `${m.firstName} ${m.lastName}`.trim() : "Membre";
}

export function Chat() {
  const { data: me } = useMe();
  const { data: convos = [], isLoading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const selected = convos.find((c) => c._id === selectedId) ?? null;

  return (
    <div className="pb-24 md:pb-8">
      <Topbar title="Messages" subtitle="Espace com" />
      <div className="mb-3 flex items-center justify-end">
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Nouvelle discussion
        </Button>
      </div>
      <div className="flex items-start gap-4">
        <Card className={cn("w-full md:w-[280px] md:shrink-0", selectedId && "hidden md:block")}>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : convos.length === 0 ? (
            <EmptyState
              title="Aucune discussion"
              hint="Créez votre première discussion pour échanger avec les membres de l'espace."
              action={<Button onClick={() => setModalOpen(true)}>Nouvelle discussion</Button>}
            />
          ) : (
            <ul className="space-y-1" aria-label="Discussions">
              {convos.map((c) => {
                const name = convoName(c, me?._id);
                const active = c._id === selectedId;
                const preview = c.lastMessage
                  ? `${c.lastMessage.senderId === me?._id ? "Vous : " : ""}${c.lastMessage.text}`
                  : `${c.members.length} membre${c.members.length > 1 ? "s" : ""}`;
                const when = c.lastMessage ? timeAgo(c.lastMessage.createdAt) : null;
                return (
                  <li key={c._id}>
                    <button
                      onClick={() => setSelectedId(c._id)}
                      aria-current={active}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        active
                          ? "bg-[#eef3ff] dark:bg-zinc-800"
                          : "hover:bg-stone-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700 dark:bg-zinc-700 dark:text-zinc-200">
                        {initials(name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
                            {name}
                          </span>
                          {c.unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] px-1.5 text-[11px] font-bold text-white">
                              {c.unread}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-stone-500 dark:text-zinc-400">
                          {preview}
                          {when && ` · ${when}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className={cn("min-w-0 flex-1", !selectedId && "hidden md:block")}>
          {selected ? (
            <Thread
              key={selected._id}
              convo={selected}
              meId={me?._id}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <EmptyState
              title="Sélectionnez une discussion"
              hint="Choisissez une discussion dans la liste pour lire et envoyer des messages."
            />
          )}
        </Card>
      </div>
      {modalOpen && (
        <NewDiscussionModal
          onClose={() => setModalOpen(false)}
          onCreated={(id) => {
            setModalOpen(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function Thread({ convo, meId, onBack }: { convo: Conversation; meId?: string; onBack: () => void }) {
  const { data: messages = [], isLoading } = useMessages(convo._id, PAGE_SIZE);
  const send = useSendMessage(convo._id);
  const markRead = useMarkRead();
  const [draft, setDraft] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);
  const msgCount = messages.length;
  const lastId = messages.length ? messages[messages.length - 1]._id : "";
  const lastSender = messages.length ? messages[messages.length - 1].senderId : "";

  // Marquer lu à l'ouverture si badge non-lus.
  useEffect(() => {
    if (convo.unread > 0 && markedRef.current !== convo._id) {
      markedRef.current = convo._id;
      markRead.mutate(convo._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo._id, convo.unread]);

  // Marquer lu quand de nouveaux messages arrivent pendant la lecture.
  useEffect(() => {
    if (msgCount > 0 && lastSender && lastSender !== meId) {
      markRead.mutate(convo._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgCount, convo._id]);

  // Auto-scroll en bas à l'arrivée de messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgCount, convo._id, lastId]);

  async function loadOlder() {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const older = await fetchOlderMessages(convo._id, messages[0].createdAt, PAGE_SIZE);
      if (older.length < PAGE_SIZE) setNoMore(true);
      const el = scrollRef.current;
      const prevHeight = el?.scrollHeight ?? 0;
      queryClient.setQueryData<ChatMessage[]>(["messages", convo._id], (old = []) => {
        const ids = new Set(old.map((m) => m._id));
        const extra = older.filter((m) => !ids.has(m._id));
        return [...extra, ...old];
      });
      // Conserve la position après prépend.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending) return;
    setSendErr("");
    try {
      await send.mutateAsync({ text: text.slice(0, 2000) });
      setDraft("");
    } catch (err) {
      setSendErr(err instanceof Error ? err.message : "Échec de l'envoi");
    }
  }

  const memberNames = useMemo(
    () => convo.members.map((m) => `${m.firstName} ${m.lastName}`.trim()).join(", "),
    [convo]
  );

  return (
    <div className="flex h-[62vh] min-h-[420px] flex-col">
      <div className="flex items-center gap-2 border-b border-[#e3e7ee] pb-3 dark:border-zinc-800">
        <button
          onClick={onBack}
          aria-label="Retour aux discussions"
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700 dark:bg-zinc-700 dark:text-zinc-200">
          {initials(convoName(convo, meId))}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-stone-900 dark:text-zinc-100">
            {convoName(convo, meId)}
          </p>
          <p className="truncate text-xs text-stone-500 dark:text-zinc-400" title={memberNames}>
            {convo.type === "group" ? memberNames : `${convo.members.length} membre${convo.members.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3" aria-live="polite" aria-label="Messages">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500 dark:text-zinc-400">
            Aucun message pour le moment. Écrivez le premier.
          </p>
        ) : (
          <>
            <div className="mb-2 text-center">
              {!noMore ? (
                <button
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-[#eef3ff] disabled:opacity-50 dark:text-blue-400 dark:hover:bg-zinc-800"
                >
                  {loadingOlder ? "Chargement…" : "Charger l'historique"}
                </button>
              ) : (
                <p className="text-xs text-stone-400">Début de l'historique</p>
              )}
            </div>
            <div className="space-y-2">
              {messages.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <div key={m._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2",
                        mine
                          ? "rounded-br-md bg-[#1d4ed8] text-white"
                          : "rounded-bl-md bg-stone-100 text-stone-900 dark:bg-zinc-800 dark:text-zinc-100"
                      )}
                    >
                      {convo.type === "group" && !mine && (
                        <p className="mb-0.5 text-[11px] font-bold opacity-80">{senderName(convo, m.senderId)}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                      <p className={cn("mt-1 text-right text-[11px]", mine ? "text-white/70" : "text-stone-400")}>
                        {bubbleTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-[#e3e7ee] pt-3 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écrivez un message…"
            aria-label="Écrivez un message"
            maxLength={2000}
            className="field-control field-sm min-w-0 flex-1"
          />
          <Button type="submit" disabled={!draft.trim() || send.isPending}>
            Envoyer
          </Button>
        </div>
        {sendErr && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
            {sendErr}
          </p>
        )}
      </form>
    </div>
  );
}

function NewDiscussionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data: me } = useMe();
  const { activeWorkspaceId } = useWorkspace();
  const { data: members = [], isLoading } = useWorkspaceMembers();
  const create = useCreateConversation();
  const invite = useInviteMember();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [err, setErr] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const alone = !isLoading && members.filter((m) => m.userId !== me?._id).length === 0;

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => m.userId !== me?._id)
      .filter((m) =>
        q ? `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q) : true
      );
  }, [members, me, search]);

  const isGroup = picked.length > 1 || groupMode;

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function submit() {
    setErr("");
    if (!activeWorkspaceId) {
      setErr("Aucun espace actif.");
      return;
    }
    if (picked.length === 0) {
      setErr("Sélectionnez au moins un membre.");
      return;
    }
    const type = isGroup ? "group" : "direct";
    try {
      const d = await create.mutateAsync({
        workspaceId: activeWorkspaceId,
        type,
        memberIds: picked,
        ...(type === "group" && groupName.trim() ? { name: groupName.trim() } : {}),
      });
      onCreated(d.conversation._id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec de la création");
    }
  }

  async function submitInvite() {
    setInviteMsg(null);
    if (!inviteEmail.trim()) return;
    try {
      const d = await invite.mutateAsync(inviteEmail.trim());
      setInviteMsg({ ok: true, text: `${d.member.firstName} a rejoint l'espace — cochez son nom ci-dessus.` });
      setInviteEmail("");
    } catch (e) {
      setInviteMsg({ ok: false, text: e instanceof Error ? e.message : "Échec de l'invitation" });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouvelle discussion"
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#e3e7ee] bg-white p-5 shadow-lift dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold tracking-tight">Nouvelle discussion</h2>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre…"
          aria-label="Rechercher un membre"
          className="field-control field-sm mt-3 w-full"
        />
        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[#e3e7ee] dark:border-zinc-700">
          {isLoading ? (
            <Skeleton className="m-2 h-16" />
          ) : alone ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-bold">Vous êtes seul dans cet espace.</p>
              <p className="mt-1 text-sm text-stone-500">Invitez un collègue ci-dessous pour discuter.</p>
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-500">
              {search.trim() ? `Aucun résultat pour « ${search.trim()} ».` : "Aucun membre disponible."}
            </p>
          ) : (
            candidates.map((m) => (
              <label
                key={m.userId}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-stone-50 dark:hover:bg-zinc-800"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(m.userId)}
                  onChange={() => toggle(m.userId)}
                  className="h-4 w-4 accent-[#1d4ed8]"
                />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {initials(`${m.firstName} ${m.lastName}`)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="block truncate text-xs text-stone-500">{m.email}</span>
                </span>
              </label>
            ))
          )}
        </div>
        {(alone || showInvite) && (
          <div className="mt-3 rounded-xl border border-dashed border-[#c9cfdb] p-3 dark:border-zinc-700">
            <p className="text-sm font-bold">Inviter dans l'espace</p>
            <p className="mt-0.5 text-xs text-stone-500">Par email — la personne doit déjà avoir un compte Focus.</p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submitInvite(); }}
                placeholder="collegue@exemple.com"
                aria-label="Email à inviter"
                className="field-control field-sm w-full"
              />
              <Button onClick={() => void submitInvite()} disabled={invite.isPending || !inviteEmail.trim()} className="shrink-0 !py-2 text-sm">
                {invite.isPending ? "…" : "Inviter"}
              </Button>
            </div>
            {inviteMsg && (
              <p className={inviteMsg.ok ? "mt-1.5 text-xs font-medium text-emerald-700" : "mt-1.5 text-xs font-medium text-red-700"} role={inviteMsg.ok ? "status" : "alert"}>
                {inviteMsg.text}
              </p>
            )}
          </div>
        )}
        {!alone && !showInvite && (
          <button onClick={() => setShowInvite(true)} className="mt-2 text-xs font-medium text-stone-400 transition hover:text-stone-700">
            + Inviter quelqu'un dans l'espace
          </button>
        )}
        {!alone && (
          <>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-stone-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={groupMode}
                onChange={(e) => setGroupMode(e.target.checked)}
                className="h-4 w-4 accent-[#1d4ed8]"
              />
              Créer un groupe
            </label>
            {isGroup && (
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nom du groupe (optionnel)"
                aria-label="Nom du groupe"
                maxLength={80}
                className="field-control field-sm mt-2 w-full"
              />
            )}
            {err && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                {err}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={submit} disabled={create.isPending || picked.length === 0}>
                {create.isPending ? "Création…" : "Créer"}
              </Button>
            </div>
          </>
        )}
        {alone && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
