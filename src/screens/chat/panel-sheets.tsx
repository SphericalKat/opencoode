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

export const DiffSheet = ({ chat }: { chat: ChatController }) => {
  const { colors, diffs, panel, panelLoading, setPanel } = chat;
  return (
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
};

export const ContextSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { context, opencodeClient, panel, panelLoading, setPanel } = chat;
  return (
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
};

export const InstructionsSheet = ({ chat }: { chat: ChatController }) => {
  const { capabilities, opencodeClient, panel, sessionID, setPanel } = chat;
  return (
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
};

export const SchedulesSheet = ({ chat }: { chat: ChatController }) => {
  const { capabilities, opencodeClient, panel, sessionID, setPanel } = chat;
  return (
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
};

export const BackgroundSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    backgroundDirectory,
    backgroundShellID,
    capabilities,
    opencodeClient,
    panel,
    sessionID,
    setPanel,
  } = chat;
  return (
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
};

export const ChildrenSheet = ({ chat }: { chat: ChatController }) => {
  const {
    capabilities,
    onOpenSession,
    opencodeClient,
    panel,
    sessionID,
    setPanel,
  } = chat;
  return (
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
};

export const StatsSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { active, capabilities, panel, setPanel } = chat;
  return (
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
};

export const SideQuestionSheet = ({ chat }: { chat: ChatController }) => {
  const {
    capabilities,
    opencodeClient,
    panel,
    sessionID,
    setPanel,
    setSideQuestion,
    sideQuestion,
  } = chat;
  return (
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
};

export const ResourcesSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { capabilities, opencodeClient, panel, setDraft, setPanel } = chat;
  return (
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
};
