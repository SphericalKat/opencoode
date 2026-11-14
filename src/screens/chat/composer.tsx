import type { SessionInfo } from "@opencode/client";
import { useEffect, useRef, useState } from "react";
import type { ComponentRef, RefObject } from "react";
import { ScrollView, View } from "react-native";
import type { LayoutChangeEvent, TextInput } from "react-native";

import { AgentActivityBar } from "../../components/agent-activity";
import { IconButton } from "../../components/icon-button";
import { SelectMenu, SelectTrigger } from "../../components/select";
import { elevation } from "../../components/surface";
import { Button, Busy, Field, BodyText, mono } from "../../components/ui";
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

const TOUCH_BAR_BUTTON = 44;
const GLYPH_FONT_SIZE = 17;
const GLYPH_LINE_HEIGHT = 20;
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
      indicator="sheet"
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
  maxWidth?: number;
  session: SessionInfo;
}

export const ModelTrigger = ({
  currentModel,
  maxWidth,
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
      indicator="sheet"
      accessibilityLabel={`Choose model, ${providerLabel ? `${providerLabel}, ` : ""}${name}`}
      disabled={pending}
      maxWidth={maxWidth}
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
      indicator="sheet"
      accessibilityLabel={`Choose model variant, ${label}`}
      disabled={pending}
      maxWidth={VARIANT_CHIP_MAX_WIDTH}
      value={label}
      onPress={() => setPanel("variants")}
    />
  );
};

interface ComposerToolbarProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "capabilities"
  | "currentModel"
  | "hasPrompt"
  | "interrupt"
  | "opencodeClient"
  | "pending"
  | "providerLabel"
  | "selectedVariant"
  | "run"
  | "sessionID"
  | "setPanel"
  | "stopReady"
  | "stopping"
  | "styles"
> {
  session: SessionInfo;
}

export const ComposerToolbar = ({
  active,
  agents,
  capabilities,
  currentModel,
  hasPrompt,
  interrupt,
  opencodeClient,
  pending,
  providerLabel,
  selectedVariant,
  run,
  session,
  sessionID,
  setPanel,
  stopReady,
  stopping,
  styles,
}: ComposerToolbarProps) => {
  const { colors } = useTheme();
  const [chipsWidth, setChipsWidth] = useState<number | undefined>();
  const onChipsLayout = (event: LayoutChangeEvent) =>
    setChipsWidth(event.nativeEvent.layout.width);
  return (
    <View style={styles.composerControls}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.composerControlsContent}
        keyboardShouldPersistTaps="handled"
        onLayout={onChipsLayout}
        showsHorizontalScrollIndicator={false}
        style={styles.composerControlsScroll}
      >
        <AgentChip
          agents={agents}
          capabilities={capabilities}
          opencodeClient={opencodeClient}
          pending={pending}
          run={run}
          session={session}
          sessionID={sessionID}
        />
        <ModelTrigger
          currentModel={currentModel}
          maxWidth={chipsWidth}
          pending={pending}
          providerLabel={providerLabel}
          setPanel={setPanel}
          styles={styles}
          session={session}
        />
        <VariantTrigger
          capabilities={capabilities}
          currentModel={currentModel}
          pending={pending}
          selectedVariant={selectedVariant}
          setPanel={setPanel}
        />
      </ScrollView>
      {active && hasPrompt && (
        <IconButton
          icon="stop"
          size={28}
          color={colors.muted}
          pressedColor={colors.text}
          accessibilityLabel="Stop"
          disabled={!stopReady || stopping}
          busy={stopping}
          onPress={() => {
            void interrupt();
          }}
        />
      )}
    </View>
  );
};

const textGlyph = (character: string) => {
  const Glyph = (color: string) => (
    <BodyText
      style={{
        color,
        fontFamily: mono,
        fontSize: GLYPH_FONT_SIZE,
        lineHeight: GLYPH_LINE_HEIGHT,
      }}
    >
      {character}
    </BodyText>
  );
  return Glyph;
};

const commandsGlyph = textGlyph("/");
const mentionsGlyph = textGlyph("@");
const shellGlyph = textGlyph("!");

type TouchBarLeftProps = Pick<
  ChatController,
  | "attachDevice"
  | "capabilities"
  | "draft"
  | "draftLoaded"
  | "opencodeClient"
  | "setDraft"
  | "setPanel"
> & {
  focusInput: () => void;
  shellMode: boolean;
};

const TouchBarLeft = ({
  attachDevice,
  capabilities,
  draft,
  draftLoaded,
  focusInput,
  opencodeClient,
  setDraft,
  setPanel,
  shellMode,
}: TouchBarLeftProps) => {
  const { colors } = useTheme();
  if (shellMode) {
    return (
      <Button
        variant="ghost"
        size="large"
        title="Exit"
        onPress={() => {
          setDraft(draft.replace(LEADING_BANG, ""));
          focusInput();
        }}
      />
    );
  }
  const disabled = !draftLoaded;
  const color = colors.faint;
  const pressedColor = colors.text;
  return (
    <>
      {capabilities.attachments && (
        <IconButton
          icon="plus"
          size={TOUCH_BAR_BUTTON}
          color={color}
          pressedColor={pressedColor}
          accessibilityLabel="Add images and files"
          disabled={disabled}
          onPress={() => {
            void attachDevice();
          }}
        />
      )}
      {opencodeClient && (capabilities.commands || capabilities.skills) && (
        <IconButton
          icon={commandsGlyph}
          size={TOUCH_BAR_BUTTON}
          color={color}
          pressedColor={pressedColor}
          accessibilityLabel="Commands"
          disabled={disabled}
          onPress={() => setPanel("commands")}
        />
      )}
      {opencodeClient && (capabilities.files || capabilities.resources) && (
        <IconButton
          icon={mentionsGlyph}
          size={TOUCH_BAR_BUTTON}
          color={color}
          pressedColor={pressedColor}
          accessibilityLabel="Context"
          disabled={disabled}
          onPress={() => setPanel("mentions")}
        />
      )}
      {capabilities.shell && (
        <IconButton
          icon={shellGlyph}
          size={TOUCH_BAR_BUTTON}
          color={color}
          pressedColor={pressedColor}
          accessibilityLabel="Shell command"
          disabled={disabled}
          onPress={() => {
            if (!draft.startsWith("!")) {
              setDraft(`!${draft}`);
            }
            focusInput();
          }}
        />
      )}
    </>
  );
};

