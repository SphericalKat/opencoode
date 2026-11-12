import type { FormInfo } from "@opencode/client";
import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { SessionForms } from "./session-forms";
import { Button, Busy, ErrorNotice, Heading, BodyText, Row } from "./ui";

export function GlobalForms({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) {
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!foreground) {
      return;
    }
    setForms([]);
    setError(null);
    const controller = new AbortController();
    let request = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseRetry: (() => void) | undefined;
    let attempts = 0;

    const refresh = async () => {
      const current = ++request;
      setLoading(true);
      try {
        const result = await client.form.list(
          { location: { directory } },
          { signal: controller.signal }
        );
        if (controller.signal.aborted || current !== request) {
          return;
        }
        setForms(result.data.filter((form) => form.sessionID === "global"));
        setError(null);
      } catch (error_) {
        if (!controller.signal.aborted && current === request) {
          setError(errorMessage(error_));
        }
      } finally {
        if (!controller.signal.aborted && current === request) {
          setLoading(false);
        }
      }
    };
    refreshRef.current = () => {
      void refresh();
    };
    const scheduleRefresh = () => {
      if (refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        void refresh();
      }, 150);
    };
    void (async () => {
      await refresh();
      while (!controller.signal.aborted) {
        try {
          for await (const event of client.event.subscribe({
            signal: controller.signal,
            types: [
              "form.created",
              "form.replied",
              "form.cancelled",
              "location.shutdown",
            ],
          })) {
            if (controller.signal.aborted) {
              break;
            }
            attempts = 0;
            if (
              event.type === "server.connected" ||
              !event.location ||
              event.location.directory === directory
            ) {
              scheduleRefresh();
            }
          }
          if (!controller.signal.aborted) {
            throw new Error("The live connection closed");
          }
        } catch (error_) {
          if (controller.signal.aborted) {
            break;
          }
          setError(
            `Pending request updates unavailable: ${errorMessage(error_)}`
          );
          await new Promise<void>((resolve) => {
            releaseRetry = resolve;
            retryTimer = setTimeout(
              resolve,
              Math.min(1000 * 2 ** Math.min(attempts++, 4), 15_000)
            );
          });
          if (!controller.signal.aborted) {
            await refresh();
          }
        }
      }
    })().catch((error_) => {
      if (!controller.signal.aborted) {
        setError(errorMessage(error_));
      }
    });
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
      releaseRetry?.();
      refreshRef.current = () => {};
    };
  }, [client, directory, foreground]);

  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Heading>Pending requests</Heading>
        <Button
          title="Refresh requests"
          compact
          variant="ghost"
          disabled={loading || !foreground}
          onPress={() => refreshRef.current()}
        />
      </Row>
      <ErrorNotice error={error} onRetry={() => refreshRef.current()} />
      {loading && <Busy />}
      {!loading && !error && !forms.length && (
        <BodyText muted>No pending MCP questions</BodyText>
      )}
      <SessionForms
        client={client}
        sessionID="global"
        forms={forms}
        permissions={[]}
        locationDirectory={directory}
        onChanged={() => refreshRef.current()}
        onError={(cause) => setError(errorMessage(cause))}
      />
    </View>
  );
}
