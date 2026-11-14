import type { AgentInfo, ModelInfo, SessionInfo } from "@opencode/client";
import React from "react";

import { sessionStatus } from "../lib/session-status";
import { useTheme } from "../lib/theme";
import { agentLabel, modelSummary } from "../screens/chat/labels";
import { SheetGroup, SheetRow } from "./list-sheet";
import { BodyText } from "./ui";

const costFormat = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatCost = (cost: number) => {
  if (cost > 0 && cost < 0.01) {
    return "< $0.01";
  }
  return costFormat.format(cost);
};

export const SessionStats = ({
  session,
  running,
  agents,
  currentModel,
}: {
  session: SessionInfo;
  running: boolean;
  agents: AgentInfo[];
  currentModel: Pick<ModelInfo, "name"> | undefined;
}) => {
  const { colors } = useTheme();
  const usage = [
    ["Input tokens", session.tokens.input],
    ["Output tokens", session.tokens.output],
    ["Reasoning tokens", session.tokens.reasoning],
    ["Cache read tokens", session.tokens.cache.read],
    ["Cache write tokens", session.tokens.cache.write],
  ] as const;
  const status = sessionStatus(running, session.outcome);
  return (
    <>
      <SheetGroup variant="menu" title="Usage">
        <SheetRow label="Cost" value={formatCost(session.cost)} />
        {usage.map(([name, value]) => (
          <SheetRow key={name} label={name} value={value.toLocaleString()} />
        ))}
      </SheetGroup>
      <SheetGroup variant="menu" title="Session">
        {status === "Failed" ? (
          <SheetRow
            label="Status"
            trailing={
              <BodyText style={{ color: colors.danger }}>Failed</BodyText>
            }
          />
        ) : (
          <SheetRow label="Status" value={status} />
        )}
        <SheetRow label="Agent" value={agentLabel(agents, session)} />
        <SheetRow label="Model" value={modelSummary(session, currentModel)} />
        <SheetRow
          label="Created"
          value={timeFormat.format(session.time.created)}
        />
        <SheetRow
          label="Updated"
          value={timeFormat.format(session.time.updated)}
        />
      </SheetGroup>
    </>
  );
};