type TouchBarRightProps = Pick<
  ChatController,
  | "active"
  | "capabilities"
  | "delivery"
  | "hasPrompt"
  | "interrupt"
  | "pending"
  | "send"
  | "stopReady"
  | "stopping"
> & {
  shellMode: boolean;
};

const TouchBarRight = ({
  active,
  capabilities,
  delivery,
  hasPrompt,
  interrupt,
  pending,
  send,
  shellMode,
  stopReady,
  stopping,
}: TouchBarRightProps) => {
  const { colors } = useTheme();
  const stopDisabled = !stopReady || stopping;
  if (active && !hasPrompt) {
    return (
      <Button
        variant="secondary"
        size="large"
        shape="rounded"
        icon="stop"
        title="Stop"
        disabled={stopDisabled}
        onPress={() => {
          void interrupt();
        }}
      />
    );
  }
  const queued = delivery === "queue";
  const alternate = active && capabilities.delivery;
  let submitTitle = "Send";
  if (alternate) {
    submitTitle = queued ? "Queue" : "Steer";
  }
  return (
    <>
      {active && shellMode && (
        <IconButton
          icon="stop"
          size={TOUCH_BAR_BUTTON}
          color={colors.muted}
          pressedColor={colors.text}
          accessibilityLabel="Stop"
          disabled={stopDisabled}
          busy={stopping}
          onPress={() => {
            void interrupt();
          }}
        />
      )}
      {alternate && (
        <Button
          variant="secondary"
          size="large"
          shape="rounded"
          title={queued ? "Steer" : "Queue"}
          onPress={() => {
            void send({ delivery: queued ? "steer" : "queue" });
          }}
        />
      )}
      <Button
        variant="submit"
        size="large"
        shape="rounded"
        icon={shellMode ? "return" : "arrow-up"}
        iconPosition="end"
        title={submitTitle}
        accessibilityLabel={sendButtonLabel(!!alternate, hasPrompt, delivery)}
        busy={pending}
        disabled={!hasPrompt}
        onPress={() => {
          void send();
        }}
      />
    </>
  );
};

type TouchBarProps = TouchBarLeftProps & TouchBarRightProps;

const TouchBar = ({
  active,
  attachDevice,
  capabilities,
  delivery,
  draft,
  draftLoaded,
  focusInput,
  hasPrompt,
  interrupt,
  opencodeClient,
  pending,
  send,
  setDraft,
  setPanel,
  shellMode,
  stopReady,
  stopping,
  styles,
}: TouchBarProps & Pick<ChatController, "styles">) => (
  <View style={styles.touchBar}>
    <TouchBarLeft
      attachDevice={attachDevice}
      capabilities={capabilities}
      draft={draft}
      draftLoaded={draftLoaded}
      focusInput={focusInput}
      opencodeClient={opencodeClient}
      setDraft={setDraft}
      setPanel={setPanel}
      shellMode={shellMode}
    />
    <View style={styles.touchBarSpacer} />
    <TouchBarRight
      active={active}
      capabilities={capabilities}
      delivery={delivery}
      hasPrompt={hasPrompt}
      interrupt={interrupt}
      pending={pending}
      send={send}
      shellMode={shellMode}
      stopReady={stopReady}
      stopping={stopping}
    />
  </View>
);

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
  | "attachments"
  | "capabilities"
  | "composerHeight"
  | "currentModel"
  | "draft"
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
  inputRef: RefObject<InputHandle | null>;
  session: SessionInfo;
  shellMode: boolean;
}

export const ComposerBody = ({
  active,
  agents,
  attachments,
  capabilities,
  composerHeight,
  currentModel,
  draft,
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
      {!shellMode && (
        <ComposerToolbar
          active={active}
          agents={agents}
          capabilities={capabilities}
          currentModel={currentModel}
          hasPrompt={hasPrompt}
          interrupt={interrupt}
          opencodeClient={opencodeClient}
          pending={pending}
          providerLabel={providerLabel}
          selectedVariant={selectedVariant}
          run={run}
          sessionID={sessionID}
          setPanel={setPanel}
          stopReady={stopReady}
          stopping={stopping}
          styles={styles}
          session={session}
        />
      )}
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
            attachments={attachments}
            capabilities={capabilities}
            composerHeight={composerHeight}
            currentModel={currentModel}
            draft={draft}
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
      <TouchBar
        active={active}
        attachDevice={attachDevice}
        capabilities={capabilities}
        delivery={delivery}
        draft={draft}
        draftLoaded={draftLoaded}
        focusInput={focusInput}
        hasPrompt={hasPrompt}
        interrupt={interrupt}
        opencodeClient={opencodeClient}
        pending={pending}
        send={send}
        setDraft={setDraft}
        setPanel={setPanel}
        shellMode={shellMode}
        stopReady={stopReady}
        stopping={stopping}
        styles={styles}
      />
    </View>
  );
};
