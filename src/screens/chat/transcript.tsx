import type { SessionInfo } from "@opencode/client";
import { FlashList } from "@shopify/flash-list";
import { Platform, View } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";

import type { TranscriptItem } from "../../components/assistant-turn";
import { IconButton } from "../../components/icon-button";
import { useMotionPreference } from "../../components/motion";
import { SessionForms } from "../../components/session-forms";
import { elevation } from "../../components/surface";
import {
  Button,
  Card,
  Disclosure,
  Empty,
  BodyText,
  Row,
} from "../../components/ui";
import { withAlpha } from "../../lib/color";
import { MessageDisclosureContext } from "../../lib/message-actions";
import { useTheme } from "../../lib/theme";
import { MessageText } from "./controls";
import { inboxItemText } from "./labels";
import type { ChatController } from "./use-chat-controller";

const messageKey = (item: TranscriptItem) => item.id;
const messageType = (item: TranscriptItem) =>
  item.type === "message" ? item.message.type : item.type;
const MessageSeparator = () => <View style={{ height: 24 }} />;

const chipShownEase = cubicBezier(0.2, 0.8, 0.2, 1);
const chipHiddenEase = cubicBezier(0.4, 0, 1, 1);
const chipShownMs = 150;
const chipHiddenMs = 110;
const chipRiseOffset = 4;
const chipFaceAlpha = 0.92;

const JumpToLatest = ({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) => {
  const { colors, scheme } = useTheme();
  const reduced = useMotionPreference();
  const translateY = visible || reduced ? 0 : chipRiseOffset;
  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents={visible ? "auto" : "none"}
      style={{
        opacity: visible ? 1 : 0,
        transform: [{ translateY }],
        transitionDuration: visible ? chipShownMs : chipHiddenMs,
        transitionProperty: ["opacity", "transform"],
        transitionTimingFunction: visible ? chipShownEase : chipHiddenEase,
      }}
    >
      <IconButton
        icon="arrow-down"
        size={28}
        color={colors.text}
        accessibilityLabel="Jump to latest"
        onPress={onPress}
        style={{
          backgroundColor: withAlpha(colors.bg, chipFaceAlpha),
          borderRadius: 8,
          boxShadow: [
            ...elevation(scheme).raised,
            { offsetX: 0, offsetY: 2, blurRadius: 8, color: colors.bg },
          ],
          width: 32,
        }}
      />
    </Animated.View>
  );
};

type PendingInputsProps = Pick<
  ChatController,
  | "capabilities"
  | "draftLoaded"
  | "editInbox"
  | "inbox"
  | "opencodeClient"
  | "pending"
  | "actions"
  | "sessionID"
  | "styles"
>;

export const PendingInputs = ({
  capabilities,
  draftLoaded,
  editInbox,
  inbox,
  opencodeClient,
  pending,
  actions,
  styles,
}: PendingInputsProps) =>
  opencodeClient &&
  capabilities.inbox &&
  inbox.length > 0 && (
    <Card>
      <BodyText muted style={styles.eyebrow}>
        PENDING INPUTS · {inbox.length}
      </BodyText>
      {inbox.map((item) => (
        <View key={item.id} style={{ gap: 8 }}>
          {item.type === "synthetic" ? (
            <Disclosure
              disclosureKey={item.id}
              title={item.payload.description || "Server context"}
            >
              <MessageText text={item.payload.text} />
            </Disclosure>
          ) : (
            <BodyText numberOfLines={3}>{inboxItemText(item)}</BodyText>
          )}
          <Row>
            <BodyText muted>
              {item.delivery === "steer"
                ? "Steer current work"
                : "After current work"}
            </BodyText>
            <Button
              disabled={pending}
              title={item.delivery === "steer" ? "Queue" : "Steer"}
              size="compact"
              onPress={() => {
                void actions.updateInbox({
                  delivery: item.delivery === "steer" ? "queue" : "steer",
                  inboxID: item.id,
                });
              }}
            />
            {(item.type === "user" || item.type === "synthetic") && (
              <Button
                title="Edit"
                size="compact"
                disabled={!draftLoaded || pending}
                onPress={() => {
                  void editInbox(item);
                }}
              />
            )}
            <Button
              title="Cancel"
              size="compact"
              variant="ghost"
              disabled={pending}
              onPress={() => {
                void actions.cancelInbox(item.id);
              }}
            />
          </Row>
        </View>
      ))}
    </Card>
  );

interface TranscriptFooterProps extends Pick<
  ChatController,
  | "activityNotice"
  | "capabilities"
  | "draftLoaded"
  | "editInbox"
  | "forms"
  | "handleChanged"
  | "inbox"
  | "opencodeClient"
  | "pending"
  | "permissions"
  | "actions"
  | "sessionID"
  | "showError"
  | "styles"
