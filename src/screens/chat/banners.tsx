import type { SessionInfo } from "@opencode/client";
import { View } from "react-native";

import { confirmAction } from "../../components/dialog";
import { Button, ErrorNotice, BodyText, Row } from "../../components/ui";
import type { ChatController } from "./use-chat-controller";

type ErrorBannersProps = Pick<
  ChatController,
  | "catalogError"
  | "error"
  | "fetchError"
  | "refresh"
  | "setCatalogRevision"
  | "setError"
  | "styles"
  | "syncErrors"
>;

export const ErrorBanners = ({
  catalogError,
  error,
  fetchError,
  refresh,
  setCatalogRevision,
  setError,
  styles,
  syncErrors,
}: ErrorBannersProps) => (
  <>
    {error && (
      <View style={styles.errorBanner}>
        <ErrorNotice error={error} />
        <Button
          title="Dismiss"
          size="compact"
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

interface RevertBannerProps extends Pick<
  ChatController,
  | "historyEpochRef"
  | "liveMessagesRef"
  | "opencodeClient"
  | "pending"
  | "run"
  | "sessionID"
  | "styles"
> {
  session: SessionInfo;
}

export const RevertBanner = ({
  historyEpochRef,
  liveMessagesRef,
  opencodeClient,
  pending,
  run,
  session,
  sessionID,
  styles,
}: RevertBannerProps) =>
  opencodeClient &&
  session.revert && (
    <View style={styles.revert}>
      <BodyText>A revert is staged</BodyText>
      <BodyText muted>
        The next message replaces the hidden messages. Restore brings them back.
      </BodyText>
      <Row>
        <Button
          title="Restore"
          size="compact"
          onPress={() => {
            void run(() => opencodeClient.session.revert.clear({ sessionID }));
          }}
        />
        <Button
          title="Commit revert"
          size="compact"
          variant="danger"
          disabled={pending}
          onPress={() => {
            void run(async () => {
              if (
                await confirmAction(
                  "Commit this revert?",
                  "This permanently removes messages after the revert point.",
                  { confirmLabel: "Commit revert" }
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
  );
