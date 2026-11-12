import type { SessionInfo } from "@opencode/client";
import { View } from "react-native";

import {
  Button,
  confirmAction,
  ErrorNotice,
  BodyText,
  Row,
} from "../../components/ui";
import type { ChatController } from "./use-chat-controller";

export const ErrorBanners = ({ chat }: { chat: ChatController }) => {
  const {
    catalogError,
    error,
    fetchError,
    refresh,
    setCatalogRevision,
    setError,
    styles,
    syncErrors,
  } = chat;
  return (
    <>
      {error && (
        <View style={styles.errorBanner}>
          <ErrorNotice error={error} />
          <Button
            title="Dismiss"
            compact
            variant="ghost"
            onPress={() => setError(null)}
          />
        </View>
      )}
      {(fetchError || catalogError || Object.values(syncErrors)[0]) && (
        <View style={styles.errorBanner}>
          <ErrorNotice
            error={fetchError || catalogError || Object.values(syncErrors)[0]}
            onRetry={() => {
              setCatalogRevision((value) => value + 1);
              void refresh();
            }}
          />
        </View>
      )}
    </>
  );
};

export const RevertBanner = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    historyEpochRef,
    liveMessagesRef,
    opencodeClient,
    pending,
    run,
    sessionID,
    styles,
  } = chat;
  return (
    opencodeClient &&
    session.revert && (
      <View style={styles.revert}>
        <BodyText>A revert is staged</BodyText>
        <BodyText muted>Later messages are excluded from the context.</BodyText>
        <Row>
          <Button
            title="Restore"
            compact
            onPress={() => {
              void run(() =>
                opencodeClient.session.revert.clear({ sessionID })
              );
            }}
          />
          <Button
            title="Commit revert"
            compact
            variant="danger"
            disabled={pending}
            onPress={() => {
              void run(async () => {
                if (
                  await confirmAction(
                    "Commit this revert?",
                    "This permanently removes messages after the revert point."
                  )
                ) {
                  await opencodeClient.session.revert.commit({ sessionID });
                  historyEpochRef.current += 1;
                  liveMessagesRef.current.clear();
                }
              });
            }}
          />
        </Row>
      </View>
    )
  );
};
