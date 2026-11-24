import type { ScheduleInfo } from "@opencode/client";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import React, { useState } from "react";
import { View } from "react-native";

import { errorMessage, errorMessageOrNull } from "../lib/client";
import type { Client } from "../lib/client";
import { sessionSchedulesOptions } from "../lib/queries/panels";
import { queryKeys } from "../lib/query-keys";
import { prepareSchedule } from "../lib/schedules";
import type { ScheduleDraft } from "../lib/schedules";
import { useServerScope } from "../lib/server-scope";
import { SelectMenu } from "./select";
import { useUndoableRemoval } from "./snackbar";
import { Button, Busy, Card, ErrorNotice, Field, BodyText, Row } from "./ui";

const emptyDraft: ScheduleDraft = {
  after: "",
  mode: "in",
  name: "",
  prompt: "",
  runs: "",
  timezone: "",
  trigger: "",
  until: "",
};
const modeOptions = [
  { label: "After a delay", value: "in" },
  { label: "At a time", value: "at" },
  { label: "Repeat", value: "every" },
  { label: "Cron", value: "cron" },
] as const;

const triggerLabel = (item: ScheduleInfo) => {
  const { when } = item;
  if (when.type === "in") {
    return `After ${when.in}`;
  }
  if (when.type === "at") {
    return `At ${when.at}`;
  }
  if (when.type === "every") {
    return `Every ${when.every}`;
  }
  return `Cron: ${when.cron}`;
};

const triggerFieldLabel = (mode: ScheduleDraft["mode"]) => {
  if (mode === "at") {
    return "Date and time";
  }
  if (mode === "cron") {
    return "Cron expression";
  }
  if (mode === "every") {
    return "Repeat interval";
  }
  return "Delay";
};

const triggerPlaceholder = (mode: ScheduleDraft["mode"]) => {
  if (mode === "at") {
    return "YYYY-MM-DDTHH:mm";
  }
  if (mode === "cron") {
    return "0 9 * * 1-5";
  }
  return "20 minutes";
};

const NO_SCHEDULES: ScheduleInfo[] = [];
const SCHEDULE_MUTATION_KEY = ["schedules"] as const;

