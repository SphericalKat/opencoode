import type { FormInfo } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { View } from "react-native";

import { errorMessage, errorMessageOrNull } from "../lib/client";
import type { Client } from "../lib/client";
import { directoryFormsOptions } from "../lib/queries/chat";
import { useServerScope } from "../lib/server-scope";
import { useForeground } from "../stores/app-lifecycle-store";
import { useLiveStore } from "../stores/live-store";
import { SessionForms } from "./session-forms";
import { Button, Busy, ErrorNotice, BodyText, Row } from "./ui";

const NO_FORMS: FormInfo[] = [];

export const GlobalForms = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const scope = useServerScope();
  const foreground = useForeground();
  const [actionError, setActionError] = useState<string | null>(null);
  const liveError = useLiveStore((s) => s.streamError);
  const formsQuery = useQuery({
    ...directoryFormsOptions(scope, client, true, directory),
    enabled: foreground,
    refetchOnMount: true,
  });
  const forms = formsQuery.data ?? NO_FORMS;
  const { refetch } = formsQuery;
  const error =
    actionError ??
    (liveError ? `Pending request updates unavailable: ${liveError}` : null) ??
    errorMessageOrNull(formsQuery.error);
  const loading = formsQuery.isFetching;

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
        onError={(cause) => setActionError(errorMessage(cause))}
      />
    </View>
  );
};
