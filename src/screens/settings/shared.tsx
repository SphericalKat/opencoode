import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryKey, UseQueryResult } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect } from "react";
import { ScrollView, View } from "react-native";

import { BodyText, Busy, ErrorNotice, Row } from "../../components/ui";
import { errorMessage, errorMessageOrNull } from "../../lib/client";
import { invalidateKeys } from "../../lib/invalidate-keys";
import { withDeadline } from "../../lib/request";
import { useThemedStyles } from "../../lib/theme";
import { createStyles } from "./styles";

export type HeaderRefresh = { refresh?: () => void; loading?: boolean } | null;
export const HeaderRefreshContext = createContext<React.Dispatch<
  React.SetStateAction<HeaderRefresh>
> | null>(null);

export type SectionHeader = { title: string; description: string } | null;
export const SectionHeaderContext = createContext<SectionHeader>(null);

export const SectionPageHeader = ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.pageHeader}>
      <BodyText accessibilityRole="header" style={styles.pageTitle}>
        {title}
      </BodyText>
      <BodyText muted style={styles.pageDescription}>
        {description}
      </BodyText>
    </View>
  );
};

export const resourceOf = <T,>(query: UseQueryResult<T, Error>) => ({
  data: query.data,
  error: errorMessageOrNull(query.error),
  loading: query.isFetching,
  refresh: () => {
    void query.refetch();
  },
});

const SETTINGS_MUTATION_KEY = ["settings"] as const;

export const useSettingsBusy = () =>
  useIsMutating({ mutationKey: SETTINGS_MUTATION_KEY }) > 0;

interface SettingsMutationOptions<V> {
  invalidate: (variables: V) => QueryKey[];
  mutationFn: (variables: V, signal: AbortSignal) => Promise<void>;
  onError: (message: string) => void;
}

// A settings write that runs under a 15 second deadline. The keys it lists
// refetch before the mutation settles, so `isPending` covers the refresh.
export const useSettingsMutation = <V = void,>({
  invalidate,
  mutationFn,
  onError,
}: SettingsMutationOptions<V>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: V) =>
      withDeadline(undefined, (signal) => mutationFn(variables, signal)),
    mutationKey: SETTINGS_MUTATION_KEY,
    onError: (reason) => onError(errorMessage(reason)),
    onSuccess: (_result, variables) =>
      invalidateKeys(queryClient, invalidate(variables)),
  });
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
  const header = useContext(SectionHeaderContext);
  useEffect(() => {
    setHeaderRefresh?.({ loading, refresh });
    return () => setHeaderRefresh?.(null);
  }, [setHeaderRefresh, refresh, loading]);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {header && <SectionPageHeader {...header} />}
      <View style={styles.page}>
        <ErrorNotice
          error={error}
          onRetry={refresh ? () => refresh() : undefined}
        />
        {loading && <Busy />}
        {children}
      </View>
    </ScrollView>
  );
};

export const SettingsCardHeader = ({
  action,
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  subtitle: string;
  title: string;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Row style={styles.cardHeader}>
      <View style={styles.cardText}>
        <BodyText style={styles.cardTitle}>{title}</BodyText>
        <BodyText muted>{subtitle}</BodyText>
      </View>
      {action}
    </Row>
  );
};
