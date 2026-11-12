import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

interface Preferences {
  favoriteIDs: string[];
  recentIDs: string[];
}
type State = Preferences & {
  serverID: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

const writes = new Map<string, Promise<Preferences>>();

export const modelPreferenceID = (
  providerID: string,
  modelID: string
): string => JSON.stringify([providerID, modelID]);

const storageName = (serverID: string): string =>
  `opencoode-models-${Array.from(serverID, (character) => (character.codePointAt(0) ?? 0).toString(16)).join("-")}.json`;

const isModelID = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const pair: unknown = JSON.parse(value);
    return (
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every((part) => typeof part === "string" && part.length > 0)
    );
  } catch {
    return false;
  }
};

const readRawPreferences = async (name: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    return sessionStorage.getItem(name);
  }
  const file = new File(Paths.document, name);
  return file.exists ? await file.text() : null;
};

const readPreferences = async (serverID: string): Promise<Preferences> => {
  const name = storageName(serverID);
  const raw = await readRawPreferences(name);
  if (!raw) {
    return { favoriteIDs: [], recentIDs: [] };
  }
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("favoriteIDs" in value) ||
    !("recentIDs" in value) ||
    !Array.isArray(value.favoriteIDs) ||
    !value.favoriteIDs.every(isModelID) ||
    !Array.isArray(value.recentIDs) ||
    !value.recentIDs.every(isModelID)
  ) {
    throw new Error("Saved model preferences are invalid");
  }
  return {
    favoriteIDs: [...new Set(value.favoriteIDs)],
    recentIDs: [...new Set(value.recentIDs)].slice(0, 10),
  };
};

const ignoreError = () => {
  // Failures are reported by the write's own caller.
};

const loadPreferences = async (serverID: string): Promise<Preferences> => {
  await writes.get(serverID)?.catch(ignoreError);
  return readPreferences(serverID);
};

const updatePreferences = (
  serverID: string,
  update: (current: Preferences) => Preferences
): Promise<Preferences> => {
  const previous = writes.get(serverID) ?? Promise.resolve();
  const write = previous.catch(ignoreError).then(async () => {
    const current = await readPreferences(serverID);
    const updated = update(current);
    if (updated !== current) {
      const name = storageName(serverID);
      if (Platform.OS === "web") {
        sessionStorage.setItem(name, JSON.stringify(updated));
      } else {
        await new File(Paths.document, name).write(JSON.stringify(updated));
      }
    }
    return updated;
  });
  writes.set(serverID, write);
  void write
    .finally(() => {
      if (writes.get(serverID) === write) {
        writes.delete(serverID);
      }
    })
    .catch(ignoreError);
  return write;
};

const failureMessage = (reason: unknown, action: string): string =>
  `Cannot ${action} model preferences${reason instanceof Error ? `: ${reason.message}` : ""}`;

const emptyState = (loading: boolean): Omit<State, "serverID"> => ({
  error: null,
  favoriteIDs: [],
  loading,
  recentIDs: [],
  saving: false,
});

const resolveCurrent = (
  serverID: string,
  state: State
): Omit<State, "serverID"> => {
  if (!serverID.trim()) {
    return emptyState(false);
  }
  return state.serverID === serverID ? state : emptyState(true);
};

export const useModelPreferences = (serverID: string) => {
  const [state, setState] = useState<State>({
    error: null,
    favoriteIDs: [],
    loading: true,
    recentIDs: [],
    saving: false,
    serverID,
  });
  const [revision, setRevision] = useState(0);
  const scope = useRef(serverID);
  const request = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    scope.current = serverID;
  }, [serverID]);

  useEffect(() => {
    const mountedRef = mounted;
    const requestRef = request;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const requestRef = request;
    requestRef.current += 1;
    const version = requestRef.current;
    if (!serverID.trim()) {
      setState({
        error: null,
        favoriteIDs: [],
        loading: false,
        recentIDs: [],
        saving: false,
        serverID,
      });
      return;
    }
    setState((current) => ({
      error: null,
      favoriteIDs: current.serverID === serverID ? current.favoriteIDs : [],
      loading: true,
      recentIDs: current.serverID === serverID ? current.recentIDs : [],
      saving: false,
      serverID,
    }));
    const isCurrent = () =>
      mounted.current &&
      scope.current === serverID &&
      version === request.current;
    const load = async () => {
      try {
        const preferences = await loadPreferences(serverID);
        if (isCurrent()) {
          setState({
            error: null,
            ...preferences,
            loading: false,
            saving: false,
            serverID,
          });
        }
      } catch (error) {
        if (isCurrent()) {
          setState((current) => ({
            ...current,
            error: failureMessage(error, "load"),
            loading: false,
          }));
        }
      }
    };
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [serverID, revision]);

  const change = useCallback(
    async (update: (current: Preferences) => Preferences) => {
      if (!serverID.trim()) {
        return;
      }
      request.current += 1;
      const version = request.current;
      setState((current) => ({ ...current, error: null, saving: true }));
      try {
        const preferences = await updatePreferences(serverID, update);
        if (
          mounted.current &&
          scope.current === serverID &&
          version === request.current
        ) {
          setState({
            error: null,
            ...preferences,
            loading: false,
            saving: false,
            serverID,
          });
        }
      } catch (error) {
        if (
          mounted.current &&
          scope.current === serverID &&
          version === request.current
        ) {
          setState((current) => ({
            ...current,
            error: failureMessage(error, "save"),
            loading: false,
            saving: false,
          }));
        }
      }
    },
    [serverID]
  );

  const toggleFavorite = useCallback(
    (providerID: string, modelID: string) =>
      change((current) => {
        const id = modelPreferenceID(providerID, modelID);
        return {
          ...current,
          favoriteIDs: current.favoriteIDs.includes(id)
            ? current.favoriteIDs.filter((value) => value !== id)
            : [...current.favoriteIDs, id],
        };
      }),
    [change]
  );

  const recordRecent = useCallback(
    (providerID: string, modelID: string) =>
      change((current) => {
        const id = modelPreferenceID(providerID, modelID);
        if (current.recentIDs[0] === id) {
          return current;
        }
        return {
          ...current,
          recentIDs: [
            id,
            ...current.recentIDs.filter((value) => value !== id),
          ].slice(0, 10),
        };
      }),
    [change]
  );

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const current = resolveCurrent(serverID, state);
  return {
    error: current.error,
    favoriteIDs: current.favoriteIDs,
    loading: current.loading,
    recentIDs: current.recentIDs,
    recordRecent,
    reload,
    saving: current.saving,
    toggleFavorite,
  };
};
