import { ActionSheetIOS, Alert, Platform } from "react-native";

export const promptHistoryChoice = (
  scheme: string,
  onChoose: (archived: boolean) => void
): Promise<void> => {
  const { promise, resolve: finish } = Promise.withResolvers<undefined>();
  const resolve = () => finish(undefined);
  const choose = (value: boolean) => {
    onChoose(value);
    resolve();
  };
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        cancelButtonIndex: 2,
        options: ["Recent sessions", "Archived sessions", "Cancel"],
        title: "Session history",
        userInterfaceStyle: scheme === "dark" ? "dark" : "light",
      },
      (index) => {
        if (index < 2) {
          choose(index === 1);
        } else {
          resolve();
        }
      }
    );
  } else {
    Alert.alert(
      "Session history",
      undefined,
      [
        { onPress: () => choose(false), text: "Recent sessions" },
        { onPress: () => choose(true), text: "Archived sessions" },
        { onPress: () => resolve(), style: "cancel", text: "Cancel" },
      ],
      { cancelable: true, onDismiss: () => resolve() }
    );
  }
  return promise;
};
