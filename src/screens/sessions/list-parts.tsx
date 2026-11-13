import { View } from "react-native";

import { BodyText, Busy, Button, Empty } from "../../components/ui";
import { useThemedStyles } from "../../lib/theme";
import { emptyDetail, emptyTitle } from "./format";
import { NewSessionPill } from "./new-session-buttons";
import { createStyles } from "./styles";

export const BetaGroupHeader = ({
  busy,
  creating,
  label,
  onStartSession,
}: {
  busy: boolean;
  creating: boolean;
  label: string;
  onStartSession: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.betaGroupHeader}>
      <BodyText accessibilityRole="header" muted style={styles.betaGroupLabel}>
        {label}
      </BodyText>
      <NewSessionPill
        busy={busy}
        creating={creating}
        onPress={onStartSession}
      />
    </View>
  );
};

export const SessionsEmpty = ({
  archived,
  listUnavailable,
  loading,
  search,
}: {
  archived: boolean;
  listUnavailable: boolean;
  loading: boolean;
  search: string;
}) => {
  if (loading) {
    return <Busy />;
  }
  return (
    <Empty
      title={emptyTitle(listUnavailable, search, archived)}
      detail={emptyDetail(listUnavailable, search, archived)}
    />
  );
};

interface SessionsFooterProps {
  loadMore: () => void;
  loading: boolean;
}

export const SessionsFooter = ({ loadMore, loading }: SessionsFooterProps) => {
  if (loading) {
    return <Busy />;
  }
  return <Button title="Load more" variant="ghost" onPress={loadMore} />;
};
