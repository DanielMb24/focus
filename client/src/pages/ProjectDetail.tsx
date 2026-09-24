import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, useDroppable, useDraggable } from "@dnd-kit/core";
import { useProject, useTasks, useMoveTask } from "../lib/hooks";
import { Topbar } from "../components/layout/Shell";
import { Card, Skeleton, Button } from "../components/ui/primitives";
import { TaskRow } from "../features/tasks/TaskRow";
import { ProjectEdit } from "../features/projects/ProjectEdit";
import { AttachFiles } from "../features/files/AttachFiles";
import type { Task } from "../types";
import { cn } from "../lib/cn";

const cols = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "completed", label: "Terminé" },
] as const;

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task._id });
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined} {...listeners} {...attributes}>
      <TaskRow task={task} />
    </div>
  );
}
function DroppableCol({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn("min-h-[200px] space-y-2 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900/50", isOver && "ring-2 ring-blue-400")}>{children}</div>;
}

export function ProjectDetail() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const { data: tasks = [], isLoading } = useTasks({ projectId });
  const move = useMoveTask();
  const [tab, setTab] = useState<"Overview" | "List" | "Board" | "Files">("Board");
  const [editing, setEditing] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  const byCol = useMemo(() => ({
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  }), [tasks]);

  function onDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id);
    const over = e.over?.id as string | undefined;
    if (over && (over === "todo" || over === "in_progress" || over === "completed")) {
      move.mutate({ id: taskId, status: over });
    }
  }

  return (
    <div>
      <Topbar title={project?.name ?? "Projet"} subtitle={`${tasks.length} tâche(s) · ${project?.progress ?? 0}%`} />
      {project && (
        <div className="mb-3 flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>Modifier le projet</Button>
        </div>
      )}
      {editing && project && <ProjectEdit project={project} onClose={() => setEditing(false)} />}
      <div className="mb-3 flex gap-2" role="tablist" aria-label="Vues projet">
        {(["Overview", "List", "Board", "Files"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? "rounded-full bg-blue-700 px-3.5 py-1.5 text-sm font-medium text-white" : "rounded-full bg-stone-200/60 px-3.5 py-1.5 text-sm text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300"}>{t}</button>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-40" /> : tab === "Board" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 md:grid-cols-3">
            {cols.map((c) => (
              <Card key={c.id}><h3 className="mb-2 text-sm font-semibold">{c.label} ({byCol[c.id].length})</h3>
                <DroppableCol id={c.id}>{byCol[c.id].map((t) => <DraggableCard key={t._id} task={t} />)}</DroppableCol>
              </Card>
            ))}
          </div>
        </DndContext>
      ) : tab === "List" ? (
        <div className="space-y-2">{tasks.map((t) => <TaskRow key={t._id} task={t} />)}</div>
      ) : tab === "Files" ? (
        <Card>{projectId && <AttachFiles entityType="project" entityId={projectId} />}</Card>
      ) : (
        <Card><p className="text-sm text-zinc-600">{project?.description ?? "Aucune description."}</p>
          <p className="mt-2 text-sm">Progression : {project?.progress ?? 0}% ({project?.completedTasks ?? 0}/{project?.totalTasks ?? 0})</p></Card>
      )}
    </div>
  );
}


