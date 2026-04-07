"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  display_name: string;
};

type TaskComment = {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  profiles?: {
    display_name: string;
  } | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  label: string | null;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  role: string;
};

type RawCommentRow = {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  profiles:
    | {
        display_name: string;
      }
    | {
        display_name: string;
      }[]
    | null;
};

const columns = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const;

type ColumnKey = (typeof columns)[number]["key"];
type ViewMode = "kanban" | "list";

export default function TaskboardPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({});

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ColumnKey>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | "low" | "medium" | "high">("all");
  const [filterLabel, setFilterLabel] = useState("all");
  const [filterAssignedTo, setFilterAssignedTo] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<ColumnKey>("todo");
  const [label, setLabel] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editStatus, setEditStatus] = useState<ColumnKey>("todo");
  const [editLabel, setEditLabel] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string>("unassigned");
  const [editDueDate, setEditDueDate] = useState("");

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/Task-Viewer");
        return;
      }

      setUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = (roleData as RoleRow[] | null)?.map((r) => r.role) || [];
      const allowedRoles = ["Akhari"];

      if (!roleList.some((role) => allowedRoles.includes(role))) {
        router.replace("/");
        return;
      }

      await Promise.all([fetchProfiles(), fetchTasks()]);
      setLoadingAuth(false);
    };

    init();
  }, [router]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name");

    if (!error) {
      setProfiles((data as Profile[] | null) || []);
    }
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);

    const { data, error } = await supabase
      .from("taskboard_tasks")
      .select("*")
      .order("status", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error) {
      setTasks((data as Task[] | null) || []);
      await fetchComments();
    }

    setLoadingTasks(false);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("taskboard_comments")
      .select(`
        id,
        task_id,
        user_id,
        content,
        created_at,
        profiles:user_id ( display_name )
      `)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    const rawComments = data as RawCommentRow[];
    const grouped: Record<string, TaskComment[]> = {};

    const typedComments: TaskComment[] = rawComments.map((comment) => ({
      id: comment.id,
      task_id: comment.task_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      profiles: Array.isArray(comment.profiles)
        ? comment.profiles[0] ?? null
        : comment.profiles ?? null,
    }));

    for (const comment of typedComments) {
      if (!grouped[comment.task_id]) {
        grouped[comment.task_id] = [];
      }
      grouped[comment.task_id].push(comment);
    }

    setCommentsByTask(grouped);
  };

  const refreshBoard = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setStatus("todo");
    setLabel("");
    setAssignedTo("unassigned");
    setDueDate("");
  };

  const createTask = async () => {
    if (!title.trim() || !userId) return;

    setSaving(true);

    const columnTasks = tasks.filter((task) => task.status === status);
    const nextPosition =
      columnTasks.length > 0
        ? Math.max(...columnTasks.map((task) => task.position || 0)) + 1
        : 0;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      label: label.trim() || null,
      assigned_to: assignedTo === "unassigned" ? null : assignedTo,
      created_by: userId,
      due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      position: nextPosition,
    };

    const { error } = await supabase.from("taskboard_tasks").insert(payload);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetCreateForm();
    await fetchTasks();
  };

  const openEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditLabel(task.label || "");
    setEditAssignedTo(task.assigned_to || "unassigned");
    setEditDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : "");
  };

  const saveEdit = async () => {
    if (!editingTaskId || !editTitle.trim()) return;

    const originalTask = tasks.find((task) => task.id === editingTaskId);
    if (!originalTask) return;

    let nextPosition = originalTask.position;

    if (originalTask.status !== editStatus) {
      const columnTasks = tasks.filter(
        (task) => task.status === editStatus && task.id !== editingTaskId
      );
      nextPosition =
        columnTasks.length > 0
          ? Math.max(...columnTasks.map((task) => task.position || 0)) + 1
          : 0;
    }

    const { error } = await supabase
      .from("taskboard_tasks")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        status: editStatus,
        label: editLabel.trim() || null,
        assigned_to: editAssignedTo === "unassigned" ? null : editAssignedTo,
        due_date: editDueDate ? new Date(`${editDueDate}T12:00:00`).toISOString() : null,
        position: nextPosition,
      })
      .eq("id", editingTaskId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingTaskId(null);
    await fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("taskboard_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchTasks();
  };

  const moveTaskToStatus = async (taskId: string, newStatus: ColumnKey) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const columnTasks = tasks.filter((task) => task.status === newStatus && task.id !== taskId);
    const nextPosition =
      columnTasks.length > 0
        ? Math.max(...columnTasks.map((task) => task.position || 0)) + 1
        : 0;

    const { error } = await supabase
      .from("taskboard_tasks")
      .update({
        status: newStatus,
        position: nextPosition,
      })
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchTasks();
  };

  const addComment = async (taskId: string) => {
    const content = newComment[taskId]?.trim();
    if (!content || !userId) return;

    const { error } = await supabase.from("taskboard_comments").insert({
      task_id: taskId,
      user_id: userId,
      content,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewComment((prev) => ({
      ...prev,
      [taskId]: "",
    }));

    await fetchComments();
  };

  const getProfileName = (id: string | null) => {
    if (!id) return "Unassigned";
    return profiles.find((p) => p.id === id)?.display_name || "Unknown";
  };

  const getPriorityStyle = (value: string) => {
    switch (value) {
      case "high":
        return "text-red-300 border-red-500/30 bg-red-500/15";
      case "medium":
        return "text-amber-300 border-amber-500/30 bg-amber-500/15";
      case "low":
        return "text-sky-300 border-sky-500/30 bg-sky-500/15";
      default:
        return "text-[#00ff66] border-[#00ff66]/30 bg-[#00ff66]/10";
    }
  };

  const getLabelStyle = (value: string | null) => {
    if (!value) return "text-gray-300 border-white/10 bg-white/5";

    const lower = value.toLowerCase();

    if (lower.includes("website")) return "text-cyan-300 border-cyan-500/30 bg-cyan-500/10";
    if (lower.includes("personnel")) return "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10";
    if (lower.includes("logistics")) return "text-orange-300 border-orange-500/30 bg-orange-500/10";
    if (lower.includes("hammer")) return "text-red-300 border-red-500/30 bg-red-500/10";
    if (lower.includes("training")) return "text-violet-300 border-violet-500/30 bg-violet-500/10";
    if (lower.includes("ops")) return "text-lime-300 border-lime-500/30 bg-lime-500/10";

    return "text-[#00ff66] border-[#00ff66]/30 bg-[#00ff66]/10";
  };

  const getColumnStyle = (key: ColumnKey) => {
    switch (key) {
      case "todo":
        return {
          shell: "border-cyan-500/25 bg-gradient-to-b from-cyan-950/30 to-black/60",
          header: "text-cyan-300",
          badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
          empty: "border-cyan-500/20 text-cyan-200/50",
        };
      case "in_progress":
        return {
          shell: "border-blue-500/25 bg-gradient-to-b from-blue-950/30 to-black/60",
          header: "text-blue-300",
          badge: "border-blue-500/30 bg-blue-500/10 text-blue-300",
          empty: "border-blue-500/20 text-blue-200/50",
        };
      case "review":
        return {
          shell: "border-amber-500/25 bg-gradient-to-b from-amber-950/30 to-black/60",
          header: "text-amber-300",
          badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
          empty: "border-amber-500/20 text-amber-200/50",
        };
      case "done":
        return {
          shell: "border-emerald-500/25 bg-gradient-to-b from-emerald-950/30 to-black/60",
          header: "text-emerald-300",
          badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
          empty: "border-emerald-500/20 text-emerald-200/50",
        };
    }
  };

  const getTaskCardStyle = (status: ColumnKey) => {
    switch (status) {
      case "todo":
        return "border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-black/70 hover:border-cyan-400/40";
      case "in_progress":
        return "border-blue-500/20 bg-gradient-to-br from-blue-950/20 to-black/70 hover:border-blue-400/40";
      case "review":
        return "border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-black/70 hover:border-amber-400/40";
      case "done":
        return "border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-black/70 hover:border-emerald-400/40";
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "No due date";
    return new Date(value).toLocaleDateString();
  };

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString();
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === "done") return false;
    return new Date(task.due_date).getTime() < new Date().getTime();
  };

  const isDueToday = (task: Task) => {
    if (!task.due_date || task.status === "done") return false;
    const due = new Date(task.due_date);
    const now = new Date();

    return (
      due.getFullYear() === now.getFullYear() &&
      due.getMonth() === now.getMonth() &&
      due.getDate() === now.getDate()
    );
  };

  const getLatestCommentPreview = (taskId: string) => {
    const comments = commentsByTask[taskId] || [];
    if (comments.length === 0) return null;
    const latest = comments[comments.length - 1];
    return latest.content;
  };

  const uniqueLabels = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.label).filter(Boolean) as string[])).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const search = searchTerm.trim().toLowerCase();
      const profileName = getProfileName(task.assigned_to).toLowerCase();
      const latestComment = getLatestCommentPreview(task.id)?.toLowerCase() || "";

      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search) ||
        (task.description || "").toLowerCase().includes(search) ||
        (task.label || "").toLowerCase().includes(search) ||
        profileName.includes(search) ||
        latestComment.includes(search);

      const matchesStatus = filterStatus === "all" || task.status === filterStatus;
      const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
      const matchesLabel = filterLabel === "all" || task.label === filterLabel;
      const matchesAssigned =
        filterAssignedTo === "all" ||
        (filterAssignedTo === "unassigned" ? !task.assigned_to : task.assigned_to === filterAssignedTo);
      const matchesMine = !onlyMine || task.assigned_to === userId;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesLabel &&
        matchesAssigned &&
        matchesMine
      );
    });
  }, [
    tasks,
    searchTerm,
    filterStatus,
    filterPriority,
    filterLabel,
    filterAssignedTo,
    onlyMine,
    userId,
    commentsByTask,
  ]);

  const groupedTasks = useMemo(() => {
    return {
      todo: filteredTasks
        .filter((task) => task.status === "todo")
        .sort((a, b) => a.position - b.position),
      in_progress: filteredTasks
        .filter((task) => task.status === "in_progress")
        .sort((a, b) => a.position - b.position),
      review: filteredTasks
        .filter((task) => task.status === "review")
        .sort((a, b) => a.position - b.position),
      done: filteredTasks
        .filter((task) => task.status === "done")
        .sort((a, b) => a.position - b.position),
    };
  }, [filteredTasks]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const overdue = filteredTasks.filter((task) => isOverdue(task)).length;
    const dueToday = filteredTasks.filter((task) => isDueToday(task)).length;
    const inReview = filteredTasks.filter((task) => task.status === "review").length;
    const completed = filteredTasks.filter((task) => task.status === "done").length;

    return { total, overdue, dueToday, inReview, completed };
  }, [filteredTasks]);

