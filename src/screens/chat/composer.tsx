import type { SessionInfo } from "@opencode/client";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";

import { AgentActivityBar } from "../../components/agent-activity";
import { SelectMenu, SelectTrigger } from "../../components/select";
import { elevation } from "../../components/surface";
import { Button, Busy, Field, BodyText } from "../../components/ui";
import { useTheme } from "../../lib/theme";
import { ChatIconButton } from "./controls";
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

type StopControlsProps = Pick<
  ChatController,
  "active" | "hasPrompt" | "interrupt" | "pending" | "stopping"
>;

export const StopControls = ({
  active,
  hasPrompt,
  interrupt,
  pending,
  stopping,
}: StopControlsProps) =>
  active &&
  hasPrompt && (
    <ChatIconButton
      name="stop"
      label="Stop generation"
      compactFace
      disabled={pending || stopping}
      onPress={() => {
        void interrupt();
      }}
    />
  );

type SendButtonProps = Pick<
  ChatController,
  | "active"
  | "delivery"
  | "hasPrompt"
  | "interrupt"
  | "pending"
  | "send"
  | "stopReady"
  | "stopping"
>;

export const SendButton = ({
  active,
  delivery,
  hasPrompt,
  interrupt,
  pending,
  send,
  stopReady,
  stopping,
}: SendButtonProps) => (
  <ChatIconButton
    name={active && !hasPrompt ? "stop" : "up"}
    label={sendButtonLabel(active, hasPrompt, delivery)}
    raised
    compactFace
    busy={pending}
    disabled={active && !hasPrompt ? !stopReady || stopping : !hasPrompt}
    onPress={() => {
      if (active && !hasPrompt) {
        void interrupt();
      } else {
        void send();
      }
    }}
  />
);

interface ComposerToolbarProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "capabilities"
  | "currentModel"
  | "delivery"
  | "hasPrompt"
  | "interrupt"
  | "opencodeClient"
  | "pending"
  | "providerLabel"
  | "selectedVariant"
  | "run"
  | "send"
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
  delivery,
  hasPrompt,
  interrupt,
  opencodeClient,
  pending,
  providerLabel,
  selectedVariant,
  run,
  send,
  session,
  sessionID,
  setPanel,
  stopReady,
  stopping,
  styles,
}: ComposerToolbarProps) => {
  const [chipsWidth, setChipsWidth] = useState<number | undefined>();
  const onChipsLayout = (event: LayoutChangeEvent) =>
    setChipsWidth(event.nativeEvent.layout.width);
  return (
    <View style={styles.composerControls}>
      <ChatIconButton
        name="plus"
        label="Message tools"
        compactFace
        onPress={() => setPanel("tools")}
      />
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
      <StopControls
        active={active}
        hasPrompt={hasPrompt}
        interrupt={interrupt}
        pending={pending}
        stopping={stopping}
      />
      <SendButton
        active={active}
        delivery={delivery}
        hasPrompt={hasPrompt}
        interrupt={interrupt}
        pending={pending}
        send={send}
        stopReady={stopReady}
        stopping={stopping}
      />
    </View>
  );
};

interface ComposerBodyProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "attachments"
  | "capabilities"
  | "composerHeight"
  | "currentModel"
  | "delivery"
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
  session: SessionInfo;
}

export const ComposerBody = ({
  active,
  agents,
  attachments,
  capabilities,
  composerHeight,
  currentModel,
  delivery,
  draft,
  hasPrompt,
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
        placeholder={
          capabilities.commands || capabilities.files
            ? "Ask anything, / for commands, @ for context…"
            : "Ask anything…"
        }
        autoCapitalize="sentences"
        autoCorrect
        spellCheck
        returnKeyType="default"
        submitBehavior="newline"
        multiline
        value={draft}
        onChangeText={setDraft}
        onContentSizeChange={updateComposerHeight}
        onFocus={() => setSelectedMessageID(null)}
        style={[
          styles.composerInput,
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
        capabilities={capabilities}
        currentModel={currentModel}
        delivery={delivery}
        hasPrompt={hasPrompt}
        interrupt={interrupt}
        opencodeClient={opencodeClient}
        pending={pending}
        providerLabel={providerLabel}
        selectedVariant={selectedVariant}
        run={run}
        send={send}
        sessionID={sessionID}
        setPanel={setPanel}
        stopReady={stopReady}
        stopping={stopping}
        styles={styles}
        session={session}
      />
    </>
  );
};

interface ComposerProps extends Pick<
  ChatController,
  | "active"
  | "activity"
  | "agents"
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
            delivery={delivery}
            draft={draft}
            hasPrompt={hasPrompt}
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
  );
};
