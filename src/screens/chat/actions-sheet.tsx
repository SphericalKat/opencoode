import type { SessionInfo } from "@opencode/client";
import { View } from "react-native";

import {
  Button,
  confirmAction,
  Disclosure,
  ErrorNotice,
  Field,
  JsonView,
  BodyText,
  Sheet,
} from "../../components/ui";
import { PanelLink } from "./controls";
import type { ChatController } from "./use-chat-controller";

type ToolLinksProps = Pick<
  ChatController,
  | "capabilities"
  | "inspect"
  | "opencodeClient"
  | "setBackgroundDirectory"
  | "setBackgroundShellID"
  | "setPanel"
  | "setSideQuestion"
>;

export const ToolLinks = ({
  capabilities,
  inspect,
  opencodeClient,
  setBackgroundDirectory,
  setBackgroundShellID,
  setPanel,
  setSideQuestion,
}: ToolLinksProps) =>
  opencodeClient &&
  (capabilities.diff ||
    capabilities.background ||
    capabilities.children ||
    capabilities.sideQuestion) && (
    <>
      <BodyText muted>Tools</BodyText>
      <View>
        {capabilities.diff && (
          <PanelLink
            title="File changes"
            onPress={() => {
              void inspect("diff");
            }}
          />
        )}
        {capabilities.background && (
          <PanelLink
            title="Background commands"
            onPress={() => {
              setBackgroundShellID(undefined);
              setBackgroundDirectory(undefined);
              setPanel("background");
            }}
          />
        )}
        {capabilities.children && (
          <PanelLink
            title="Child sessions"
            onPress={() => setPanel("children")}
          />
        )}
        {capabilities.sideQuestion && (
          <PanelLink
            title="Side question · /btw"
            onPress={() => {
              setSideQuestion(undefined);
              setPanel("btw");
            }}
          />
        )}
      </View>
    </>
  );

interface ConfigureLinksProps extends Pick<
  ChatController,
  "agents" | "capabilities" | "opencodeClient" | "setPanel"
> {
  session: SessionInfo;
}

export const ConfigureLinks = ({
  agents,
  capabilities,
  opencodeClient,
  session,
  setPanel,
}: ConfigureLinksProps) => (
  <>
    <BodyText muted>Configure</BodyText>
    <View>
      {opencodeClient && capabilities.agents && (
        <PanelLink
          title={`Agent · ${agents.find((agent) => agent.id === session.agent)?.name || session.agent || "Server default"}`}
          onPress={() => setPanel("agents")}
        />
      )}
      <PanelLink title="Model" onPress={() => setPanel("models")} />
      {opencodeClient && capabilities.instructions && (
        <PanelLink
          title="Instructions"
          onPress={() => setPanel("instructions")}
        />
      )}
      {opencodeClient && capabilities.schedules && (
        <PanelLink title="Schedules" onPress={() => setPanel("schedules")} />
      )}
    </View>
  </>
);

type DetailLinksProps = Pick<
  ChatController,
  "capabilities" | "exportSession" | "inspect" | "opencodeClient" | "setPanel"
>;

export const DetailLinks = ({
  capabilities,
  exportSession,
  inspect,
  opencodeClient,
  setPanel,
}: DetailLinksProps) =>
  (capabilities.statistics ||
    (opencodeClient && (capabilities.context || capabilities.export))) && (
    <>
      <BodyText muted>Details</BodyText>
      <View>
        {capabilities.statistics && (
          <PanelLink
            title="Session statistics"
            onPress={() => setPanel("stats")}
          />
        )}
        {opencodeClient && capabilities.context && (
          <PanelLink
            title="Agent context"
            onPress={() => {
              void inspect("context");
            }}
          />
        )}
        {opencodeClient && capabilities.export && (
          <PanelLink
            title="Export session"
            onPress={() => {
              void exportSession();
            }}
          />
        )}
      </View>
    </>
  );

interface ManageSessionProps extends Pick<
  ChatController,
  | "active"
  | "capabilities"
  | "client"
  | "delivery"
  | "moveDirectory"
  | "onOpenSession"
  | "opencodeClient"
  | "pending"
  | "run"
  | "sessionID"
  | "setMoveDirectory"
  | "setPanel"
  | "setTitle"
  | "title"
> {
  session: SessionInfo;
}

