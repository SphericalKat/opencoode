import type { SessionInfo } from "@opencode/client";

import {
  Button,
  Busy,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Heading,
  BodyText,
  mono,
  Row,
  Sheet,
} from "../../components/ui";
import { serverFileUri } from "../../lib/chat";
import { playHaptic } from "../../lib/haptics";
import type { ChatController } from "./use-chat-controller";

interface AgentsSheetProps extends Pick<
  ChatController,
  | "agents"
  | "capabilities"
  | "error"
  | "opencodeClient"
  | "panel"
  | "pending"
  | "run"
  | "sessionID"
  | "setPanel"
> {
  session: SessionInfo;
}

export const AgentsSheet = ({
  agents,
  capabilities,
  error,
  opencodeClient,
  panel,
  pending,
  run,
  session,
  sessionID,
  setPanel,
}: AgentsSheetProps) => (
  <Sheet
    visible={!!opencodeClient && capabilities.agents && panel === "agents"}
    title="Choose agent"
    onClose={() => setPanel(null)}
  >
    <ErrorNotice error={error} />
    {opencodeClient &&
      agents
        .filter((agent) => !agent.hidden && agent.mode !== "subagent")
        .map((agent) => (
          <Card key={agent.id}>
            <BodyText style={{ fontWeight: "600" }}>{agent.name}</BodyText>
            {agent.description && (
              <BodyText muted>{agent.description}</BodyText>
            )}
            <Button
              title={session.agent === agent.id ? "Selected" : "Use agent"}
              selected={session.agent === agent.id}
              disabled={pending}
              onPress={() => {
                if (session.agent !== agent.id) {
                  playHaptic("select");
                }
                void run(
                  () =>
                    opencodeClient.session.switchAgent({
                      agent: agent.id,
                      sessionID,
                    }),
                  true
                );
              }}
            />
          </Card>
        ))}
  </Sheet>
);

interface ToolsSheetProps extends Pick<
  ChatController,
  | "agents"
  | "capabilities"
  | "delivery"
  | "draftLoaded"
  | "opencodeClient"
  | "panel"
  | "queueDevicePicker"
  | "setDelivery"
  | "setPanel"
  | "setSideQuestion"
  | "toolsDismissed"
> {
  session: SessionInfo;
}

export const ToolsSheet = ({
  agents,
  capabilities,
  delivery,
  draftLoaded,
  opencodeClient,
  panel,
  queueDevicePicker,
  session,
  setDelivery,
  setPanel,
  setSideQuestion,
  toolsDismissed,
}: ToolsSheetProps) => (
  <Sheet
    visible={panel === "tools"}
    title="Message tools"
    onClose={() => setPanel(null)}
    onDismiss={toolsDismissed}
  >
    {capabilities.attachments && (
      <Button
        title="Attach from device"
        disabled={!draftLoaded}
        onPress={queueDevicePicker}
      />
    )}
    {opencodeClient && capabilities.files && (
      <Button
        title="Files & agents"
        disabled={!draftLoaded}
        onPress={() => setPanel("mentions")}
      />
    )}
    {opencodeClient && capabilities.resources && (
      <Button
        title="MCP resource references"
        disabled={!draftLoaded}
        onPress={() => setPanel("resources")}
      />
    )}
    {opencodeClient && (capabilities.commands || capabilities.skills) && (
      <Button
        title="Commands & skills"
        disabled={!draftLoaded}
        onPress={() => setPanel("commands")}
      />
    )}
    {opencodeClient && capabilities.sideQuestion && (
      <Button
        title="Ask a side question · /btw"
        onPress={() => {
          setSideQuestion(undefined);
          setPanel("btw");
        }}
      />
    )}
    {opencodeClient && capabilities.agents && (
      <Button
        title={`Agent: ${agents.find((agent) => agent.id === session.agent)?.name || session.agent || "Choose agent"}`}
        onPress={() => setPanel("agents")}
      />
    )}
    {capabilities.delivery && (
      <>
        <BodyText muted>Message delivery</BodyText>
        <Row>
          <Button
            title="Steer current work"
            selected={delivery === "steer"}
            onPress={() => {
              if (delivery !== "steer") {
                playHaptic("select");
              }
              setDelivery("steer");
            }}
          />
          <Button
            title="Queue after current work"
            selected={delivery === "queue"}
            onPress={() => {
              if (delivery !== "queue") {
                playHaptic("select");
              }
              setDelivery("queue");
            }}
          />
        </Row>
      </>
    )}
    {capabilities.shell && (
      <BodyText muted>
        Start a message with ! to run a shell command on the server.
      </BodyText>
    )}
  </Sheet>
);

