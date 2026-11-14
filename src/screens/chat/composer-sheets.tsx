import type { SessionInfo } from "@opencode/client";

import { SheetGroup, SheetRow } from "../../components/list-sheet";
import { Busy, Empty, Field, BodyText, Sheet } from "../../components/ui";
import { serverFileUri } from "../../lib/chat";
import type { ChatController } from "./use-chat-controller";

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
    <SheetGroup>
      <SheetRow
        label="/btw"
        description="Ask about this session without a change to its history."
        disabled={!draftLoaded}
        onPress={() => {
          setDraft("/btw ");
          setPanel(null);
        }}
      />
      {commands.map((command) => (
        <SheetRow
          key={command.name}
          label={`/${command.name}`}
          description={command.description}
          onPress={() => {
            setDraft(`/${command.name} `);
            setPanel(null);
          }}
        />
      ))}
    </SheetGroup>
    {skills.length > 0 && (
      <SheetGroup title="Skills">
        {skills.map((skill) => (
          <SheetRow
            key={skill.id}
            label={skill.name}
            description={skill.description}
            onPress={() => {
              setSelectedSkills((current) =>
                current.some((item) => item.id === skill.id)
                  ? current
                  : [...current, skill]
              );
              setPanel(null);
            }}
          />
        ))}
      </SheetGroup>
    )}
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
  | "capabilities"
  | "fileQuery"
  | "fileResults"
  | "fileSearchBusy"
  | "opencodeClient"
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
  capabilities,
  fileQuery,
  fileResults,
  fileSearchBusy,
  opencodeClient,
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
    {opencodeClient && capabilities.resources && (
      <SheetGroup>
        <SheetRow
          label="MCP resources"
          trailing="chevron"
          onPress={() => setPanel("resources")}
        />
      </SheetGroup>
    )}
    <Field
      label="Find a server file"
      value={fileQuery}
      onChangeText={setFileQuery}
      placeholder="Path or filename"
    />
    {fileSearchBusy && <Busy />}
    {fileResults.length > 0 && (
      <SheetGroup>
        {fileResults.map((file) => (
          <SheetRow
            key={file.path}
            label={file.path}
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
      </SheetGroup>
    )}
    <SheetGroup title="Agents">
      {agents
        .filter((agent) => !agent.hidden)
        .map((agent) => (
          <SheetRow
            key={agent.id}
            label={agent.name}
            description={agent.description}
            onPress={() => {
              setSelectedAgentIDs((current) =>
                current.includes(agent.id) ? current : [...current, agent.id]
              );
              setPanel(null);
            }}
          />
        ))}
    </SheetGroup>
  </Sheet>
);
