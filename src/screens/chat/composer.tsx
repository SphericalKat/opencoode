import type { SessionInfo } from "@opencode/client";
import { useEffect, useRef, useState } from "react";
import type { ComponentRef, RefObject } from "react";
import { ScrollView, View } from "react-native";
import type { TextInput } from "react-native";

import { AgentActivityBar } from "../../components/agent-activity";
import {
  AnchoredMenu,
  MenuRow,
  MenuSeparator,
  useMenuAnchor,
} from "../../components/anchored-menu";
import type { Rect } from "../../components/anchored-menu";
import { IconButton } from "../../components/icon-button";
import { SelectMenu, SelectTrigger } from "../../components/select";
import { elevation } from "../../components/surface";
import { Button, Busy, Field, BodyText } from "../../components/ui";
import { useTheme } from "../../lib/theme";
import { sendButtonLabel } from "./labels";
import { capitalizeFirst, modelDisplayName } from "./model-label";
import type { ChatController } from "./use-chat-controller";

type ComposerChipsProps = Pick<
  ChatController,
  | "agents"
  | "attachments"
  | "restoredSkillIDs"
  | "selectedAgentIDs"
  | "selectedSkills"
  | "setAttachments"
  | "setRestoredSkillIDs"
  | "setSelectedAgentIDs"
  | "setSelectedSkills"
  | "styles"
>;

export const ComposerChips = ({
  agents,
  attachments,
  restoredSkillIDs,
  selectedAgentIDs,
  selectedSkills,
  setAttachments,
  setRestoredSkillIDs,
  setSelectedAgentIDs,
  setSelectedSkills,
  styles,
}: ComposerChipsProps) =>
  (attachments.length > 0 ||
    selectedSkills.length > 0 ||
    restoredSkillIDs.length > 0 ||
    selectedAgentIDs.length > 0) && (
    <ScrollView
      horizontal
      contentContainerStyle={styles.composerChipsContent}
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={styles.composerChips}
    >
      {attachments.map((file, index) => (
        <Button
          key={`${file.name}-${index}`}
          title={`${file.name || "File"} ×`}
          size="compact"
          onPress={() =>
            setAttachments((current) => current.filter((_, i) => i !== index))
          }
        />
      ))}
      {selectedSkills.map((skill) => (
        <Button
          key={skill.id}
          title={`${skill.name} ×`}
          size="compact"
          onPress={() =>
            setSelectedSkills((current) =>
              current.filter((item) => item.id !== skill.id)
            )
          }
        />
      ))}
      {restoredSkillIDs.map((id) => (
        <Button
          key={id}
          title={`${id} ×`}
          size="compact"
          onPress={() =>
            setRestoredSkillIDs((current) =>
              current.filter((value) => value !== id)
            )
          }
        />
      ))}
      {selectedAgentIDs.map((id) => (
        <Button
          key={id}
          title={`@${agents.find((agent) => agent.id === id)?.name || id} ×`}
          size="compact"
          onPress={() =>
            setSelectedAgentIDs((current) =>
              current.filter((value) => value !== id)
            )
          }
        />
      ))}
    </ScrollView>
  );

type InputHandle = ComponentRef<typeof TextInput>;

const LEADING_BANG = /^!/u;

const AGENT_CHIP_MAX_WIDTH = 220;
const AGENT_MENU_GUTTER = 6;

type AgentChipProps = Pick<
  ChatController,
  "agents" | "capabilities" | "opencodeClient" | "pending" | "run" | "sessionID"
> & {
  session: SessionInfo;
};

export const AgentChip = ({
  agents,
  capabilities,
  opencodeClient,
  pending,
  run,
  session,
  sessionID,
}: AgentChipProps) => {
  const primary = agents.filter(
    (agent) => !agent.hidden && agent.mode !== "subagent"
  );
  if (!opencodeClient || !capabilities.agents || primary.length === 0) {
    return null;
  }
  const currentID = session.agent ?? primary[0].id;
  const name =
    agents.find((agent) => agent.id === currentID)?.name ?? currentID;
  return (
    <SelectMenu
      appearance="chip"
      indicator="menu"
      placement="top-start"
      gutter={AGENT_MENU_GUTTER}
      maxWidth={AGENT_CHIP_MAX_WIDTH}
      accessibilityLabel="Choose agent"
      disabled={pending}
      label={capitalizeFirst(name)}
      value={currentID}
      options={primary.map((agent) => ({
        label: capitalizeFirst(agent.name),
        value: agent.id,
      }))}
      onSelect={(id) => {
        if (id !== currentID) {
          void run(() =>
            opencodeClient.session.switchAgent({ agent: id, sessionID })
          );
        }
      }}
    />
  );
};

