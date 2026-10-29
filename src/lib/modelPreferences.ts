import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

type Preferences = { favoriteIDs: string[]; recentIDs: string[] };
type State = Preferences & { serverID: string; loading: boolean; saving: boolean; error: string | null };

const writes = new Map<string, Promise<Preferences>>();

export function modelPreferenceID(providerID: string, modelID: string): string {
  return JSON.stringify([providerID, modelID]);
}

function storageName(serverID: string): string {
  return `opencoode-models-${Array.from(serverID, character => character.codePointAt(0)!.toString(16)).join('-')}.json`;
}

function isModelID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const pair: unknown = JSON.parse(value);
    return Array.isArray(pair) && pair.length === 2 && pair.every(part => typeof part === 'string' && part.length > 0);
  } catch { return false; }
}

async function readPreferences(serverID: string): Promise<Preferences> {
  const name = storageName(serverID);
  const file = Platform.OS === 'web' ? null : new File(Paths.document, name);
  const raw = Platform.OS === 'web' ? sessionStorage.getItem(name) : file?.exists ? await file.text() : null;
  if (!raw) return { favoriteIDs: [], recentIDs: [] };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('favoriteIDs' in value) || !('recentIDs' in value) ||
    !Array.isArray(value.favoriteIDs) || !value.favoriteIDs.every(isModelID) ||
    !Array.isArray(value.recentIDs) || !value.recentIDs.every(isModelID)) {
    throw new Error('Saved model preferences are invalid');
  }
  return { favoriteIDs: [...new Set(value.favoriteIDs)], recentIDs: [...new Set(value.recentIDs)].slice(0, 10) };
}

async function loadPreferences(serverID: string): Promise<Preferences> {
  await writes.get(serverID)?.catch(() => {});
  return readPreferences(serverID);
}

function updatePreferences(serverID: string, update: (current: Preferences) => Preferences): Promise<Preferences> {
  const previous = writes.get(serverID) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    const current = await readPreferences(serverID);
    const next = update(current);
    if (next !== current) {
      const name = storageName(serverID);
      if (Platform.OS === 'web') sessionStorage.setItem(name, JSON.stringify(next));
      else await new File(Paths.document, name).write(JSON.stringify(next));
    }
    return next;
  });
  writes.set(serverID, write);
  void write.finally(() => { if (writes.get(serverID) === write) writes.delete(serverID); }).catch(() => {});
  return write;
}

function failureMessage(reason: unknown, action: string): string {
  return `Cannot ${action} model preferences${reason instanceof Error ? `: ${reason.message}` : ''}`;
}

export function useModelPreferences(serverID: string) {
  const [state, setState] = useState<State>({ serverID, favoriteIDs: [], recentIDs: [], loading: true, saving: false, error: null });
  const [revision, setRevision] = useState(0);
  const scope = useRef(serverID);
  const request = useRef(0);
  const mounted = useRef(true);
  scope.current = serverID;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current++; };
  }, []);

  useEffect(() => {
    const version = ++request.current;
    if (!serverID.trim()) {
      setState({ serverID, favoriteIDs: [], recentIDs: [], loading: false, saving: false, error: null });
      return;
    }
    setState(current => ({ serverID, favoriteIDs: current.serverID === serverID ? current.favoriteIDs : [], recentIDs: current.serverID === serverID ? current.recentIDs : [], loading: true, saving: false, error: null }));
    void loadPreferences(serverID).then(preferences => {
      if (mounted.current && scope.current === serverID && version === request.current) {
        setState({ serverID, ...preferences, loading: false, saving: false, error: null });
      }
    }).catch(reason => {
      if (mounted.current && scope.current === serverID && version === request.current) {
        setState(current => ({ ...current, loading: false, error: failureMessage(reason, 'load') }));
      }
    });
    return () => { request.current++; };
  }, [serverID, revision]);

  const change = useCallback(async (update: (current: Preferences) => Preferences) => {
    if (!serverID.trim()) return;
    const version = ++request.current;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      const preferences = await updatePreferences(serverID, update);
      if (mounted.current && scope.current === serverID && version === request.current) {
        setState({ serverID, ...preferences, loading: false, saving: false, error: null });
      }
    } catch (reason) {
      if (mounted.current && scope.current === serverID && version === request.current) {
        setState(current => ({ ...current, loading: false, saving: false, error: failureMessage(reason, 'save') }));
      }
    }
  }, [serverID]);

  const toggleFavorite = useCallback((providerID: string, modelID: string) => change(current => {
    const id = modelPreferenceID(providerID, modelID);
    return { ...current, favoriteIDs: current.favoriteIDs.includes(id) ? current.favoriteIDs.filter(value => value !== id) : [...current.favoriteIDs, id] };
  }), [change]);

  const recordRecent = useCallback((providerID: string, modelID: string) => change(current => {
    const id = modelPreferenceID(providerID, modelID);
    if (current.recentIDs[0] === id) return current;
    return { ...current, recentIDs: [id, ...current.recentIDs.filter(value => value !== id)].slice(0, 10) };
  }), [change]);

  const reload = useCallback(() => setRevision(value => value + 1), []);
  const current = !serverID.trim()
    ? { favoriteIDs: [], recentIDs: [], loading: false, saving: false, error: null }
    : state.serverID === serverID ? state : { favoriteIDs: [], recentIDs: [], loading: true, saving: false, error: null };
  return { favoriteIDs: current.favoriteIDs, recentIDs: current.recentIDs, loading: current.loading, saving: current.saving, error: current.error, toggleFavorite, recordRecent, reload };
}
