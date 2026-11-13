import { Platform, Pressable, View } from "react-native";

import {
  BodyText,
  Button,
  Card,
  ErrorNotice,
  Field,
  Sheet,
} from "../../components/ui";
import { useThemedStyles } from "../../lib/theme";
import { actionsTitle } from "./format";
import { createStyles } from "./styles";

export type ActionsMode = "menu" | "filter" | "create";

const historyOptions = [
  { title: "Recent sessions", value: false },
  { title: "Archived sessions", value: true },
];

const HistoryOptions = ({
  archived,
  onSelect,
}: {
  archived: boolean;
  onSelect: (archived: boolean) => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityRole="radiogroup">
      {historyOptions.map((item) => (
        <Pressable
          key={item.title}
          accessibilityRole="radio"
          accessibilityState={{ checked: archived === item.value }}
          aria-checked={archived === item.value}
          onPress={() => onSelect(item.value)}
          style={styles.menuRow}
        >
          <BodyText>{item.title}</BodyText>
          <BodyText muted>{archived === item.value ? "✓" : ""}</BodyText>
        </Pressable>
      ))}
    </View>
  );
};

interface MenuActionProps {
  disabled: boolean;
  onPress: () => void;
  title: string;
}

const MenuAction = ({ disabled, onPress, title }: MenuActionProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <BodyText>{title}</BodyText>
    </Pressable>
  );
};

interface ActionsSheetProps {
  archived: boolean;
  busy: boolean;
  creating: boolean;
  creationDirectory: string;
  displayed: ActionsMode;
  loading: boolean;
  onClose: () => void;
  onCreate: () => void;
  onDismiss: () => void;
  onImport: () => void;
  onOpenCreate: () => void;
  onRefresh: () => void;
  onSelectHistory: (archived: boolean) => void;
  onTitleChange: (title: string) => void;
  sheetError: string | undefined;
  title: string;
  visible: boolean;
}

const CreateSessionForm = ({
  creating,
  creationDirectory,
  onCreate,
  onTitleChange,
  sheetError,
  title,
}: Pick<
  ActionsSheetProps,
  | "creating"
  | "creationDirectory"
  | "onCreate"
  | "onTitleChange"
  | "sheetError"
  | "title"
>) => (
  <>
    <Field
      label="Session title"
      placeholder="What do you want to work on?"
      value={title}
      onChangeText={onTitleChange}
      editable={!creating}
    />
    <BodyText muted>
      You can choose a model and agent in the conversation.
    </BodyText>
    <Card>
      <BodyText muted>Remote directory</BodyText>
      <BodyText selectable>{creationDirectory}</BodyText>
    </Card>
    <ErrorNotice error={sheetError} />
    <Button
      title="Create session"
      variant="primary"
      busy={creating}
      onPress={onCreate}
    />
  </>
);

const ActionsMenu = ({
  busy,
  loading,
  onImport,
  onOpenCreate,
  onRefresh,
}: Pick<
  ActionsSheetProps,
  "busy" | "loading" | "onImport" | "onOpenCreate" | "onRefresh"
>) => (
  <>
    <MenuAction
      disabled={loading}
      onPress={onRefresh}
      title="Refresh sessions"
    />
    <MenuAction
      disabled={busy}
      onPress={onOpenCreate}
      title="Create a named session"
    />
    <MenuAction
      disabled={busy}
      onPress={onImport}
      title="Import session JSON"
    />
  </>
);

export const ActionsSheet = ({
  archived,
  busy,
  creating,
  creationDirectory,
  displayed,
  loading,
  onClose,
  onCreate,
  onDismiss,
  onImport,
  onOpenCreate,
  onRefresh,
  onSelectHistory,
  onTitleChange,
  sheetError,
  title,
  visible,
}: ActionsSheetProps) => (
  <Sheet
    visible={visible}
    fitContent={Platform.OS === "android"}
    title={actionsTitle(displayed)}
    onClose={onClose}
    onDismiss={onDismiss}
  >
    {displayed === "create" ? (
      <CreateSessionForm
        creating={creating}
        creationDirectory={creationDirectory}
        onCreate={onCreate}
        onTitleChange={onTitleChange}
        sheetError={sheetError}
        title={title}
      />
    ) : (
      <View>
        <HistoryOptions archived={archived} onSelect={onSelectHistory} />
        {displayed === "menu" && (
          <ActionsMenu
            busy={busy}
            loading={loading}
            onImport={onImport}
            onOpenCreate={onOpenCreate}
            onRefresh={onRefresh}
          />
        )}
      </View>
    )}
  </Sheet>
);