export const ManageSession = ({
  active,
  capabilities,
  client,
  delivery,
  moveDirectory,
  onOpenSession,
  opencodeClient,
  pending,
  run,
  session,
  sessionID,
  setMoveDirectory,
  setPanel,
  setTitle,
  title,
}: ManageSessionProps) => (
  <Disclosure title="Manage session">
    {capabilities.rename && (
      <>
        <Field label="Session title" value={title} onChangeText={setTitle} />
        <Button
          title="Rename"
          disabled={!title.trim()}
          busy={pending}
          onPress={() => {
            void run(
              () =>
                client.session.update({
                  sessionID,
                  title: title.trim(),
                }),
              true
            );
          }}
        />
      </>
    )}
    {opencodeClient && capabilities.move && (
      <>
        <Field
          label="Move to server directory"
          placeholder="/path/to/project"
          value={moveDirectory}
          onChangeText={setMoveDirectory}
        />
        <Button
          title="Move session"
          disabled={!moveDirectory.startsWith("/") || pending}
          onPress={() => {
            void run(
              () =>
                opencodeClient.session.move({
                  delivery,
                  directory: moveDirectory,
                  sessionID,
                }),
              true
            );
          }}
        />
      </>
    )}
    {capabilities.forkSession && (
      <Button
        title="Fork session"
        disabled={pending}
        onPress={() => {
          void run(async () => {
            const next = await client.session.fork({ sessionID });
            onOpenSession(next.id);
          }, true);
        }}
      />
    )}
    {capabilities.compact && (
      <Button
        title="Compact context"
        disabled={pending}
        onPress={() => {
          void run(
            () => client.session.compact({ delivery: "queue", sessionID }),
            true
          );
        }}
      />
    )}
    {opencodeClient && capabilities.background && active && (
      <Button
        title="Background blocking tools"
        disabled={pending}
        onPress={() => {
          void run(
            () => opencodeClient.session.background({ sessionID }),
            true
          );
        }}
      />
    )}
    {(session.parentID || session.fork?.sessionID) && (
      <Button
        title="Open source session"
        onPress={() => {
          setPanel(null);
          const target = session.parentID || session.fork?.sessionID;
          if (target) {
            onOpenSession(target);
          }
        }}
      />
    )}
    {opencodeClient && capabilities.archive && (
      <Button
        title={session.time.archived ? "Unarchive session" : "Archive session"}
        disabled={pending}
        onPress={() => {
          void run(
            () =>
              opencodeClient.session.update({
                archived: !session.time.archived,
                sessionID,
              }),
            true
          );
        }}
      />
    )}
    {opencodeClient && capabilities.remove && (
      <Button
        title="Delete session"
        variant="danger"
        disabled={pending}
        onPress={() => {
          void run(async () => {
            if (
              await confirmAction(
                "Delete this session?",
                "This permanently deletes this session and its messages."
              )
            ) {
              await opencodeClient.session.remove({ sessionID });
              onOpenSession("");
            }
          }, true);
        }}
      />
    )}
  </Disclosure>
);

interface ActionsSheetProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "capabilities"
  | "client"
  | "delivery"
  | "error"
  | "exportSession"
  | "inspect"
  | "moveDirectory"
  | "onOpenSession"
  | "opencodeClient"
  | "panel"
  | "pending"
  | "run"
  | "sessionID"
  | "setBackgroundDirectory"
  | "setBackgroundShellID"
  | "setMoveDirectory"
  | "setPanel"
  | "setSideQuestion"
  | "setTitle"
  | "title"
> {
  session: SessionInfo;
}

export const ActionsSheet = ({
  active,
  agents,
  capabilities,
  client,
  delivery,
  error,
  exportSession,
  inspect,
  moveDirectory,
  onOpenSession,
  opencodeClient,
  panel,
  pending,
  run,
  session,
  sessionID,
  setBackgroundDirectory,
  setBackgroundShellID,
  setMoveDirectory,
  setPanel,
  setSideQuestion,
  setTitle,
  title,
}: ActionsSheetProps) => (
  <Sheet
    visible={panel === "actions"}
    title="Session"
    onClose={() => setPanel(null)}
  >
    <BodyText selectable style={{ fontSize: 19, lineHeight: 26 }}>
      {session.title || "New session"}
    </BodyText>
    <ErrorNotice error={error} />
    <ToolLinks
      capabilities={capabilities}
      inspect={inspect}
      opencodeClient={opencodeClient}
      setBackgroundDirectory={setBackgroundDirectory}
      setBackgroundShellID={setBackgroundShellID}
      setPanel={setPanel}
      setSideQuestion={setSideQuestion}
    />
    <ConfigureLinks
      agents={agents}
      capabilities={capabilities}
      opencodeClient={opencodeClient}
      setPanel={setPanel}
      session={session}
    />
    <DetailLinks
      capabilities={capabilities}
      exportSession={exportSession}
      inspect={inspect}
      opencodeClient={opencodeClient}
      setPanel={setPanel}
    />
    <ManageSession
      active={active}
      capabilities={capabilities}
      client={client}
      delivery={delivery}
      moveDirectory={moveDirectory}
      onOpenSession={onOpenSession}
      opencodeClient={opencodeClient}
      pending={pending}
      run={run}
      sessionID={sessionID}
      setMoveDirectory={setMoveDirectory}
      setPanel={setPanel}
      setTitle={setTitle}
      title={title}
      session={session}
    />
    <Disclosure title="Raw session details">
      <JsonView value={session} />
    </Disclosure>
  </Sheet>
);
