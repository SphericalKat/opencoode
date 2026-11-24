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
  | "retryCatalog"
  | "setError"
  | "styles"
>;

export const ErrorBanners = ({
  catalogError,
  error,
  fetchError,
  refresh,
  retryCatalog,
  setError,
  styles,
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
    {(fetchError || catalogError) && (
      <View style={styles.errorBanner}>
        <ErrorNotice
          error={fetchError || catalogError}
          onRetry={() => {
            retryCatalog();
            void refresh();
          }}
        />
      </View>
    )}
  </>
);

interface RevertBannerProps extends Pick<
  ChatController,
  "opencodeClient" | "pending" | "actions" | "sessionID" | "styles"
> {
  session: SessionInfo;
}

export const RevertBanner = ({
  opencodeClient,
  pending,
  actions,
  session,
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
            void actions.clearRevert();
          }}
        />
        <Button
          title="Commit revert"
          size="compact"
          variant="danger"
          disabled={pending}
          onPress={() => {
            void (async () => {
              if (
                await confirmAction(
                  "Commit this revert?",
                  "This permanently removes messages after the revert point.",
                  { confirmLabel: "Commit revert" }
                )
              ) {
                await actions.commitRevert();
              }
            })();
          }}
        />
      </Row>
    </View>
  );
