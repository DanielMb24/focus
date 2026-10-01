import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { queryClient } from "./queryClient";
import { useWorkspace } from "../store/ui";
import type { ChatMessage, Conversation, WorkspaceMember } from "../types";

/** Normalise la réponse messages : tableau direct (helper `api()` dépouille `meta`)
 *  ou objet paginé `{ data: [] }` si le format évolue. */
function toMessageList(raw: ChatMessage[] | { data: ChatMessage[] } | null | undefined): ChatMessage[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: unknown }).data)) return (raw as { data: ChatMessage[] }).data;
  return [];
}

export function useConversations(pollMs = 5000) {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["conversations", activeWorkspaceId],
    queryFn: () =>
      api<{ conversations: Conversation[] }>(`/api/v1/chat/conversations?workspaceId=${activeWorkspaceId}`).then(
        (d) => d.conversations ?? []
      ),
    enabled: !!activeWorkspaceId,
    refetchInterval: pollMs,
  });
}

export function useWorkspaceMembers() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["ws-members", activeWorkspaceId],
    queryFn: () =>
      api<{ members: WorkspaceMember[] }>(`/api/v1/workspaces/${activeWorkspaceId}/members`).then(
        (d) => d.members ?? []
      ),
    enabled: !!activeWorkspaceId,
  });
}

export function useMessages(convoId?: string | null, limit = 50) {
  return useQuery({
    queryKey: ["messages", convoId],
    queryFn: async () => {
      const raw = await api<ChatMessage[] | { data: ChatMessage[] }>(
        `/api/v1/chat/conversations/${convoId}/messages?limit=${limit}`
      );
      const fresh = toMessageList(raw);
      // Le polling ne renvoie que les 50 derniers : conserve l'historique
      // déjà chargé (plus ancien que le plus ancien message frais).
      const cached = queryClient.getQueryData<ChatMessage[]>(["messages", convoId]) ?? [];
      if (!cached.length) return fresh;
      const freshIds = new Set(fresh.map((m) => m._id));
      const earliest = fresh.length ? fresh[0].createdAt : null;
      const older = cached.filter(
        (m) => !freshIds.has(m._id) && (earliest ? m.createdAt < earliest : true)
      );
      return [...older, ...fresh];
    },
    enabled: !!convoId,
    refetchInterval: 4000,
  });
}

/** Charge une page plus ancienne (`before` = ISO du plus ancien message connu). */
export async function fetchOlderMessages(convoId: string, before: string, limit = 50): Promise<ChatMessage[]> {
  const raw = await api<ChatMessage[] | { data: ChatMessage[] }>(
    `/api/v1/chat/conversations/${convoId}/messages?limit=${limit}&before=${encodeURIComponent(before)}`
  );
  return toMessageList(raw);
}

export function useSendMessage(convoId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string }) =>
      api<{ message: ChatMessage }>(`/api/v1/chat/conversations/${convoId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", convoId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convoId: string) =>
      api<Record<string, never>>(`/api/v1/chat/conversations/${convoId}/read`, {
        method: "PATCH",
        body: "{}",
      }),
    // Doux : on ne touche pas aux messages, seule la liste (badges) se rafraîchit.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; type: "direct" | "group"; memberIds: string[]; name?: string }) =>
      api<{ conversation: Conversation; reused: boolean }>("/api/v1/chat/conversations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  return useMutation({
    mutationFn: (email: string) =>
      api<{ member: WorkspaceMember }>(`/api/v1/workspaces/${activeWorkspaceId}/invite`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ws-members"] });
    },
  });
}
