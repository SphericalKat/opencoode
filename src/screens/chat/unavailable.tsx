import { View } from "react-native";

import { Busy, ErrorNotice } from "../../components/ui";
import type { ChatController } from "./use-chat-controller";

type SessionUnavailableProps = Pick<
  ChatController,
  "error" | "fetchError" | "loading" | "refresh" | "styles"
>;

export const SessionUnavailable = ({
  error,
  fetchError,
  loading,
  refresh,
  styles,
}: SessionUnavailableProps) => (
  <View style={styles.container}>
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
