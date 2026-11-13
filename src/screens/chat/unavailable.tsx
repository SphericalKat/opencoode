import { View } from "react-native";

import { Busy, ErrorNotice, BodyText } from "../../components/ui";
import { ChatIconButton } from "./controls";
import type { ChatController } from "./use-chat-controller";

type SessionUnavailableProps = Pick<
  ChatController,
  | "betaLayout"
  | "error"
  | "fetchError"
  | "loading"
  | "onOpenNavigation"
  | "projectLabel"
  | "refresh"
  | "styles"
>;

export const SessionUnavailable = ({
  betaLayout,
  error,
  fetchError,
  loading,
  onOpenNavigation,
  projectLabel,
  refresh,
  styles,
}: SessionUnavailableProps) => (
  <View style={styles.container}>
    {!betaLayout && (
      <View style={styles.header}>
        {onOpenNavigation && (
          <View style={styles.headerLeading}>
            <ChatIconButton
              name="menu"
              label="Open navigation"
              onPress={onOpenNavigation}
            />
          </View>
        )}
        <View
          style={[
            styles.headerTitle,
            onOpenNavigation && styles.headerTitleWithNavigation,
          ]}
        >
          <BodyText numberOfLines={1} style={styles.sessionTitle}>
            {loading ? "Loading session" : "Session unavailable"}
          </BodyText>
          <BodyText numberOfLines={1} muted style={styles.projectLabel}>
            {projectLabel || "OpenCode"}
          </BodyText>
        </View>
      </View>
    )}
    {loading ? (
      <Busy />
    ) : (
      <View style={{ padding: 16 }}>
        <ErrorNotice
          error={error || fetchError || "The session is unavailable"}
          onRetry={() => {
            void refresh();
          }}
        />
      </View>
    )}
  </View>
);
