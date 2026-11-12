import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

export interface ChatDraft {
  text: string;
  files: { uri: string; name?: string }[];
  skillIDs: string[];
  agentIDs: string[];
  delivery: "steer" | "queue";
}

const storageKey = (key: string) => {
  let hash = 2_166_136_261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16_777_619);
  }
  return `opencoode-draft-${encodeURIComponent(key).slice(0, 140)}-${(hash >>> 0).toString(16)}`;
};

const writes = new Map<string, Promise<void>>();

const readRawDraft = async (name: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    return sessionStorage.getItem(name);
  }
  const file = new File(Paths.cache, `${name}.json`);
  if (file.exists) {
    return await file.text();
  }
  return null;
};

export const loadDraft = async (key: string): Promise<ChatDraft | null> => {
  await writes.get(key)?.catch(() => null);
  const name = storageKey(key);
  const raw = await readRawDraft(name);
  if (!raw) {
    return null;
  }
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") {
    return null;
  }
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.text !== "string" ||
    !Array.isArray(draft.files) ||
    !Array.isArray(draft.skillIDs) ||
    !Array.isArray(draft.agentIDs) ||
    (draft.delivery !== "steer" && draft.delivery !== "queue")
  ) {
    return null;
  }
  if (
    !draft.skillIDs.every((id) => typeof id === "string") ||
    !draft.agentIDs.every((id) => typeof id === "string")
  ) {
    return null;
  }
  if (
    !draft.files.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.uri === "string" &&
        (entry.name === undefined || typeof entry.name === "string")
    )
  ) {
    return null;
  }
  return draft as unknown as ChatDraft;
};

const persistDraft = async (key: string, draft: ChatDraft): Promise<void> => {
  const name = storageKey(key);
  const empty =
    !draft.text &&
    !draft.files.length &&
    !draft.skillIDs.length &&
    !draft.agentIDs.length;
  if (Platform.OS === "web") {
    if (empty) {
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, JSON.stringify(draft));
    }
    return;
  }
  const file = new File(Paths.cache, `${name}.json`);
  if (empty) {
    if (file.exists) {
      await file.delete();
    }
  } else {
    await file.write(JSON.stringify(draft));
  }
};

export const saveDraft = (key: string, draft: ChatDraft): Promise<void> => {
  const previous = writes.get(key) ?? Promise.resolve();
  const write = previous.catch(() => null).then(() => persistDraft(key, draft));
  writes.set(key, write);
  void write
    .finally(() => {
      if (writes.get(key) === write) {
        writes.delete(key);
      }
    })
    .catch(() => null);
  return write;
};