type CommandsSheetProps = Pick<
  ChatController,
  | "commands"
  | "draftLoaded"
  | "panel"
  | "setDraft"
  | "setPanel"
  | "setSelectedSkills"
  | "skills"
>;

export const CommandsSheet = ({
  commands,
  draftLoaded,
  panel,
  setDraft,
  setPanel,
  setSelectedSkills,
  skills,
}: CommandsSheetProps) => (
  <Sheet
    visible={panel === "commands"}
    title="Commands & skills"
    onClose={() => setPanel(null)}
  >
    <BodyText muted>
      Commands run on the server. Skills join your next message.
    </BodyText>
    <Card>
      <BodyText style={{ fontFamily: mono }}>/btw</BodyText>
      <BodyText muted>
        Ask about this session without a change to its history.
      </BodyText>
      <Button
        title="Use side question"
        compact
        disabled={!draftLoaded}
        onPress={() => {
          setDraft("/btw ");
          setPanel(null);
        }}
      />
    </Card>
    {commands.map((command) => (
      <Card key={command.name}>
        <BodyText style={{ fontFamily: mono }}>/{command.name}</BodyText>
        {command.description && (
          <BodyText muted>{command.description}</BodyText>
        )}
        <Button
          title="Use command"
          compact
          onPress={() => {
            setDraft(`/${command.name} `);
            setPanel(null);
          }}
        />
      </Card>
    ))}
    {skills.map((skill) => (
      <Card key={skill.id}>
        <BodyText>{skill.name}</BodyText>
        {skill.description && <BodyText muted>{skill.description}</BodyText>}
        <Button
          title="Attach skill"
          compact
          onPress={() => {
            setSelectedSkills((current) =>
              current.some((item) => item.id === skill.id)
                ? current
                : [...current, skill]
            );
            setPanel(null);
          }}
        />
      </Card>
    ))}
    {!commands.length && !skills.length && (
      <Empty
        title="No commands or skills"
        detail="Your server exposes its configured commands and skills here."
      />
    )}
  </Sheet>
);

interface MentionsSheetProps extends Pick<
  ChatController,
  | "agents"
  | "fileQuery"
  | "fileResults"
  | "fileSearchBusy"
  | "panel"
  | "setAttachments"
  | "setFileQuery"
  | "setPanel"
  | "setSelectedAgentIDs"
> {
  session: SessionInfo;
}

export const MentionsSheet = ({
  agents,
  fileQuery,
  fileResults,
  fileSearchBusy,
  panel,
  session,
  setAttachments,
  setFileQuery,
  setPanel,
  setSelectedAgentIDs,
}: MentionsSheetProps) => (
  <Sheet
    visible={panel === "mentions"}
    title="Files & agents"
    onClose={() => setPanel(null)}
  >
    <BodyText muted>
      Attach files from the server or ask a subagent to help.
    </BodyText>
    <Field
      label="Find a server file"
      value={fileQuery}
      onChangeText={setFileQuery}
      placeholder="Path or filename"
    />
    {fileSearchBusy && <Busy />}
    {fileResults.map((file) => (
      <Button
        key={file.path}
        title={file.path}
        onPress={() => {
          const path = `${session.location.directory.replace(/\/$/u, "")}/${file.path}`;
          const uri = serverFileUri(path);
          setAttachments((current) =>
            current.some((item) => item.uri === uri)
              ? current
              : [...current, { name: file.path, uri }]
          );
          setPanel(null);
        }}
      />
    ))}
    <Heading>Agents</Heading>
    {agents
      .filter((agent) => !agent.hidden)
      .map((agent) => (
        <Card key={agent.id}>
          <BodyText>{agent.name}</BodyText>
          {agent.description && <BodyText muted>{agent.description}</BodyText>}
          <Button
            title="Mention agent"
            compact
            onPress={() => {
              setSelectedAgentIDs((current) =>
                current.includes(agent.id) ? current : [...current, agent.id]
              );
              setPanel(null);
            }}
          />
        </Card>
      ))}
  </Sheet>
);
