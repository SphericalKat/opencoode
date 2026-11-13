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
  | "betaLayout"
  | "colors"
  | "currentModel"
  | "providerLabel"
  | "setPanel"
  | "styles"
> {
  session: SessionInfo;
}

export const ModelTrigger = ({
  betaLayout,
  colors,
  currentModel,
  providerLabel,
  session,
  setPanel,
  styles,
}: ModelTriggerProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Choose model, ${betaLayout && providerLabel ? `${providerLabel}, ` : ""}${currentModel?.name || session.model?.id || "Server default"}`}
    onPress={() => setPanel("models")}
    style={({ pressed }) => [
      styles.modelTrigger,
      betaLayout && styles.betaModelTrigger,
      pressed && { opacity: 0.6 },
    ]}
  >
    {betaLayout && providerLabel && (
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
        betaLayout && styles.betaTriggerText,
        betaLayout && styles.betaModelName,
      ]}
    >
      {currentModel?.name || session.model?.id || "Server default"}
    </BodyText>
    <ChatGlyph name="down" size={betaLayout ? 12 : 14} color={colors.muted} />
  </Pressable>
);

interface VariantTriggerProps extends Pick<
  ChatController,
  "betaLayout" | "colors" | "currentModel" | "pending" | "setPanel" | "styles"
> {
  session: SessionInfo;
}

export const VariantTrigger = ({
  betaLayout,
  colors,
  currentModel,
  pending,
  session,
  setPanel,
  styles,
}: VariantTriggerProps) =>
  betaLayout &&
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
  | "active"
  | "betaLayout"
  | "capabilities"
  | "delivery"
  | "hasPrompt"
  | "interrupt"
  | "jumpToLatest"
  | "pending"
  | "setDelivery"
  | "showLatestControl"
  | "stopping"
>;

export const StopControls = ({
  active,
  betaLayout,
  capabilities,
  delivery,
  hasPrompt,
  interrupt,
  jumpToLatest,
  pending,
  setDelivery,
  showLatestControl,
  stopping,
}: StopControlsProps) => (
  <>
    {betaLayout && active && hasPrompt && (
      <ChatIconButton
        name="stop"
        label="Stop generation"
        compactFace
        disabled={pending || stopping}
        onPress={() => {
          void interrupt();
        }}
      />
    )}
    {!betaLayout && (
      <>
        {capabilities.delivery && active && hasPrompt && (
          <Button
            title={delivery === "steer" ? "Steer" : "Queue"}
            accessibilityLabel="Message delivery"
            compact
            variant="ghost"
            onPress={() =>
              setDelivery((value) => (value === "steer" ? "queue" : "steer"))
            }
          />
        )}
        {active && hasPrompt && (
          <ChatIconButton
            name="stop"
            label="Stop generation"
            disabled={pending || stopping}
            onPress={() => {
              void interrupt();
            }}
          />
        )}
        {!(active && hasPrompt) && showLatestControl && (
          <ChatIconButton
            name="down"
            label="Jump to latest"
            onPress={jumpToLatest}
          />
        )}
      </>
    )}
  </>
);

type SendButtonProps = Pick<
  ChatController,
  | "active"
  | "betaLayout"
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
  betaLayout,
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
    compactFace={betaLayout}
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
  | "betaLayout"
  | "capabilities"
  | "colors"
  | "currentModel"
  | "delivery"
  | "hasPrompt"
  | "interrupt"
  | "jumpToLatest"
  | "pending"
  | "providerLabel"
  | "send"
  | "setDelivery"
  | "setPanel"
  | "showLatestControl"
  | "stopReady"
  | "stopping"
  | "styles"
> {
  session: SessionInfo;
}

export const ComposerToolbar = ({
  active,
  betaLayout,
  capabilities,
  colors,
  currentModel,
  delivery,
  hasPrompt,
  interrupt,
  jumpToLatest,
  pending,
  providerLabel,
  send,
  session,
  setDelivery,
  setPanel,
  showLatestControl,
  stopReady,
  stopping,
  styles,
}: ComposerToolbarProps) => (
  <View
    style={[styles.composerToolbar, betaLayout && styles.betaComposerToolbar]}
  >
    <ChatIconButton
      name="plus"
      label="Message tools"
      compactFace={betaLayout}
      onPress={() => setPanel("tools")}
    />
    <ModelTrigger
      betaLayout={betaLayout}
      colors={colors}
      currentModel={currentModel}
      providerLabel={providerLabel}
      setPanel={setPanel}
      styles={styles}
      session={session}
    />
    <VariantTrigger
      betaLayout={betaLayout}
      colors={colors}
      currentModel={currentModel}
      pending={pending}
      setPanel={setPanel}
      styles={styles}
      session={session}
    />
    <StopControls
      active={active}
      betaLayout={betaLayout}
      capabilities={capabilities}
      delivery={delivery}
      hasPrompt={hasPrompt}
      interrupt={interrupt}
      jumpToLatest={jumpToLatest}
      pending={pending}
      setDelivery={setDelivery}
      showLatestControl={showLatestControl}
      stopping={stopping}
    />
    <SendButton
      active={active}
      betaLayout={betaLayout}
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
  | "betaLayout"
  | "capabilities"
  | "colors"
  | "composerHeight"
  | "currentModel"
  | "delivery"
  | "draft"
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
  | "setAttachments"
  | "setDelivery"
  | "setDraft"
  | "setPanel"
  | "setRestoredSkillIDs"
  | "setSelectedAgentIDs"
  | "setSelectedMessageID"
  | "setSelectedSkills"
  | "showLatestControl"
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
  betaLayout,
  capabilities,
  colors,
  composerHeight,
  currentModel,
  delivery,
  draft,
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
  session,
  setAttachments,
  setDelivery,
  setDraft,
  setPanel,
  setRestoredSkillIDs,
  setSelectedAgentIDs,
  setSelectedMessageID,
  setSelectedSkills,
  showLatestControl,
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
        betaLayout && (capabilities.commands || capabilities.files)
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
        betaLayout && styles.betaComposerInput,
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
      betaLayout={betaLayout}
      capabilities={capabilities}
      colors={colors}
      currentModel={currentModel}
      delivery={delivery}
      hasPrompt={hasPrompt}
      interrupt={interrupt}
      jumpToLatest={jumpToLatest}
      pending={pending}
      providerLabel={providerLabel}
      send={send}
      setDelivery={setDelivery}
      setPanel={setPanel}
      showLatestControl={showLatestControl}
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
  | "betaLayout"
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
  | "setDelivery"
  | "setDraft"
  | "setPanel"
  | "setRestoredSkillIDs"
  | "setSelectedAgentIDs"
  | "setSelectedMessageID"
  | "setSelectedSkills"
  | "showActivityBar"
  | "showLatestControl"
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
  betaLayout,
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
  setDelivery,
  setDraft,
  setPanel,
  setRestoredSkillIDs,
  setSelectedAgentIDs,
  setSelectedMessageID,
  setSelectedSkills,
  showActivityBar,
  showLatestControl,
  stopReady,
  stopping,
  streamStatus,
  styles,
  updateComposerHeight,
  visible,
}: ComposerProps) => (
  <View style={[styles.composerDock, betaLayout && styles.betaComposerDock]}>
    <AgentActivityBar
      activity={activity}
      connectionStatus={streamStatus}
      sending={sending}
      stopping={stopping}
      animate={visible && foreground}
      show={showActivityBar}
      onReview={jumpToLatest}
    />
    <View style={[styles.composer, betaLayout && styles.betaComposer]}>
      {draftLoaded ? (
        <ComposerBody
          active={active}
          agents={agents}
          attachments={attachments}
          betaLayout={betaLayout}
          capabilities={capabilities}
          colors={colors}
          composerHeight={composerHeight}
          currentModel={currentModel}
          delivery={delivery}
          draft={draft}
          hasPrompt={hasPrompt}
          interrupt={interrupt}
          jumpToLatest={jumpToLatest}
          maximumComposerHeight={maximumComposerHeight}
          minimumComposerHeight={minimumComposerHeight}
          pending={pending}
          providerLabel={providerLabel}
          restoredSkillIDs={restoredSkillIDs}
          selectedAgentIDs={selectedAgentIDs}
          selectedSkills={selectedSkills}
          send={send}
          setAttachments={setAttachments}
          setDelivery={setDelivery}
          setDraft={setDraft}
          setPanel={setPanel}
          setRestoredSkillIDs={setRestoredSkillIDs}
          setSelectedAgentIDs={setSelectedAgentIDs}
          setSelectedMessageID={setSelectedMessageID}
          setSelectedSkills={setSelectedSkills}
          showLatestControl={showLatestControl}
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
