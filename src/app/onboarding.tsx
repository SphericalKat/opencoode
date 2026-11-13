import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { useThemedStyles } from "../lib/theme";
import { createStyles } from "./styles";

interface OnboardingProps {
  children: ReactNode;
}

export const Onboarding = ({ children }: OnboardingProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      automaticOffset
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.onboarding, styles.betaOnboarding]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