interface ModelTriggerProps extends Pick<
  ChatController,
  "currentModel" | "pending" | "providerLabel" | "setPanel" | "styles"
> {
  session: SessionInfo;
}

export const ModelTrigger = ({
  currentModel,
  pending,
  providerLabel,
  session,
  setPanel,
  styles,
}: ModelTriggerProps) => {
  const name = currentModel
    ? modelDisplayName(currentModel.name)
    : (session.model?.id ?? "Server default");
  return (
    <SelectTrigger
      appearance="chip"
      flexible
      accessibilityLabel={`Choose model, ${providerLabel ? `${providerLabel}, ` : ""}${name}`}
      disabled={pending}
      value={name}
      onPress={() => setPanel("models")}
    >
      <View style={styles.chipContent}>
        {providerLabel && (
          <>
            <BodyText numberOfLines={1} style={styles.chipProvider}>
              {providerLabel}
            </BodyText>
            <BodyText style={styles.chipSlash}>/</BodyText>
          </>
        )}
        <BodyText numberOfLines={1} style={styles.chipModelName}>
          {name}
        </BodyText>
      </View>
    </SelectTrigger>
  );
};

const VARIANT_CHIP_MAX_WIDTH = 220;

type VariantTriggerProps = Pick<
  ChatController,
  "capabilities" | "currentModel" | "pending" | "selectedVariant" | "setPanel"
>;

export const VariantTrigger = ({
  capabilities,
  currentModel,
  pending,
  selectedVariant,
  setPanel,
}: VariantTriggerProps) => {
  const optionCount =
    (currentModel?.variants.length ?? 0) +
    (capabilities.defaultVariant ? 1 : 0);
  if (optionCount < 2) {
    return null;
  }
  const label = capitalizeFirst(selectedVariant ?? "default");
  return (
    <SelectTrigger
      appearance="chip"
      accessibilityLabel={`Choose model variant, ${label}`}
      disabled={pending}
      maxWidth={VARIANT_CHIP_MAX_WIDTH}
      value={label}
      onPress={() => setPanel("variants")}
    />
  );
};

const CONTROL_SIZE = 28;
const ADD_MENU_GUTTER = 6;
const ADD_MENU_MIN_WIDTH = 180;

type AddMenuProps = Pick<
  ChatController,
  | "attachDevice"
  | "capabilities"
  | "draft"
  | "draftLoaded"
  | "opencodeClient"
  | "setDraft"
  | "setPanel"
  | "styles"
> & {
  focusInput: () => void;
  shellMode: boolean;
};

const AddMenu = ({
  attachDevice,
  capabilities,
  draft,
  draftLoaded,
  focusInput,
  opencodeClient,
  setDraft,
  setPanel,
  shellMode,
  styles,
}: AddMenuProps) => {
  const { colors } = useTheme();
  const { ref, measure } = useMenuAnchor();
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const attach = capabilities.attachments;
  const commands =
    !!opencodeClient && (capabilities.commands || capabilities.skills);
  const context =
    !!opencodeClient && (capabilities.files || capabilities.resources);
  const { shell } = capabilities;
  if (!(attach || commands || context || shell)) {
    return null;
  }
  // Pickers and sheets open after the menu has closed, so two modals never overlap.
  const choose = (action: () => void) => () => {
    pending.current = action;
  };
  const shortcut = (glyph: string) => (
    <BodyText style={styles.addMenuShortcut}>{glyph}</BodyText>
  );
  return (
    <View ref={ref} collapsable={false}>
      <IconButton
        icon="plus"
        size={CONTROL_SIZE}
        color={colors.faint}
        pressedColor={colors.text}
        selected={visible}
        accessibilityLabel="Add"
        disabled={!draftLoaded || shellMode}
        onPress={() => {
          measure()
            .then((rect) => {
              setAnchor(rect);
              setVisible(true);
              return rect;
            })
            .catch(() => null);
        }}
      />
      <AnchoredMenu
        visible={visible}
        anchor={anchor}
        accessibilityLabel="Add"
        placement="top-start"
        gutter={ADD_MENU_GUTTER}
        minWidth={ADD_MENU_MIN_WIDTH}
        onClose={() => setVisible(false)}
        onClosed={() => {
          const action = pending.current;
          pending.current = null;
          action?.();
        }}
      >
        {attach && (
          <MenuRow
            label="Images and files"
            onPress={choose(() => {
              void attachDevice();
            })}
          />
        )}
        {attach && (commands || context || shell) && <MenuSeparator />}
        {commands && (
          <MenuRow
            label="Commands"
            trailing={shortcut("/")}
            onPress={choose(() => setPanel("commands"))}
          />
        )}
        {context && (
          <MenuRow
            label="Context"
            trailing={shortcut("@")}
            onPress={choose(() => setPanel("mentions"))}
          />
        )}
        {shell && (
          <MenuRow
            label="Shell command"
            trailing={shortcut("!")}
            onPress={choose(() => {
              if (!draft.startsWith("!")) {
                setDraft(`!${draft}`);
              }
              focusInput();
            })}
          />
        )}
      </AnchoredMenu>
    </View>
  );
};