const renderTaskCard = (task: Task) => {
  const taskComments = commentsByTask[task.id] || [];
  const isExpanded = expandedTaskId === task.id;
  const latestCommentPreview = getLatestCommentPreview(task.id);
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const isCompactDoneCard = viewMode === "kanban" && task.status === "done" && !isExpanded;

  if (isCompactDoneCard) {
    return (
      <div
        key={task.id}
        draggable={viewMode === "kanban"}
        onDragStart={() => setDraggedTaskId(task.id)}
        className="group rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/35 via-black/80 to-black/70 p-3 transition hover:border-emerald-400/40 hover:bg-emerald-950/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.12)] cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
            <h4 className="truncate text-sm font-semibold text-emerald-50">
              {task.title}
            </h4>
          </div>

          <button
            onClick={() => setExpandedTaskId(task.id)}
            className="shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-300"
          >
            Expand
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      key={task.id}
      draggable={viewMode === "kanban"}
      onDragStart={() => setDraggedTaskId(task.id)}
      className={`rounded-2xl border p-4 transition shadow-[0_0_20px_rgba(0,0,0,0.25)] ${
        viewMode === "kanban" ? "cursor-grab active:cursor-grabbing" : ""
      } ${getTaskCardStyle(task.status)} ${overdue ? "ring-1 ring-red-500/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="text-white text-base font-semibold leading-snug">
          {task.title}
        </h4>
        <span
          className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${getPriorityStyle(task.priority)}`}
        >
          {task.priority.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {task.label && (
          <span
            className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${getLabelStyle(task.label)}`}
          >
            {task.label}
          </span>
        )}

        {overdue && (
          <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-red-500/30 bg-red-500/15 text-red-300">
            Overdue
          </span>
        )}

        {!overdue && dueToday && (
          <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-amber-500/30 bg-amber-500/15 text-amber-300">
            Due Today
          </span>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-gray-300 mb-4 whitespace-pre-wrap">
          {task.description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-4">
        <div>
          <span className="text-[#00ff66]">Assigned:</span> {getProfileName(task.assigned_to)}
        </div>
        <div>
          <span className="text-[#00ff66]">Due:</span> {formatDate(task.due_date)}
        </div>
        <div>
          <span className="text-[#00ff66]">Status:</span>{" "}
          {columns.find((c) => c.key === task.status)?.label}
        </div>
        <div>
          <span className="text-[#00ff66]">Comments:</span> {taskComments.length}
        </div>
      </div>

      {latestCommentPreview && !isExpanded && (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-violet-300 mb-1">
            Latest Comment
          </div>
          <div className="text-sm text-gray-300 line-clamp-2">
            {latestCommentPreview}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {task.status !== "todo" && (
          <button
            onClick={() => moveTaskToStatus(task.id, "todo")}
            className="px-3 py-1 rounded-lg border border-cyan-500/30 text-xs text-cyan-300 hover:bg-cyan-500/10"
          >
            To Do
          </button>
        )}

        {task.status !== "in_progress" && (
          <button
            onClick={() => moveTaskToStatus(task.id, "in_progress")}
            className="px-3 py-1 rounded-lg border border-blue-500/30 text-xs text-blue-300 hover:bg-blue-500/10"
          >
            In Progress
          </button>
        )}

        {task.status !== "review" && (
          <button
            onClick={() => moveTaskToStatus(task.id, "review")}
            className="px-3 py-1 rounded-lg border border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/10"
          >
            Review
          </button>
        )}

        {task.status !== "done" && (
          <button
            onClick={() => moveTaskToStatus(task.id, "done")}
            className="px-3 py-1 rounded-lg border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/10"
          >
            Done
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => openEdit(task)}
          className="px-3 py-1 rounded-lg border border-fuchsia-500/30 text-xs text-fuchsia-300 hover:bg-fuchsia-500/10"
        >
          Edit
        </button>

        <button
          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
          className="px-3 py-1 rounded-lg border border-violet-500/30 text-xs text-violet-300 hover:bg-violet-500/10"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>

        <button
          onClick={() => deleteTask(task.id)}
          className="px-3 py-1 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-4 text-xs text-gray-400">
            <span className="text-[#00ff66]">Updated:</span> {formatDateTime(task.updated_at)}
          </div>

          <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-1">
            {taskComments.length === 0 ? (
              <div className="text-sm text-gray-500">No comments yet</div>
            ) : (
              taskComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl border border-white/10 bg-black/40 p-3"
                >
                  <div className="text-xs text-[#00ff66] mb-1">
                    {comment.profiles?.display_name || "Unknown"} •{" "}
                    {formatDateTime(comment.created_at)}
                  </div>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">
                    {comment.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <textarea
              value={newComment[task.id] || ""}
              onChange={(e) =>
                setNewComment((prev) => ({
                  ...prev,
                  [task.id]: e.target.value,
                }))
              }
              rows={3}
              placeholder="Add comment..."
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[#00ff66]/20 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/30 resize-none"
            />
            <button
              onClick={() => addComment(task.id)}
              className="px-3 py-2 rounded-lg border border-[#00ff66]/30 text-sm text-[#00ff66] hover:bg-[#00ff66]/10"
            >
              Add Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Loading Taskboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-[radial-gradient(circle_at_top,#021b11_0%,#010b08_45%,#000000_100%)] text-white">
      <button
        onClick={() => router.push("/")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-[1900px] mx-auto space-y-8">
        <div className="rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg p-8 shadow-[0_0_60px_rgba(0,255,100,0.12)]">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#00ff66] mb-2">
                Taskboard
              </h1>
              <p className="text-gray-400">
                Track Ideas, changes, requests etc.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex rounded-xl border border-violet-500/30 bg-black/30 p-1">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    viewMode === "kanban"
                      ? "bg-violet-500/15 text-violet-300"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    viewMode === "list"
                      ? "bg-violet-500/15 text-violet-300"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  List
                </button>
              </div>

              <button
                onClick={refreshBoard}
                disabled={refreshing || loadingTasks}
                className="px-4 py-3 rounded-xl border border-cyan-500/40 text-cyan-300 font-semibold hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh Board"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-300 mb-1">Total</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-4">
            <div className="text-xs uppercase tracking-wide text-red-300 mb-1">Overdue</div>
            <div className="text-2xl font-bold text-white">{stats.overdue}</div>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4">
            <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">Due Today</div>
            <div className="text-2xl font-bold text-white">{stats.dueToday}</div>
          </div>

          <div className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4">
            <div className="text-xs uppercase tracking-wide text-violet-300 mb-1">In Review</div>
            <div className="text-2xl font-bold text-white">{stats.inReview}</div>
          </div>

          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-300 mb-1">Completed</div>
            <div className="text-2xl font-bold text-white">{stats.completed}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg p-6 shadow-[0_0_40px_rgba(0,255,100,0.08)]">
          <h2 className="text-xl font-semibold text-[#00ff66] mb-4">
            Search & Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks, labels, comments..."
              className="px-4 py-3 rounded-xl bg-black/40 border border-cyan-500/30 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | ColumnKey)}
              className="px-4 py-3 rounded-xl bg-black/40 border border-blue-500/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) =>
                setFilterPriority(e.target.value as "all" | "low" | "medium" | "high")
              }
              className="px-4 py-3 rounded-xl bg-black/40 border border-amber-500/30 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="px-4 py-3 rounded-xl bg-black/40 border border-fuchsia-500/30 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              <option value="all">All Labels</option>
              {uniqueLabels.map((labelOption) => (
                <option key={labelOption} value={labelOption}>
                  {labelOption}
                </option>
              ))}
            </select>

            <select
              value={filterAssignedTo}
              onChange={(e) => setFilterAssignedTo(e.target.value)}
              className="px-4 py-3 rounded-xl bg-black/40 border border-emerald-500/30 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/40 border border-violet-500/30 text-white">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              <span className="text-sm">Only my tasks</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("all");
                setFilterPriority("all");
                setFilterLabel("all");
                setFilterAssignedTo("all");
                setOnlyMine(false);
              }}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10"
            >
              Reset Filters
            </button>

            <div className="px-4 py-2 rounded-xl border border-[#00ff66]/20 bg-[#00ff66]/5 text-sm text-gray-300">
              Showing {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg p-6 shadow-[0_0_40px_rgba(0,255,100,0.08)]">
          <h2 className="text-xl font-semibold text-[#00ff66] mb-4">
            Create Task
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="px-4 py-3 rounded-xl bg-black/40 border border-cyan-500/30 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ColumnKey)}
              className="px-4 py-3 rounded-xl bg-black/40 border border-blue-500/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
              className="px-4 py-3 rounded-xl bg-black/40 border border-amber-500/30 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>

            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label / tag"
              className="px-4 py-3 rounded-xl bg-black/40 border border-fuchsia-500/30 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />

            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="px-4 py-3 rounded-xl bg-black/40 border border-emerald-500/30 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="unassigned">Unassigned</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-4 py-3 rounded-xl bg-black/40 border border-orange-500/30 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />

            <button
              onClick={createTask}
              disabled={saving || !title.trim()}
              className="px-4 py-3 rounded-xl border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Task description"
            rows={4}
            className="mt-4 w-full px-4 py-3 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/40 resize-none"
          />
        </div>

        {editingTaskId && (
          <div className="rounded-3xl border border-cyan-500/30 bg-black/70 backdrop-blur-lg p-6 shadow-[0_0_40px_rgba(0,200,255,0.12)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-cyan-300">Edit Task</h2>
              <button
                onClick={() => setEditingTaskId(null)}
                className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
                className="px-4 py-3 rounded-xl bg-black/40 border border-cyan-500/30 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />

              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ColumnKey)}
                className="px-4 py-3 rounded-xl bg-black/40 border border-blue-500/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>

              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as "low" | "medium" | "high")}
                className="px-4 py-3 rounded-xl bg-black/40 border border-amber-500/30 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>

              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Label / tag"
                className="px-4 py-3 rounded-xl bg-black/40 border border-fuchsia-500/30 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />

              <select
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                className="px-4 py-3 rounded-xl bg-black/40 border border-emerald-500/30 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="unassigned">Unassigned</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="px-4 py-3 rounded-xl bg-black/40 border border-orange-500/30 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />

              <button
                onClick={saveEdit}
                disabled={!editTitle.trim()}
                className="px-4 py-3 rounded-xl border border-cyan-500/50 text-cyan-300 font-semibold hover:bg-cyan-500/10 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>

            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Task description"
              rows={4}
              className="mt-4 w-full px-4 py-3 rounded-xl bg-black/40 border border-cyan-500/30 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
            />
          </div>
        )}

        {loadingTasks ? (
          <div className="text-center text-gray-400 py-16">Loading tasks...</div>
        ) : viewMode === "kanban" ? (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {columns.map((column) => {
              const columnStyle = getColumnStyle(column.key);

              return (
                <div
                  key={column.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    if (!draggedTaskId) return;
                    await moveTaskToStatus(draggedTaskId, column.key);
                    setDraggedTaskId(null);
                  }}
                  className={`rounded-3xl border backdrop-blur-lg p-4 min-h-[550px] ${columnStyle.shell}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-bold ${columnStyle.header}`}>
                      {column.label}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs border ${columnStyle.badge}`}>
                      {groupedTasks[column.key].length}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {groupedTasks[column.key].length === 0 ? (
                      <div
                        className={`rounded-2xl border border-dashed bg-black/30 p-6 text-center text-sm ${columnStyle.empty}`}
                      >
                        Drop tasks here
                      </div>
                    ) : (
                      groupedTasks[column.key].map((task) => renderTaskCard(task))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg p-6 shadow-[0_0_40px_rgba(0,255,100,0.08)] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#00ff66]/20 text-[#00ff66]">
                  <th className="p-3">Task</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Label</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3">Due</th>
                  <th className="p-3">Comments</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-500">
                      No tasks match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks
                    .slice()
                    .sort((a, b) => {
                      const statusOrder =
                        columns.findIndex((c) => c.key === a.status) -
                        columns.findIndex((c) => c.key === b.status);
                      if (statusOrder !== 0) return statusOrder;
                      return a.position - b.position;
                    })
                    .flatMap((task) => {
                      const commentCount = commentsByTask[task.id]?.length || 0;
                      const overdue = isOverdue(task);
                      const dueToday = isDueToday(task);
                      const isExpanded = expandedTaskId === task.id;
                      const taskComments = commentsByTask[task.id] || [];

                      const rows = [
                        <tr
                          key={task.id}
                          className="border-b border-white/5 hover:bg-white/5 transition"
                        >
                          <td className="p-3">
                            <div className="font-semibold text-white">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-gray-400 mt-1 line-clamp-2">
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-sm text-gray-300">
                            {columns.find((c) => c.key === task.status)?.label}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${getPriorityStyle(task.priority)}`}
                            >
                              {task.priority.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3">
                            {task.label ? (
                              <span
                                className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${getLabelStyle(task.label)}`}
                              >
                                {task.label}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-sm">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-gray-300">
                            {getProfileName(task.assigned_to)}
                          </td>
                          <td className="p-3 text-sm">
                            <span
                              className={
                                overdue
                                  ? "text-red-300"
                                  : dueToday
                                  ? "text-amber-300"
                                  : "text-gray-300"
                              }
                            >
                              {formatDate(task.due_date)}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-gray-300">{commentCount}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => openEdit(task)}
                                className="px-3 py-1 rounded-lg border border-fuchsia-500/30 text-xs text-fuchsia-300 hover:bg-fuchsia-500/10"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  setExpandedTaskId(isExpanded ? null : task.id)
                                }
                                className="px-3 py-1 rounded-lg border border-violet-500/30 text-xs text-violet-300 hover:bg-violet-500/10"
                              >
                                {isExpanded ? "Collapse" : "Expand"}
                              </button>
                            </div>
                          </td>
                        </tr>,
                      ];

                      if (isExpanded) {
                        rows.push(
                          <tr
                            key={`${task.id}-expanded`}
                            className="border-b border-white/10 bg-white/[0.03]"
                          >
                            <td colSpan={8} className="p-4">
                              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                                <div className="mb-4 flex flex-wrap gap-2">
                                  {task.label && (
                                    <span
                                      className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${getLabelStyle(task.label)}`}
                                    >
                                      {task.label}
                                    </span>
                                  )}

                                  {overdue && (
                                    <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-red-500/30 bg-red-500/15 text-red-300">
                                      Overdue
                                    </span>
                                  )}

                                  {!overdue && dueToday && (
                                    <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-amber-500/30 bg-amber-500/15 text-amber-300">
                                      Due Today
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-gray-300 mb-4">
                                  <div>
                                    <span className="text-[#00ff66]">Assigned:</span>{" "}
                                    {getProfileName(task.assigned_to)}
                                  </div>
                                  <div>
                                    <span className="text-[#00ff66]">Due:</span>{" "}
                                    {formatDate(task.due_date)}
                                  </div>
                                  <div>
                                    <span className="text-[#00ff66]">Status:</span>{" "}
                                    {columns.find((c) => c.key === task.status)?.label}
                                  </div>
                                  <div>
                                    <span className="text-[#00ff66]">Updated:</span>{" "}
                                    {formatDateTime(task.updated_at)}
                                  </div>
                                </div>

                                {task.description && (
                                  <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-cyan-300 mb-1">
                                      Description
                                    </div>
                                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                      {task.description}
                                    </div>
                                  </div>
                                )}

                                <div className="mb-4">
                                  <div className="text-[11px] uppercase tracking-wide text-violet-300 mb-2">
                                    Comments ({taskComments.length})
                                  </div>

                                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                    {taskComments.length === 0 ? (
                                      <div className="text-sm text-gray-500">No comments yet</div>
                                    ) : (
                                      taskComments.map((comment) => (
                                        <div
                                          key={comment.id}
                                          className="rounded-xl border border-white/10 bg-black/40 p-3"
                                        >
                                          <div className="text-xs text-[#00ff66] mb-1">
                                            {comment.profiles?.display_name || "Unknown"} •{" "}
                                            {formatDateTime(comment.created_at)}
                                          </div>
                                          <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                            {comment.content}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <textarea
                                    value={newComment[task.id] || ""}
                                    onChange={(e) =>
                                      setNewComment((prev) => ({
                                        ...prev,
                                        [task.id]: e.target.value,
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Add comment..."
                                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[#00ff66]/20 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/30 resize-none"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => addComment(task.id)}
                                      className="px-3 py-2 rounded-lg border border-[#00ff66]/30 text-sm text-[#00ff66] hover:bg-[#00ff66]/10"
                                    >
                                      Add Comment
                                    </button>

                                    {task.status !== "todo" && (
                                      <button
                                        onClick={() => moveTaskToStatus(task.id, "todo")}
                                        className="px-3 py-2 rounded-lg border border-cyan-500/30 text-sm text-cyan-300 hover:bg-cyan-500/10"
                                      >
                                        To Do
                                      </button>
                                    )}

                                    {task.status !== "in_progress" && (
                                      <button
                                        onClick={() => moveTaskToStatus(task.id, "in_progress")}
                                        className="px-3 py-2 rounded-lg border border-blue-500/30 text-sm text-blue-300 hover:bg-blue-500/10"
                                      >
                                        In Progress
                                      </button>
                                    )}

                                    {task.status !== "review" && (
                                      <button
                                        onClick={() => moveTaskToStatus(task.id, "review")}
                                        className="px-3 py-2 rounded-lg border border-amber-500/30 text-sm text-amber-300 hover:bg-amber-500/10"
                                      >
                                        Review
                                      </button>
                                    )}

                                    {task.status !== "done" && (
                                      <button
                                        onClick={() => moveTaskToStatus(task.id, "done")}
                                        className="px-3 py-2 rounded-lg border border-emerald-500/30 text-sm text-emerald-300 hover:bg-emerald-500/10"
                                      >
                                        Done
                                      </button>
                                    )}

                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      className="px-3 py-2 rounded-lg border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return rows;
                    })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}