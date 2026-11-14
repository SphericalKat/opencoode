import React, { createContext, useContext } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../lib/theme";
import {
  isCredentialError,
  isInterruptedError,
  splitErrorTitle,
  unwrapErrorMessage,
} from "../lib/transcript";
import { ShellIcon } from "./shell-icon";
import { Button, sans } from "./ui";

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginLeft: 24,
    marginTop: 8,
  },
  body: { flex: 1, gap: 8, minWidth: 0 },
  icon: { marginTop: 1 },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  text: {
    fontFamily: sans,
    fontSize: 13,
    letterSpacing: -0.04,
    lineHeight: 18,
  },
  title: { fontWeight: "500" },
});

export const SessionErrorNotice = ({
  message,
  provider,
  actions,
  selectable,
  children,
}: {
  message: string;
  provider?: string;
  actions?: React.ReactNode;
  selectable?: boolean;
  children?: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const { title, detail } = splitErrorTitle(unwrapErrorMessage(message));
  return (
    <View>
      <View accessibilityRole="alert" style={styles.row}>
        <View style={styles.icon}>
          <ShellIcon name="warning" size={16} color={colors.danger} />
        </View>
        <View style={styles.body}>
          <Text
            selectable={selectable}
            style={[styles.text, { color: colors.text }]}
          >
            {provider !== undefined && (
              <Text style={styles.title}>{`${provider}: `}</Text>
            )}
            {title !== undefined && <Text style={styles.title}>{title}</Text>}
            {detail}
          </Text>
          {children}
        </View>
      </View>
      {actions !== undefined && <View style={styles.actions}>{actions}</View>}
    </View>
  );
};

export interface AssistantErrorContextValue {
  providerName?: string;
  errorActions?: { onChangeModel: () => void; onOpenAccounts?: () => void };
}

export const AssistantErrorContext = createContext<AssistantErrorContextValue>(
  {}
);

export const AssistantErrorNotice = ({
  error,
  selectable,
}: {
  error: { type: string; message: string };
  selectable?: boolean;
}) => {
  const { providerName, errorActions } = useContext(AssistantErrorContext);
  const failed = !isInterruptedError(error);
  return (
    <SessionErrorNotice
      message={error.message}
      provider={providerName}
      selectable={selectable}
      actions={
        errorActions && failed ? (
          <>
            <Button
              title="Change model"
              size="small"
              variant="secondary"
              onPress={() => errorActions.onChangeModel()}
            />
            {errorActions.onOpenAccounts && isCredentialError(error) && (
              <Button
                title="Open Accounts"
                size="small"
                variant="secondary"
                onPress={() => errorActions.onOpenAccounts?.()}
              />
            )}
          </>
        ) : undefined
      }
    />
  );
};
