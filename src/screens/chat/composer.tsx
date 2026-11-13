import type { SessionInfo } from "@opencode/client";
import { Pressable, ScrollView, View } from "react-native";

import { AgentActivityBar } from "../../components/agent-activity";
import { Button, Busy, Field, BodyText } from "../../components/ui";
import { ChatGlyph, ChatIconButton } from "./controls";
import { sendButtonLabel } from "./labels";
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
}: ComposerChipsProps) =>
  (attachments.length > 0 ||
    selectedSkills.length > 0 ||
    restoredSkillIDs.length > 0 ||
    selectedAgentIDs.length > 0) && (
    <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
      {attachments.map((file, index) => (
        <Button
          key={`${file.name}-${index}`}
          title={`${file.name || "File"} ×`}
          compact
          onPress={() =>
            setAttachments((current) => current.filter((_, i) => i !== index))
          }
        />
      ))}
      {selectedSkills.map((skill) => (
        <Button
          key={skill.id}
          title={`${skill.name} ×`}
          compact
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
          compact
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
          compact
          onPress={() =>
            setSelectedAgentIDs((current) =>
              current.filter((value) => value !== id)
            )
          }
        />
      ))}
    </ScrollView>
  );

interface ModelTriggerProps extends Pick<
  ChatController,
  "colors" | "currentModel" | "providerLabel" | "setPanel" | "styles"
> {
  session: SessionInfo;
}

export const ModelTrigger = ({
  colors,
  currentModel,
  providerLabel,
  session,
  setPanel,
  styles,
}: ModelTriggerProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Choose model, ${providerLabel ? `${providerLabel}, ` : ""}${currentModel?.name || session.model?.id || "Server default"}`}
    onPress={() => setPanel("models")}
    style={({ pressed }) => [
      styles.modelTrigger,
      styles.betaModelTrigger,
      pressed && { opacity: 0.6 },
    ]}
  >
    {providerLabel && (
      <>
        <BodyText
          numberOfLines={1}
          style={[styles.betaTriggerText, styles.betaProviderLabel]}
        >
          {providerLabel}
        </BodyText>
        <BodyText muted style={styles.betaTriggerText}>
          /
        </BodyText>
      </>
    )}
    <BodyText
      numberOfLines={1}
      style={[
        styles.modelTriggerText,
        styles.betaTriggerText,
        styles.betaModelName,
      ]}
    >
      {currentModel?.name || session.model?.id || "Server default"}
    </BodyText>
    <ChatGlyph name="down" size={12} color={colors.muted} />
  </Pressable>
);

interface VariantTriggerProps extends Pick<
  ChatController,
  "colors" | "currentModel" | "pending" | "setPanel" | "styles"
> {
  session: SessionInfo;
}

export const VariantTrigger = ({
  colors,
  currentModel,
  pending,
  session,
  setPanel,
  styles,
}: VariantTriggerProps) =>
  !!currentModel?.variants.length && (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choose variant, ${session.model?.variant || "Model default"}`}
      accessibilityState={{ disabled: pending }}
      disabled={pending}
      onPress={() => setPanel("variants")}
      style={({ pressed }) => [
        styles.betaVariantTrigger,
        pressed && { opacity: 0.6 },
      ]}
    >
      <BodyText numberOfLines={1} style={styles.betaTriggerText}>
        {session.model?.variant || "Default"}
      </BodyText>
      <ChatGlyph name="down" size={12} color={colors.muted} />
    </Pressable>
  );

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
  | "colors"
  | "currentModel"
  | "delivery"
  | "hasPrompt"
  | "interrupt"
  | "pending"
  | "providerLabel"
  | "send"
  | "setPanel"
  | "stopReady"
  | "stopping"
  | "styles"
> {
  session: SessionInfo;
}

export const ComposerToolbar = ({
  active,
  colors,
  currentModel,
  delivery,
  hasPrompt,
  interrupt,
  pending,
  providerLabel,
  send,
  session,
  setPanel,
  stopReady,
  stopping,
  styles,
}: ComposerToolbarProps) => (
  <View style={[styles.composerToolbar, styles.betaComposerToolbar]}>
    <ChatIconButton
      name="plus"
      label="Message tools"
      compactFace
      onPress={() => setPanel("tools")}
    />
    <ModelTrigger
      colors={colors}
      currentModel={currentModel}
      providerLabel={providerLabel}
      setPanel={setPanel}
      styles={styles}
      session={session}
    />
    <VariantTrigger
      colors={colors}
      currentModel={currentModel}
      pending={pending}
      setPanel={setPanel}
      styles={styles}
      session={session}
    />
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

interface ComposerBodyProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "attachments"
  | "capabilities"
  | "colors"
  | "composerHeight"
  | "currentModel"
  | "delivery"
  | "draft"
  | "hasPrompt"
  | "interrupt"
  | "maximumComposerHeight"
  | "minimumComposerHeight"
  | "pending"
  | "providerLabel"
  | "restoredSkillIDs"
  | "selectedAgentIDs"
  | "selectedSkills"
  | "send"
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
  colors,
  composerHeight,
  currentModel,
  delivery,
  draft,
  hasPrompt,
  interrupt,
  maximumComposerHeight,
  minimumComposerHeight,
  pending,
  providerLabel,
  restoredSkillIDs,
  selectedAgentIDs,
  selectedSkills,
  send,
  session,
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
}: ComposerBodyProps) => (
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
    />
    <Field
      accessibilityLabel="Message"
      placeholder={
        capabilities.commands || capabilities.files
          ? "Ask anything, / for commands, @ for context…"
          : "Ask anything…"
      }
      multiline
      value={draft}
      onChangeText={setDraft}
      onContentSizeChange={updateComposerHeight}
      onFocus={() => setSelectedMessageID(null)}
      style={[
        styles.composerInput,
        styles.betaComposerInput,
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
      colors={colors}
      currentModel={currentModel}
      delivery={delivery}
      hasPrompt={hasPrompt}
      interrupt={interrupt}
      pending={pending}
      providerLabel={providerLabel}
      send={send}
      setPanel={setPanel}
      stopReady={stopReady}
      stopping={stopping}
      styles={styles}
      session={session}
    />
  </>
);

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
  | "pending"
  | "providerLabel"
  | "restoredSkillIDs"
  | "selectedAgentIDs"
  | "selectedSkills"
  | "send"
  | "sending"
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
  pending,
  providerLabel,
  restoredSkillIDs,
  selectedAgentIDs,
  selectedSkills,
  send,
  sending,
  session,
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
}: ComposerProps) => (
  <View style={[styles.composerDock, styles.betaComposerDock]}>
    <AgentActivityBar
      activity={activity}
      connectionStatus={streamStatus}
      sending={sending}
      stopping={stopping}
      animate={visible && foreground}
      show={showActivityBar}
      onReview={jumpToLatest}
    />
    <View style={[styles.composer, styles.betaComposer]}>
      {draftLoaded ? (
        <ComposerBody
          active={active}
          agents={agents}
          attachments={attachments}
          capabilities={capabilities}
          colors={colors}
          composerHeight={composerHeight}
          currentModel={currentModel}
          delivery={delivery}
          draft={draft}
          hasPrompt={hasPrompt}
          interrupt={interrupt}
          maximumComposerHeight={maximumComposerHeight}
          minimumComposerHeight={minimumComposerHeight}
          pending={pending}
          providerLabel={providerLabel}
          restoredSkillIDs={restoredSkillIDs}
          selectedAgentIDs={selectedAgentIDs}
          selectedSkills={selectedSkills}
          send={send}
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
