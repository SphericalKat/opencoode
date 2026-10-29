import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

export type ChatDraft = {
  text: string;
  files: { uri: string; name?: string }[];
  skillIDs: string[];
  agentIDs: string[];
  delivery: 'steer' | 'queue';
};

function storageKey(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return `opencoode-draft-${encodeURIComponent(key).slice(0, 140)}-${(hash >>> 0).toString(16)}`;
}

export async function loadDraft(key: string): Promise<ChatDraft | null> {
  await writes.get(key)?.catch(() => {});
  const name = storageKey(key);
  const file = Platform.OS === 'web' ? null : new File(Paths.cache, `${name}.json`);
  const raw = Platform.OS === 'web' ? sessionStorage.getItem(name) : file?.exists ? await file.text() : null;
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') return null;
  const draft = value as Record<string, unknown>;
  if (typeof draft.text !== 'string' || !Array.isArray(draft.files) || !Array.isArray(draft.skillIDs) || !Array.isArray(draft.agentIDs) || (draft.delivery !== 'steer' && draft.delivery !== 'queue')) return null;
  if (!draft.skillIDs.every(value => typeof value === 'string') || !draft.agentIDs.every(value => typeof value === 'string')) return null;
  if (!draft.files.every(value => value && typeof value === 'object' && typeof value.uri === 'string' && (value.name === undefined || typeof value.name === 'string'))) return null;
  return draft as ChatDraft;
}

const writes = new Map<string, Promise<void>>();

export function saveDraft(key: string, draft: ChatDraft): Promise<void> {
  const previous = writes.get(key) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    const name = storageKey(key);
    const empty = !draft.text && !draft.files.length && !draft.skillIDs.length && !draft.agentIDs.length;
    if (Platform.OS === 'web') {
      if (empty) sessionStorage.removeItem(name);
      else sessionStorage.setItem(name, JSON.stringify(draft));
      return;
    }
    const file = new File(Paths.cache, `${name}.json`);
    if (empty) { if (file.exists) await file.delete(); }
    else await file.write(JSON.stringify(draft));
  });
  writes.set(key, write);
  void write.finally(() => { if (writes.get(key) === write) writes.delete(key); }).catch(() => {});
  return write;
}
