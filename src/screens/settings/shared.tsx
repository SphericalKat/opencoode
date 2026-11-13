import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ScrollView } from "react-native";

import { Button, Busy, ErrorNotice, Row } from "../../components/ui";
import { errorMessage } from "../../lib/client";
import { withSettingsRequest } from "../../lib/settings";
import { useThemedStyles } from "../../lib/theme";
import { createStyles } from "./styles";

export type HeaderRefresh = { refresh?: () => void; loading?: boolean } | null;
export const HeaderRefreshContext = createContext<React.Dispatch<
  React.SetStateAction<HeaderRefresh>
> | null>(null);

export const runBusy = async (
  setBusy: (busy: boolean) => void,
  setError: (message: string) => void,
  task: () => Promise<void>
) => {
  setBusy(true);
  try {
    await task();
  } catch (error_) {
    setError(errorMessage(error_));
  } finally {
    setBusy(false);
  }
};

export const useResource = <T,>(
  source: object,
  directory: string,
  load: (signal: AbortSignal) => Promise<T>
) => {
  const scope = useMemo(() => ({ directory, source }), [source, directory]);
  const [stored, setStored] = useState<{ scope: object; value: T }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resourceScope, setResourceScope] = useState(scope);
  const active = useRef(true);
  const latest = useRef({ load, scope });
  useLayoutEffect(() => {
    latest.current = { load, scope };
  });
  const sequence = useRef(0);
  if (resourceScope !== scope) {
    setResourceScope(scope);
    setLoading(true);
    setError(null);
  }
  const run = useCallback(async (owner: object, signal?: AbortSignal) => {
    const { load: read } = latest.current;
    sequence.current += 1;
    const { current } = sequence;
    const isCurrent = () =>
      active.current &&
      current === sequence.current &&
      latest.current.scope === owner;
    try {
      const result = await withSettingsRequest(read, signal);
      if (isCurrent()) {
        setStored({ scope: owner, value: result });
      }
    } catch (error_) {
      if (isCurrent()) {
        setError(errorMessage(error_));
      }
    }
    if (isCurrent()) {
      setLoading(false);
    }
  }, []);
  const refresh = useCallback(
    (signal?: AbortSignal) => {
      const owner = latest.current.scope;
      setResourceScope(owner);
      setLoading(true);
      setError(null);
      return run(owner, signal);
    },
    [run]
  );
  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    void run(
      scope,
      AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
    );
    return () => {
      active.current = false;
      sequence.current += 1;
      controller.abort();
    };
  }, [scope, run]);
  return {
    data: stored?.scope === scope ? stored.value : undefined,
    error: resourceScope === scope ? error : null,
    loading: resourceScope !== scope || loading,
    refresh,
  };
};

export const Page = ({
  children,
  error,
  loading,
  refresh,
}: {
  children: React.ReactNode;
  error?: string | null;
  loading?: boolean;
  refresh?: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const setHeaderRefresh = useContext(HeaderRefreshContext);
  useEffect(() => {
    setHeaderRefresh?.({ loading, refresh });
    return () => setHeaderRefresh?.(null);
  }, [setHeaderRefresh, refresh, loading]);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
    >
      {!setHeaderRefresh && refresh && (
        <Row style={{ justifyContent: "flex-end" }}>
          <Button
            title="Refresh"
            compact
            variant="ghost"
            onPress={() => refresh()}
          />
        </Row>
      )}
      <ErrorNotice
        error={error}
        onRetry={refresh ? () => refresh() : undefined}
      />
      {loading && <Busy />}
      {children}
    </ScrollView>
  );
};
