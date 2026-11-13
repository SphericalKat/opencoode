import type { SessionInfo } from "@opencode/client";

import { BackgroundCommands } from "../../components/background-commands";
import { ChildSessions } from "../../components/child-sessions";
import { Instructions } from "../../components/instructions";
import { McpResources } from "../../components/mcp-resources";
import { Schedules } from "../../components/schedules";
import { SessionStats } from "../../components/session-stats";
import { SideQuestion } from "../../components/side-question";
import {
  Busy,
  Card,
  Empty,
  BodyText,
  mono,
  Row,
  Sheet,
} from "../../components/ui";
import { CodeBlock } from "./controls";
import { MessageRow } from "./message-rows";
import type { ChatController } from "./use-chat-controller";

type DiffSheetProps = Pick<
  ChatController,
  "colors" | "diffs" | "panel" | "panelLoading" | "setPanel"
>;

export const DiffSheet = ({
  colors,
  diffs,
  panel,
  panelLoading,
  setPanel,
}: DiffSheetProps) => (
  <Sheet
    visible={panel === "diff"}
    title="Session changes"
    onClose={() => setPanel(null)}
  >
    {panelLoading && <Busy />}
    {!panelLoading &&
      diffs.length > 0 &&
      diffs.map((diff) => (
        <Card key={diff.file}>
          <BodyText style={{ fontFamily: mono }}>{diff.file}</BodyText>
          <Row>
            <BodyText style={{ color: colors.success }}>
              +{diff.additions}
            </BodyText>
            <BodyText style={{ color: colors.danger }}>
              −{diff.deletions}
            </BodyText>
            <BodyText muted>{diff.status}</BodyText>
          </Row>
          <CodeBlock code={diff.patch} />
          {diff.more && (
            <BodyText muted>The server truncated this diff.</BodyText>
          )}
        </Card>
      ))}
    {!panelLoading && diffs.length === 0 && <Empty title="No file changes" />}
  </Sheet>
);

interface ContextSheetProps extends Pick<
  ChatController,
  "context" | "opencodeClient" | "panel" | "panelLoading" | "setPanel"
> {
  session: SessionInfo;
}

export const ContextSheet = ({
  context,
  opencodeClient,
  panel,
  panelLoading,
  session,
  setPanel,
}: ContextSheetProps) => (
  <Sheet
    visible={panel === "context"}
    title="Agent context"
    onClose={() => setPanel(null)}
  >
    {panelLoading ? (
      <Busy />
    ) : (
      <>
        <BodyText muted>
          {context.length} messages in the current context
        </BodyText>
        {context.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            client={opencodeClient}
            directory={session.location.directory}
          />
        ))}
      </>
    )}
  </Sheet>
);

type InstructionsSheetProps = Pick<
  ChatController,
  "capabilities" | "opencodeClient" | "panel" | "sessionID" | "setPanel"
>;

export const InstructionsSheet = ({
  capabilities,
  opencodeClient,
  panel,
  sessionID,
  setPanel,
}: InstructionsSheetProps) => (
  <Sheet
    visible={panel === "instructions"}
    title="Session instructions"
    onClose={() => setPanel(null)}
  >
    {opencodeClient &&
      capabilities.instructions &&
      panel === "instructions" && (
        <Instructions client={opencodeClient} sessionID={sessionID} />
      )}
  </Sheet>
);

type SchedulesSheetProps = Pick<
  ChatController,
  "capabilities" | "opencodeClient" | "panel" | "sessionID" | "setPanel"
>;

export const SchedulesSheet = ({
  capabilities,
  opencodeClient,
  panel,
  sessionID,
  setPanel,
}: SchedulesSheetProps) => (
  <Sheet
    visible={panel === "schedules"}
    title="Session schedules"
    onClose={() => setPanel(null)}
  >
    {opencodeClient && capabilities.schedules && panel === "schedules" && (
      <Schedules client={opencodeClient} sessionID={sessionID} />
    )}
  </Sheet>
);