type ComposerActionsProps = Pick<
  ChatController,
  | "active"
  | "capabilities"
  | "delivery"
  | "draft"
  | "hasPrompt"
  | "interrupt"
  | "pending"
  | "send"
  | "setDraft"
  | "stopReady"
  | "stopping"
  | "styles"
> & {
  focusInput: () => void;
  shellMode: boolean;
};

const ComposerActions = ({
  active,
  capabilities,
  delivery,
  draft,
  focusInput,
  hasPrompt,
  interrupt,
  pending,
  send,
  setDraft,
  shellMode,
  stopReady,
  stopping,
  styles,
}: ComposerActionsProps) => {
  const { colors } = useTheme();
  const stopDisabled = !stopReady || stopping;
  const stopMode = active && !hasPrompt;
  const queued = delivery === "queue";
  const alternate = active && hasPrompt && capabilities.delivery && !shellMode;
  const stop = () => {
    void interrupt();
  };
  return (
    <View style={styles.composerActions}>
      {shellMode && (
        <Button
          variant="ghost"
          size="small"
          title="Exit shell"
          onPress={() => {
            setDraft(draft.replace(LEADING_BANG, ""));
            focusInput();
          }}
        />
      )}
      {alternate && (
        <Button
          variant="ghost"
          size="small"
          title={queued ? "Steer" : "Queue"}
          onPress={() => {
            void send({ delivery: queued ? "steer" : "queue" });
          }}
        />
      )}
      {active && hasPrompt && !alternate && (
        <IconButton
          icon="stop"
          size={CONTROL_SIZE}
          color={colors.faint}
          pressedColor={colors.text}
          accessibilityLabel="Stop"
          disabled={stopDisabled}
          busy={stopping}
          onPress={stop}
        />
      )}
      {stopMode ? (
        <IconButton
          variant="submit"
          icon="stop"
          size={CONTROL_SIZE}
          accessibilityLabel="Stop"
          disabled={stopDisabled}
          busy={stopping}
          onPress={stop}
        />
      ) : (
        <IconButton
          variant="submit"
          icon={shellMode ? "return" : "arrow-up"}
          size={CONTROL_SIZE}
          accessibilityLabel={sendButtonLabel(!!alternate, hasPrompt, delivery)}
          busy={pending}
          disabled={!hasPrompt}
          onPress={() => {
            void send();
          }}
        />
      )}
    </View>
  );
};

interface ComposerToolbarProps
  extends
    Pick<
      ChatController,
      | "agents"
      | "currentModel"
      | "opencodeClient"
      | "providerLabel"
      | "run"
      | "selectedVariant"
      | "sessionID"
    >,
    AddMenuProps,
    ComposerActionsProps {
  session: SessionInfo;
}

export const ComposerToolbar = (props: ComposerToolbarProps) => {
  const { pending, shellMode, styles } = props;
  const chipsDisabled = pending || shellMode;
  return (
    <View style={styles.composerControls}>
      <AddMenu {...props} />
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.composerControlsScroll}
        contentContainerStyle={styles.composerControlsRow}
      >
        <AgentChip
          agents={props.agents}
          capabilities={props.capabilities}
          opencodeClient={props.opencodeClient}
          pending={chipsDisabled}
          run={props.run}
          session={props.session}
          sessionID={props.sessionID}
        />
        <ModelTrigger
          currentModel={props.currentModel}
          pending={chipsDisabled}
          providerLabel={props.providerLabel}
          setPanel={props.setPanel}
          styles={styles}
          session={props.session}
        />
        <VariantTrigger
          capabilities={props.capabilities}
          currentModel={props.currentModel}
          pending={chipsDisabled}
          selectedVariant={props.selectedVariant}
          setPanel={props.setPanel}
        />
      </ScrollView>
      <ComposerActions {...props} />
    </View>
  );
};

