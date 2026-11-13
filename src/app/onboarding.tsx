import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { OpenCodeLogo } from "../components/open-code-logo";
import { BodyText } from "../components/ui";
import { useThemedStyles } from "../lib/theme";
import { createStyles } from "./styles";

interface OnboardingProps {
  betaLayout: boolean;
  children: ReactNode;
}

export const Onboarding = ({ betaLayout, children }: OnboardingProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      automaticOffset
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.onboarding,
          betaLayout && styles.betaOnboarding,
        ]}
      >
        {!betaLayout && (
          <View style={styles.onboardingBrand}>
            <OpenCodeLogo width={180} />
            <BodyText muted>Mobile client</BodyText>
          </View>
        )}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
