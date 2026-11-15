import type { FormInfo } from "@opencode/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useForeground } from "../lib/foreground";
import { directoryFormsOptions } from "../lib/queries/chat";
import { queryKeys } from "../lib/query-keys";
import { useServerScope } from "../lib/server-scope";
import { SessionForms } from "./session-forms";
import { Button, Busy, ErrorNotice, BodyText, Row } from "./ui";

const REFRESH_DEBOUNCE_MS = 150;
const MAX_RETRY_STEP = 4;
const MAX_RETRY_MS = 15_000;
const NO_FORMS: FormInfo[] = [];

const createFormsStream = ({
  client,
  directory,
  invalidate,
  setStreamError,
  signal,
}: {
  client: Client;
  directory: string;
  invalidate: () => void;
  setStreamError: (error: string | null) => void;
  signal: AbortSignal;
}) => {
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const scheduleRefresh = () => {
    if (refreshTimer) {
      return;
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      invalidate();
    }, REFRESH_DEBOUNCE_MS);
  };
  const connect = async () => {
    try {
      for await (const event of client.event.subscribe({
        signal,
        types: [
          "form.created",
          "form.replied",
          "form.cancelled",
          "location.shutdown",
        ],
      })) {
        if (signal.aborted) {
          break;
        }
        attempts = 0;
        setStreamError(null);
        if (
          event.type === "server.connected" ||
          !event.location ||
          event.location.directory === directory
        ) {
          scheduleRefresh();
        }
      }
      if (!signal.aborted) {
        throw new Error("The live connection closed");
      }
    } catch (error_) {
      if (signal.aborted) {
        return;
      }
      setStreamError(
        `Pending request updates unavailable: ${errorMessage(error_)}`
      );
      const delay = Math.min(
        1000 * 2 ** Math.min(attempts, MAX_RETRY_STEP),
        MAX_RETRY_MS
      );
      attempts += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        invalidate();
        void connect();
      }, delay);
    }
  };
  const dispose = () => {
    clearTimeout(refreshTimer);
    clearTimeout(retryTimer);
  };
  return { connect, dispose };
};

export const GlobalForms = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const foreground = useForeground();
  const [streamError, setStreamError] = useState<string | null>(null);
  const formsQuery = useQuery({
    ...directoryFormsOptions(scope, client, true, directory),
    enabled: foreground,
    refetchOnMount: true,
  });
  const forms = formsQuery.data ?? NO_FORMS;
  const { refetch } = formsQuery;
  const error =
    streamError ?? (formsQuery.error ? errorMessage(formsQuery.error) : null);
  const loading = formsQuery.isFetching;

  useEffect(() => {
    if (!foreground) {
      return;
    }
    const controller = new AbortController();
    const stream = createFormsStream({
      client,
      directory,
      invalidate: () => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.dir.forms(scope, directory),
        });
      },
      setStreamError,
      signal: controller.signal,
    });
    void stream.connect();
    return () => {
      controller.abort();
      stream.dispose();
    };
  }, [client, directory, foreground, queryClient, scope]);

  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: "space-between", paddingLeft: 12 }}>
        <BodyText accessibilityRole="header" muted>
          Pending requests
        </BodyText>
        <Button
          title="Refresh"
          accessibilityLabel="Refresh pending requests"
          size="compact"
          variant="ghost"
          alignSelf="center"
          disabled={loading || !foreground}
          onPress={() => {
            void refetch();
          }}
        />
      </Row>
      <ErrorNotice
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
      {loading && <Busy />}
      {!loading && !error && !forms.length && (
        <BodyText muted style={{ paddingLeft: 12 }}>
          No pending MCP questions
        </BodyText>
      )}
      <SessionForms
        client={client}
        sessionID="global"
        forms={forms}
        permissions={[]}
        locationDirectory={directory}
        onError={(cause) => setStreamError(errorMessage(cause))}
      />
    </View>
  );
};
