import type { SessionInfo } from "@opencode/client";
import { FlashList } from "@shopify/flash-list";
import { Platform, View } from "react-native";

import type { TranscriptItem } from "../../components/assistant-turn";
import { SessionForms } from "../../components/session-forms";
import {
  Button,
  Card,
  Disclosure,
  Empty,
  BodyText,
  Row,
} from "../../components/ui";
import { MessageDisclosureContext } from "../../lib/message-actions";
import { ChatIconButton, MessageText } from "./controls";
import { inboxItemText } from "./labels";
import type { ChatController } from "./use-chat-controller";

const messageKey = (item: TranscriptItem) => item.id;
const messageType = (item: TranscriptItem) =>
  item.type === "message" ? item.message.type : item.type;
const MessageSeparator = () => <View style={{ height: 24 }} />;

export const PendingInputs = ({ chat }: { chat: ChatController }) => {
  const {
    capabilities,
    draftLoaded,
    editInbox,
    inbox,
    opencodeClient,
    pending,
    run,
    sessionID,
    styles,
  } = chat;
  return (
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
                compact
                onPress={() => {
                  void run(() =>
                    opencodeClient.session.inbox.update({
                      delivery: item.delivery === "steer" ? "queue" : "steer",
                      inboxID: item.id,
                      sessionID,
                    })
                  );
                }}
              />
              {(item.type === "user" || item.type === "synthetic") && (
                <Button
                  title="Edit"
                  compact
                  disabled={!draftLoaded || pending}
                  onPress={() => {
                    void editInbox(item);
                  }}
                />
              )}
              <Button
                title="Cancel"
                compact
                variant="ghost"
                disabled={pending}
                onPress={() => {
                  void run(() =>
                    opencodeClient.session.inbox.cancel({
                      inboxID: item.id,
                      sessionID,
                    })
                  );
                }}
              />
            </Row>
          </View>
        ))}
      </Card>
    )
  );
};

export const TranscriptFooter = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    activityNotice,
    capabilities,
    forms,
    handleChanged,
    opencodeClient,
    permissions,
    sessionID,
    showError,
  } = chat;
  return (
    <View style={{ gap: 12 }}>
      <PendingInputs chat={chat} />
      {opencodeClient && (capabilities.forms || capabilities.permissions) && (
        <SessionForms
          client={opencodeClient}
          sessionID={sessionID}
          forms={forms}
          permissions={permissions}
          onChanged={handleChanged}
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
};

export const TranscriptList = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    beginUserScroll,
    betaLayout,
    contentSizeChanged,
    cursor,
    disclosures,
    finishUserScroll,
    jumpToLatest,
    list,
    listLoaded,
    loadOlder,
    loadingOlder,
    maintainPosition,
    renderMessage,
    setFollowing,
    showLatestControl,
    styles,
    transcriptLayoutChanged,
    transcriptMessages,
    updateScrollPosition,
  } = chat;
  return (
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
          contentContainerStyle={
            betaLayout ? styles.betaMessages : styles.messages
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
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
            cursor ? (
              <Button
                title="Load earlier messages"
                variant="ghost"
                compact
                busy={loadingOlder}
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
            <TranscriptFooter chat={chat} session={session} />
          }
        />
        {betaLayout && showLatestControl && (
          <View style={styles.betaLatestOverlay}>
            <ChatIconButton
              name="down"
              label="Jump to latest"
              raised
              onPress={jumpToLatest}
            />
          </View>
        )}
      </View>
    </MessageDisclosureContext.Provider>
  );
};