> {
  session: SessionInfo;
}

export const TranscriptFooter = ({
  activityNotice,
  capabilities,
  draftLoaded,
  editInbox,
  forms,
  inbox,
  opencodeClient,
  pending,
  permissions,
  actions,
  session,
  sessionID,
  showError,
  styles,
}: TranscriptFooterProps) => (
  <View style={{ gap: 12 }}>
    <PendingInputs
      capabilities={capabilities}
      draftLoaded={draftLoaded}
      editInbox={editInbox}
      inbox={inbox}
      opencodeClient={opencodeClient}
      pending={pending}
      actions={actions}
      sessionID={sessionID}
      styles={styles}
    />
    {opencodeClient && (capabilities.forms || capabilities.permissions) && (
      <SessionForms
        client={opencodeClient}
        sessionID={sessionID}
        forms={forms}
        permissions={permissions}
        onError={showError}
        locationDirectory={session.location.directory}
      />
    )}
    {activityNotice && (
      <Card>
        <BodyText muted>{activityNotice}</BodyText>
      </Card>
    )}
  </View>
);

interface TranscriptListProps extends Pick<
  ChatController,
  | "activityNotice"
  | "beginUserScroll"
  | "capabilities"
  | "contentSizeChanged"
  | "hasNextPage"
  | "disclosures"
  | "draftLoaded"
  | "editInbox"
  | "finishUserScroll"
  | "forms"
  | "handleChanged"
  | "inbox"
  | "jumpToLatest"
  | "list"
  | "listLoaded"
  | "loadOlder"
  | "isFetchingNextPage"
  | "maintainPosition"
  | "opencodeClient"
  | "pending"
  | "permissions"
  | "renderMessage"
  | "actions"
  | "sessionID"
  | "setFollowing"
  | "showError"
  | "showLatestControl"
  | "styles"
  | "transcriptLayoutChanged"
  | "transcriptMessages"
  | "updateScrollPosition"
> {
  session: SessionInfo;
}

export const TranscriptList = ({
  activityNotice,
  beginUserScroll,
  capabilities,
  contentSizeChanged,
  hasNextPage,
  disclosures,
  draftLoaded,
  editInbox,
  finishUserScroll,
  forms,
  handleChanged,
  inbox,
  jumpToLatest,
  list,
  listLoaded,
  loadOlder,
  isFetchingNextPage,
  maintainPosition,
  opencodeClient,
  pending,
  permissions,
  renderMessage,
  actions,
  session,
  sessionID,
  setFollowing,
  showError,
  showLatestControl,
  styles,
  transcriptLayoutChanged,
  transcriptMessages,
  updateScrollPosition,
}: TranscriptListProps) => (
  <MessageDisclosureContext.Provider value={disclosures}>
    <View style={styles.transcriptFrame}>
      <FlashList
        ref={list}
        data={transcriptMessages}
        keyExtractor={messageKey}
        getItemType={messageType}
        renderItem={renderMessage}
        ItemSeparatorComponent={MessageSeparator}
        maintainVisibleContentPosition={maintainPosition}
        style={styles.transcript}
        contentContainerStyle={styles.betaMessages}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onLoad={listLoaded}
        onContentSizeChange={contentSizeChanged}
        onLayout={transcriptLayoutChanged}
        onScroll={updateScrollPosition}
        scrollEventThrottle={16}
        onScrollBeginDrag={beginUserScroll}
        onScrollEndDrag={finishUserScroll}
        onMomentumScrollBegin={beginUserScroll}
        onMomentumScrollEnd={finishUserScroll}
        ListHeaderComponent={
          hasNextPage ? (
            <Button
              title="Load earlier messages"
              variant="ghost"
              size="compact"
              busy={isFetchingNextPage}
              onPress={() => {
                setFollowing(false);
                void loadOlder();
              }}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <Empty
            title="Start something good"
            detail="Ask a question, describe a change, or attach a file from your project."
          />
        }
        ListFooterComponent={
          <TranscriptFooter
            activityNotice={activityNotice}
            capabilities={capabilities}
            draftLoaded={draftLoaded}
            editInbox={editInbox}
            forms={forms}
            handleChanged={handleChanged}
            inbox={inbox}
            opencodeClient={opencodeClient}
            pending={pending}
            permissions={permissions}
            actions={actions}
            sessionID={sessionID}
            showError={showError}
            styles={styles}
            session={session}
          />
        }
      />
      <View pointerEvents="box-none" style={styles.jumpToLatest}>
        <JumpToLatest visible={showLatestControl} onPress={jumpToLatest} />
      </View>
    </View>
  </MessageDisclosureContext.Provider>
);
