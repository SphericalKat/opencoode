import type { Project, SessionInfo } from "@opencode/client";
import { Platform } from "react-native";

export const directoryName = (directory: string): string => {
  let name = "";
  for (const part of directory.split(/[\\/]/u)) {
    if (part) {
      name = part;
    }
  }
  return name || directory;
};

export const sessionDateGroup = (time: number): string => {
  const date = new Date(time);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  today.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString() ? "Yesterday" : "Older";
};

export const sessionStatus = (
  session: SessionInfo,
  working: boolean
): string => {
  if (working) {
    return "Working";
  }
  if (session.outcome === "succeeded") {
    return "Completed";
  }
  if (session.outcome === "failed") {
    return "Needs attention";
  }
  if (session.outcome === "interrupted") {
    return "Stopped";
  }
  return "Ready";
};

export const isUnread = (session: SessionInfo) =>
  session.time.idle &&
  (!session.time.viewed || session.time.viewed < session.time.idle);

export const visibleSessionStatus = (status: string): string | undefined =>
  status === "Working" || status === "Needs attention" || status === "Stopped"
    ? status
    : undefined;

export const startsDateGroup = ({
  group,
  index,
  search,
  sessions,
}: {
  group: string;
  index: number;
  search: string;
  sessions: SessionInfo[];
}): boolean =>
  Platform.OS === "android" &&
  !search.trim() &&
  index > 0 &&
  sessionDateGroup(sessions[index - 1].time.updated) !== group;

export const isTranscript = (
  transcript: { info?: unknown; messages?: unknown } | null | undefined
): boolean => {
  if (!transcript || typeof transcript !== "object") {
    return false;
  }
  if (!transcript.info || typeof transcript.info !== "object") {
    return false;
  }
  return Array.isArray(transcript.messages);
};

export const betaGroupLabel = (
  archived: boolean,
  search: string,
  sessions: SessionInfo[]
): string => {
  if (archived) {
    return "Archived sessions";
  }
  if (search.trim()) {
    return "Search results";
  }
  return sessions.length ? sessionDateGroup(sessions[0].time.updated) : "Today";
};

export const emptyTitle = (
  listUnavailable: boolean,
  search: string,
  archived: boolean
): string => {
  if (listUnavailable) {
    return "Could not load sessions";
  }
  if (search.trim()) {
    return "No matching sessions";
  }
  return archived ? "No archived sessions" : "Start your first session";
};

export const emptyDetail = (
  listUnavailable: boolean,
  search: string,
  archived: boolean
): string => {
  if (listUnavailable) {
    return "Use Retry to load your history.";
  }
  if (search.trim()) {
    return "Try another title or clear the search.";
  }
  return archived
    ? "Sessions appear here after you archive them."
    : "Create a session to work with OpenCode in this directory.";
};

export const actionsTitle = (actions: "menu" | "filter" | "create"): string => {
  if (actions === "create") {
    return "Name a new session";
  }
  return actions === "filter" ? "Session history" : "Session list actions";
};

export const projectName = (projects: Project[], item: SessionInfo): string =>
  projects.find((project) => project.id === item.projectID)?.name ||
  directoryName(
    projects.find((project) => project.id === item.projectID)?.canonical ??
      item.location.directory
  );

export const projectSelectorLabel = (
  projects: Project[],
  projectDirectory: string | undefined
): string => {
  if (!projectDirectory) {
    return "All projects";
  }
  return (
    projects.find((project) => project.canonical === projectDirectory)?.name ||
    directoryName(projectDirectory)
  );
};

export const searchPlaceholder = (archived: boolean): string =>
  archived ? "Search archived sessions" : "Search sessions";
