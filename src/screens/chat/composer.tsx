import type { SessionInfo } from "@opencode/client";
import { Pressable, ScrollView, View } from "react-native";

import { AgentActivityBar } from "../../components/agent-activity";
import { Button, Busy, Field, BodyText } from "../../components/ui";
import { ChatGlyph, ChatIconButton } from "./controls";
import { sendButtonLabel } from "./labels";
import type { ChatController } from "./use-chat-controller";

export const ComposerChips = ({ chat }: { chat: ChatController }) => {
  const {
    agents,
    attachments,
    restoredSkillIDs,
    selectedAgentIDs,
    selectedSkills,
    setAttachments,
    setRestoredSkillIDs,
    setSelectedAgentIDs,
    setSelectedSkills,
  } = chat;
  return (
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
    )
  );
};

export const ModelTrigger = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { betaLayout, colors, currentModel, providerLabel, setPanel, styles } =
    chat;
  return (
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
};

export const VariantTrigger = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { betaLayout, colors, currentModel, pending, setPanel, styles } = chat;
  return (
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
    )
  );
};

export const StopControls = ({ chat }: { chat: ChatController }) => {
  const {
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
  } = chat;
  return (
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
};

export const SendButton = ({ chat }: { chat: ChatController }) => {
  const {
    active,
    betaLayout,
    delivery,
    hasPrompt,
    interrupt,
    pending,
    send,
    stopReady,
    stopping,
  } = chat;
  return (
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
};

export const ComposerToolbar = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { betaLayout, setPanel, styles } = chat;
  return (
    <View
      style={[styles.composerToolbar, betaLayout && styles.betaComposerToolbar]}
    >
      <ChatIconButton
        name="plus"
        label="Message tools"
        compactFace={betaLayout}
        onPress={() => setPanel("tools")}
      />
      <ModelTrigger chat={chat} session={session} />
      <VariantTrigger chat={chat} session={session} />
      <StopControls chat={chat} />
      <SendButton chat={chat} />
    </View>
  );
};

export const ComposerBody = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    betaLayout,
    capabilities,
    composerHeight,
    draft,
    maximumComposerHeight,
    minimumComposerHeight,
    setDraft,
    setSelectedMessageID,
    styles,
    updateComposerHeight,
  } = chat;
  return (
    <>
      <ComposerChips chat={chat} />
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
      <ComposerToolbar chat={chat} session={session} />
    </>
  );
};

export const Composer = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    activity,
    betaLayout,
    draftLoaded,
    foreground,
    jumpToLatest,
    sending,
    showActivityBar,
    stopping,
    streamStatus,
    styles,
    visible,
  } = chat;
  return (
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
          <ComposerBody chat={chat} session={session} />
        ) : (
          <Busy />
        )}
      </View>
    </View>
  );
};
