export type ProfileType = "student" | "professional" | "entrepreneur";
export type TaskStatus = "todo" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  profileType: ProfileType;
  onboardingCompleted: boolean;
  emailVerified?: boolean;
  avatar?: string;
  preferences: { language: string; timezone: string; theme: string };
}
export interface Workspace { _id: string; name: string; slug: string; ownerId: string; type: string; }
export interface Project extends Record<string, unknown> {
  _id: string; workspaceId: string; name: string; description?: string;
  status: "active" | "completed" | "archived"; color?: string; progress?: number;
  totalTasks?: number; completedTasks?: number; dueDate?: string;
}
export interface Subtask { _id?: string; title: string; completed: boolean }
export interface Task {
  _id: string; workspaceId: string; projectId?: string; goalId?: string;
  title: string; description?: string; status: TaskStatus; priority: TaskPriority;
  dueDate?: string; startDate?: string; tags: string[]; subtasks: Subtask[];
  estimatedDuration?: number; completedAt?: string; position: number;
  createdAt: string; updatedAt: string;
}
export interface Goal { _id: string; workspaceId: string; title: string; description?: string; targetDate?: string; progress: number; status: string; totalTasks?: number; completedTasks?: number; }
export interface Note { _id: string; workspaceId: string; projectId?: string; taskId?: string | null; title: string; content?: string; updatedAt: string; }
export interface FocusSession { _id: string; taskId?: string; startedAt: string; endedAt?: string; durationSec: number; plannedSec: number; completed: boolean; }
export interface ChatMember { userId: string; firstName: string; lastName: string; lastReadAt: string }
export interface Conversation { _id: string; workspaceId: string; type: "direct" | "group"; name?: string; members: ChatMember[]; lastMessageAt: string; lastMessage: { text: string; senderId: string; createdAt: string } | null; unread: number }
export interface ChatMessage { _id: string; conversationId: string; senderId: string; text: string; createdAt: string }
export interface WorkspaceMember { userId: string; role: string; firstName: string; lastName: string; email: string }