const composerPlaceholder = (
  capabilities: ChatController["capabilities"],
  shellMode: boolean
) => {
  if (shellMode) {
    return "Enter shell command…";
  }
  return capabilities.commands || capabilities.files
    ? "Ask anything, / for commands, @ for context…"
    : "Ask anything…";
};

interface ComposerBodyProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "attachDevice"
  | "attachments"
  | "capabilities"
  | "composerHeight"
  | "currentModel"
  | "delivery"
  | "draft"
  | "draftLoaded"
  | "hasPrompt"
  | "interrupt"
  | "maximumComposerHeight"
  | "minimumComposerHeight"
  | "opencodeClient"
  | "pending"
  | "providerLabel"
  | "selectedVariant"
  | "restoredSkillIDs"
  | "run"
  | "selectedAgentIDs"
  | "selectedSkills"
  | "send"
  | "sessionID"
  | "setAttachments"
  | "setDraft"
  | "setPanel"
  | "setRestoredSkillIDs"
  | "setSelectedAgentIDs"
  | "setSelectedMessageID"
  | "setSelectedSkills"
  | "stopReady"
  | "stopping"
  | "styles"
  | "updateComposerHeight"
> {
  focusInput: () => void;
  inputRef: RefObject<InputHandle | null>;
  session: SessionInfo;
  shellMode: boolean;
}

export const ComposerBody = ({
  active,
  agents,
  attachDevice,
  attachments,
  capabilities,
  composerHeight,
  currentModel,
  delivery,
  draft,
  draftLoaded,
  focusInput,
  hasPrompt,
  inputRef,
  interrupt,
  maximumComposerHeight,
  minimumComposerHeight,
  opencodeClient,
  pending,
  providerLabel,
  selectedVariant,
  restoredSkillIDs,
  run,
  selectedAgentIDs,
  selectedSkills,
  send,
  session,
  sessionID,
  setAttachments,
  setDraft,
  setPanel,
  setRestoredSkillIDs,
  setSelectedAgentIDs,
  setSelectedMessageID,
  setSelectedSkills,
  shellMode,
  stopReady,
  stopping,
  styles,
  updateComposerHeight,
}: ComposerBodyProps) => {
  const { scheme } = useTheme();
  return (
    <>
      <ComposerChips
        agents={agents}
        attachments={attachments}
        restoredSkillIDs={restoredSkillIDs}
        selectedAgentIDs={selectedAgentIDs}
        selectedSkills={selectedSkills}
        setAttachments={setAttachments}
        setRestoredSkillIDs={setRestoredSkillIDs}
        setSelectedAgentIDs={setSelectedAgentIDs}
        setSelectedSkills={setSelectedSkills}
        styles={styles}
      />
      {/* Android resets a live TextInput's padding when the theme changes, so remount it. */}
      <Field
        key={scheme}
        accessibilityLabel="Message"
        ref={inputRef as never}
        placeholder={composerPlaceholder(capabilities, shellMode)}
        autoCapitalize={shellMode ? "none" : "sentences"}
        autoCorrect={!shellMode}
        spellCheck={!shellMode}
        returnKeyType="default"
        submitBehavior="newline"
        multiline
        value={draft}
        onChangeText={setDraft}
        onContentSizeChange={updateComposerHeight}
        onFocus={() => setSelectedMessageID(null)}
        style={[
          styles.composerInput,
          shellMode && styles.composerInputShell,
          {
            height: draft
              ? Math.max(minimumComposerHeight, composerHeight)
              : minimumComposerHeight,
            maxHeight: maximumComposerHeight,
            minHeight: minimumComposerHeight,
          },
        ]}
      />
      <ComposerToolbar
        active={active}
        agents={agents}
        attachDevice={attachDevice}
        capabilities={capabilities}
        currentModel={currentModel}
        delivery={delivery}
        draft={draft}
        draftLoaded={draftLoaded}
        focusInput={focusInput}
        hasPrompt={hasPrompt}
        interrupt={interrupt}
        opencodeClient={opencodeClient}
        pending={pending}
        providerLabel={providerLabel}
        selectedVariant={selectedVariant}
        run={run}
        send={send}
        session={session}
        sessionID={sessionID}
        setDraft={setDraft}
        setPanel={setPanel}
        shellMode={shellMode}
        stopReady={stopReady}
        stopping={stopping}
        styles={styles}
      />
    </>
  );
};