export const Schedules = ({
  client,
  sessionID,
}: {
  client: Client;
  sessionID: string;
}) => {
  const { hidden, remove: removeSchedule } = useUndoableRemoval("schedules");
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const query = useQuery(sessionSchedulesOptions(scope, client, sessionID));
  const items = query.data ?? NO_SCHEDULES;
  const [draft, setDraft] = useState<ScheduleDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [detail, setDetail] = useState<ScheduleInfo>();
  const [seenScope, setSeenScope] = useState({ client, sessionID });
  if (seenScope.client !== client || seenScope.sessionID !== sessionID) {
    setSeenScope({ client, sessionID });
    setDetail(undefined);
    setAdding(false);
    setDraft(emptyDraft);
    setActionError(undefined);
  }
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.session.schedules(scope, sessionID),
    });
  const mutationOptions = {
    mutationKey: SCHEDULE_MUTATION_KEY,
    onError: (reason: unknown) => setActionError(errorMessage(reason)),
  };
  const create = useMutation({
    ...mutationOptions,
    mutationFn: () =>
      client.experimental.schedule.create(prepareSchedule(sessionID, draft)),
    onSuccess: () => {
      setAdding(false);
      setDraft(emptyDraft);
      return invalidate();
    },
  });
  const fetchDetail = useMutation({
    ...mutationOptions,
    mutationFn: (scheduleID: string) =>
      client.experimental.schedule.get({ scheduleID }),
    onSuccess: setDetail,
  });
  const toggle = useMutation({
    ...mutationOptions,
    mutationFn: (item: ScheduleInfo) =>
      item.status === "paused"
        ? client.experimental.schedule.resume({ scheduleID: item.id })
        : client.experimental.schedule.pause({ scheduleID: item.id }),
    onSuccess: () => {
      setDetail(undefined);
      return invalidate();
    },
  });
  const removeItem = useMutation({
    ...mutationOptions,
    mutationFn: (scheduleID: string) =>
      client.experimental.schedule.delete({ scheduleID }),
    onSuccess: () => {
      setDetail(undefined);
      return invalidate();
    },
  });
  const busy = useIsMutating({ mutationKey: SCHEDULE_MUTATION_KEY }) > 0;
  const loading = query.isFetching;
  const error = actionError ?? errorMessageOrNull(query.error);
  const { refetch } = query;
  const refresh = () => {
    setActionError(undefined);
    void refetch();
  };
  const change = (field: keyof ScheduleDraft, value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));
  const visibleItems = items.filter((item) => !hidden.has(item.id));
  const repeating = draft.mode === "every" || draft.mode === "cron";

  return (
    <View style={{ gap: 14 }}>
      <BodyText muted>
        Schedules run on the server. They need OpenCode 2.2.1 or later and
        experimental.schedules in this session configuration.
      </BodyText>
      <Row>
        <Button
          title={adding ? "Cancel new schedule" : "+ Schedule prompt"}
          size="compact"
          disabled={busy}
          onPress={() => setAdding(!adding)}
        />
        <Button
          title="Refresh"
          size="compact"
          disabled={busy || loading}
          onPress={refresh}
        />
      </Row>
      <ErrorNotice error={error} onRetry={refresh} />
      {loading && <Busy />}
      {!loading && !error && visibleItems.length === 0 && (
        <BodyText muted>No schedules for this session</BodyText>
      )}
      {adding && (
        <Card>
          <Field
            label="Name (optional)"
            value={draft.name}
            onChangeText={(value) => change("name", value)}
          />
          <Field
            label="Prompt"
            multiline
            placeholder="What must OpenCode do when this schedule runs?"
            value={draft.prompt}
            onChangeText={(value) => change("prompt", value)}
          />
          <SelectMenu
            accessibilityLabel="Schedule type"
            appearance="outline"
            options={modeOptions}
            value={draft.mode}
            onSelect={(mode) =>
              setDraft((previous) => ({ ...previous, mode, trigger: "" }))
            }
          />
          <Field
            label={triggerFieldLabel(draft.mode)}
            placeholder={triggerPlaceholder(draft.mode)}
            value={draft.trigger}
            onChangeText={(value) => change("trigger", value)}
          />
          <Field
            label="Time zone (optional)"
            placeholder="Server time zone, or enter Asia/Kolkata"
            value={draft.timezone}
            onChangeText={(value) => change("timezone", value)}
          />
          {repeating && (
            <>
              <Field
                label="Maximum runs (optional)"
                keyboardType="number-pad"
                placeholder="Leave empty for no run limit"
                value={draft.runs}
                onChangeText={(value) => change("runs", value)}
              />
              <Field
                label="Stop after a duration (optional)"
                placeholder="8 hours"
                value={draft.after}
                onChangeText={(value) => change("after", value)}
              />
              <Field
                label="Stop at a time (optional)"
                placeholder="YYYY-MM-DDTHH:mm"
                value={draft.until}
                onChangeText={(value) => change("until", value)}
              />
              <BodyText muted>
                The schedule stops at the first limit. Without limits, it
                repeats until you pause or delete it.
              </BodyText>
            </>
          )}
          <Button
            title="Create schedule"
            variant="primary"
            busy={busy}
            onPress={() => {
              setActionError(undefined);
              create.mutate();
            }}
          />
        </Card>
      )}
      {visibleItems.map((item) => (
        <Card key={item.id}>
          <BodyText style={{ fontSize: 17, fontWeight: "600" }}>
            {item.name || "Scheduled prompt"}
          </BodyText>
          <BodyText>
            {triggerLabel(item)} · {item.tz}
          </BodyText>
          <BodyText muted>
            {item.status} · {item.runCount} runs
            {item.remainingRuns === undefined
              ? ""
              : ` · ${item.remainingRuns} remaining`}
          </BodyText>
          {item.nextDueAt !== undefined && (
            <BodyText muted>
              Next: {new Date(item.nextDueAt).toLocaleString()}
            </BodyText>
          )}
          <BodyText numberOfLines={3}>{item.action.prompt}</BodyText>
          <Row>
            <Button
              title="Details"
              size="compact"
              disabled={busy}
              onPress={() => {
                setActionError(undefined);
                fetchDetail.mutate(item.id);
              }}
            />
            {item.status !== "done" && (
              <Button
                title={item.status === "paused" ? "Resume" : "Pause"}
                size="compact"
                disabled={busy}
                onPress={() => {
                  setActionError(undefined);
                  toggle.mutate(item);
                }}
              />
            )}
            <Button
              title="Delete"
              size="compact"
              variant="danger"
              disabled={busy}
              onPress={() => {
                removeSchedule(item.id, {
                  commit: () => removeItem.mutateAsync(item.id),
                  message: "Schedule deleted",
                });
              }}
            />
          </Row>
          {detail?.id === item.id && (
            <View style={{ gap: 8 }}>
              <BodyText selectable>{detail.action.prompt}</BodyText>
              <BodyText muted>Current status: {detail.status}</BodyText>
              {detail.lastFiredAt !== undefined && (
                <BodyText muted>
                  Last run: {new Date(detail.lastFiredAt).toLocaleString()} ·{" "}
                  {detail.lastOutcome || "No outcome reported"}
                </BodyText>
              )}
              {detail.endsAt !== undefined && (
                <BodyText muted>
                  Ends: {new Date(detail.endsAt).toLocaleString()}
                </BodyText>
              )}
              <BodyText selectable muted>
                {detail.id}
              </BodyText>
              <Button
                title="Hide details"
                size="compact"
                variant="ghost"
                onPress={() => setDetail(undefined)}
              />
            </View>
          )}
        </Card>
      ))}
    </View>
  );
};