interface BackgroundSheetProps extends Pick<
  ChatController,
  | "backgroundDirectory"
  | "backgroundShellID"
  | "capabilities"
  | "opencodeClient"
  | "panel"
  | "sessionID"
  | "setPanel"
> {
  session: SessionInfo;
}

export const BackgroundSheet = ({
  backgroundDirectory,
  backgroundShellID,
  capabilities,
  opencodeClient,
  panel,
  session,
  sessionID,
  setPanel,
}: BackgroundSheetProps) => (
  <Sheet
    visible={panel === "background"}
    title="Background commands"
    onClose={() => setPanel(null)}
  >
    {opencodeClient && capabilities.background && panel === "background" && (
      <BackgroundCommands
        client={opencodeClient}
        sessionID={sessionID}
        directory={session.location.directory}
        initialShellID={backgroundShellID}
        initialDirectory={backgroundDirectory}
      />
    )}
  </Sheet>
);

type ChildrenSheetProps = Pick<
  ChatController,
  | "capabilities"
  | "onOpenSession"
  | "opencodeClient"
  | "panel"
  | "sessionID"
  | "setPanel"
>;

export const ChildrenSheet = ({
  capabilities,
  onOpenSession,
  opencodeClient,
  panel,
  sessionID,
  setPanel,
}: ChildrenSheetProps) => (
  <Sheet
    visible={panel === "children"}
    title="Child sessions"
    onClose={() => setPanel(null)}
  >
    {opencodeClient && capabilities.children && panel === "children" && (
      <ChildSessions
        client={opencodeClient}
        sessionID={sessionID}
        onOpenSession={(id) => {
          setPanel(null);
          onOpenSession(id);
        }}
      />
    )}
  </Sheet>
);

interface StatsSheetProps extends Pick<
  ChatController,
  "active" | "capabilities" | "panel" | "setPanel"
> {
  session: SessionInfo;
}

export const StatsSheet = ({
  active,
  capabilities,
  panel,
  session,
  setPanel,
}: StatsSheetProps) => (
  <Sheet
    visible={panel === "stats"}
    title="Session statistics"
    onClose={() => setPanel(null)}
  >
    {capabilities.statistics && panel === "stats" && (
      <SessionStats session={session} running={active} />
    )}
  </Sheet>
);

type SideQuestionSheetProps = Pick<
  ChatController,
  | "capabilities"
  | "opencodeClient"
  | "panel"
  | "sessionID"
  | "setPanel"
  | "setSideQuestion"
  | "sideQuestion"
>;

export const SideQuestionSheet = ({
  capabilities,
  opencodeClient,
  panel,
  sessionID,
  setPanel,
  setSideQuestion,
  sideQuestion,
}: SideQuestionSheetProps) => (
  <Sheet
    visible={panel === "btw"}
    title="Side question"
    onClose={() => setPanel(null)}
  >
    {opencodeClient && capabilities.sideQuestion && panel === "btw" && (
      <SideQuestion
        client={opencodeClient}
        sessionID={sessionID}
        initialQuestion={sideQuestion}
        onQuestionConsumed={() => setSideQuestion(undefined)}
      />
    )}
  </Sheet>
);

interface ResourcesSheetProps extends Pick<
  ChatController,
  "capabilities" | "opencodeClient" | "panel" | "setDraft" | "setPanel"
> {
  session: SessionInfo;
}

export const ResourcesSheet = ({
  capabilities,
  opencodeClient,
  panel,
  session,
  setDraft,
  setPanel,
}: ResourcesSheetProps) => (
  <Sheet
    visible={panel === "resources"}
    title="MCP resource references"
    onClose={() => setPanel(null)}
  >
    {opencodeClient && capabilities.resources && panel === "resources" && (
      <McpResources
        client={opencodeClient}
        location={{ directory: session.location.directory }}
        onAttachContext={(text) => {
          setDraft((current) => (current ? `${current}\n\n${text}` : text));
          setPanel(null);
        }}
      />
    )}
  </Sheet>
);