interface ComposerProps extends Pick<
  ChatController,
  | "active"
  | "activity"
  | "agents"
  | "attachDevice"
  | "attachments"
  | "capabilities"
  | "colors"
  | "composerHeight"
  | "currentModel"
  | "delivery"
  | "draft"
  | "draftLoaded"
  | "foreground"
  | "hasPrompt"
  | "interrupt"
  | "jumpToLatest"
  | "maximumComposerHeight"
  | "minimumComposerHeight"
  | "opencodeClient"
  | "pending"
  | "panel"
  | "providerLabel"
  | "selectedVariant"
  | "restoredSkillIDs"
  | "run"
  | "selectedAgentIDs"
  | "selectedSkills"
  | "send"
  | "sending"
  | "sessionID"
  | "setAttachments"
  | "setDraft"
  | "setPanel"
  | "setRestoredSkillIDs"
  | "setSelectedAgentIDs"
  | "setSelectedMessageID"
  | "setSelectedSkills"
  | "showActivityBar"
  | "stopReady"
  | "stopping"
  | "streamStatus"
  | "styles"
  | "updateComposerHeight"
  | "visible"
> {
  session: SessionInfo;
}

export const Composer = ({
  active,
  activity,
  agents,
  attachDevice,
  attachments,
  capabilities,
  colors,
  composerHeight,
  currentModel,
  delivery,
  draft,
  draftLoaded,
  foreground,
  hasPrompt,
  interrupt,
  jumpToLatest,
  maximumComposerHeight,
  minimumComposerHeight,
  opencodeClient,
  panel,
  pending,
  providerLabel,
  selectedVariant,
  restoredSkillIDs,
  run,
  selectedAgentIDs,
  selectedSkills,
  send,
  sending,
  session,
  sessionID,
  setAttachments,
  setDraft,
  setPanel,
  setRestoredSkillIDs,
  setSelectedAgentIDs,
  setSelectedMessageID,
  setSelectedSkills,
  showActivityBar,
  stopReady,
  stopping,
  streamStatus,
  styles,
  updateComposerHeight,
  visible,
}: ComposerProps) => {
  const { scheme } = useTheme();
  const inputRef = useRef<InputHandle>(null);
  const focusInput = () => inputRef.current?.focus();
  const shellMode = capabilities.shell && draft.startsWith("!");
  const previousPanel = useRef(panel);
  useEffect(() => {
    const closed = previousPanel.current;
    previousPanel.current = panel;
    if (panel === null && (closed === "commands" || closed === "mentions")) {
      inputRef.current?.focus();
    }
  }, [panel]);
  const cardStyle = {
    backgroundColor: scheme === "dark" ? colors.panel : colors.bg,
    boxShadow: elevation(scheme).raised,
  };
  return (
    <View style={styles.composerDock}>
      <View style={styles.composerCardArea}>
        <AgentActivityBar
          activity={activity}
          connectionStatus={streamStatus}
          sending={sending}
          stopping={stopping}
          animate={visible && foreground}
          show={showActivityBar}
          onReview={jumpToLatest}
        />
        <View style={[styles.composer, cardStyle]}>
          {draftLoaded ? (
            <ComposerBody
              active={active}
              agents={agents}
              attachDevice={attachDevice}
              attachments={attachments}
              capabilities={capabilities}
              composerHeight={composerHeight}
              currentModel={currentModel}
              delivery={delivery}
              draft={draft}
              draftLoaded={draftLoaded}
              focusInput={focusInput}
              hasPrompt={hasPrompt}
              inputRef={inputRef}
              interrupt={interrupt}
              maximumComposerHeight={maximumComposerHeight}
              minimumComposerHeight={minimumComposerHeight}
              opencodeClient={opencodeClient}
              pending={pending}
              providerLabel={providerLabel}
              selectedVariant={selectedVariant}
              restoredSkillIDs={restoredSkillIDs}
              run={run}
              selectedAgentIDs={selectedAgentIDs}
              selectedSkills={selectedSkills}
              send={send}
              sessionID={sessionID}
              setAttachments={setAttachments}
              setDraft={setDraft}
              setPanel={setPanel}
              setRestoredSkillIDs={setRestoredSkillIDs}
              setSelectedAgentIDs={setSelectedAgentIDs}
              setSelectedMessageID={setSelectedMessageID}
              setSelectedSkills={setSelectedSkills}
              shellMode={shellMode}
              stopReady={stopReady}
              stopping={stopping}
              styles={styles}
              updateComposerHeight={updateComposerHeight}
              session={session}
            />
          ) : (
            <Busy />
          )}
        </View>
      </View>
    </View>
  );
};
