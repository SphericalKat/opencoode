import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OpenCodeLogo } from "../components/open-code-logo";
import { BodyText, Busy } from "../components/ui";
import { useThemedStyles } from "../lib/theme";
import { createStyles } from "../shell/styles";

const Restoring = () => {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.boot}>
        <OpenCodeLogo width={160} />
        <Busy />
        <BodyText muted>Restoring your workspace</BodyText>
      </View>
    </SafeAreaView>
  );
};

export default Restoring;
