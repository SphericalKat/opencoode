import type { SessionInfo } from "@opencode/client";
import React from "react";
import { View } from "react-native";

import { Card, BodyText, Row } from "./ui";

export const SessionStats = ({
  session,
  running,
}: {
  session: SessionInfo;
  running: boolean;
}) => {
  const usage = [
    ["Input tokens", session.tokens.input],
    ["Output tokens", session.tokens.output],
    ["Reasoning tokens", session.tokens.reasoning],
    ["Cache read tokens", session.tokens.cache.read],
    ["Cache write tokens", session.tokens.cache.write],
  ] as const;
  return (
    <View style={{ gap: 14 }}>
      <BodyText muted>
        Usage totals recorded by the server for this session.
      </BodyText>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <BodyText>Cost</BodyText>
          <BodyText style={{ fontSize: 23, fontWeight: "500" }}>
            ${session.cost.toFixed(4)}
          </BodyText>
        </Row>
        {usage.map(([name, value]) => (
          <Row key={name} style={{ justifyContent: "space-between" }}>
            <BodyText muted>{name}</BodyText>
            <BodyText>{value.toLocaleString()}</BodyText>
          </Row>
        ))}
      </Card>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <BodyText muted>Status</BodyText>
          <BodyText>{running ? "Running" : session.outcome || "Idle"}</BodyText>
        </Row>
        <BodyText muted>Agent</BodyText>
        <BodyText>{session.agent || "Server default"}</BodyText>
        <BodyText muted>Model</BodyText>
        <BodyText>
          {session.model
            ? `${session.model.providerID} / ${session.model.id}${session.model.variant ? ` · ${session.model.variant}` : ""}`
            : "Server default"}
        </BodyText>
        <BodyText muted>Created</BodyText>
        <BodyText>{new Date(session.time.created).toLocaleString()}</BodyText>
        <BodyText muted>Last updated</BodyText>
        <BodyText>{new Date(session.time.updated).toLocaleString()}</BodyText>
        {session.time.idle !== undefined && (
          <>
            <BodyText muted>Last idle</BodyText>
            <BodyText>{new Date(session.time.idle).toLocaleString()}</BodyText>
          </>
        )}
      </Card>
    </View>
  );
};
