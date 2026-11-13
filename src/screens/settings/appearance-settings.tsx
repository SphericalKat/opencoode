import { useState } from "react";
import { ActivityIndicator, Pressable, Switch, View } from "react-native";

import { ShellIcon } from "../../components/shell-icon";
import { ErrorNotice, BodyText, Sheet } from "../../components/ui";
import { errorMessage } from "../../lib/client";
import {
  playHaptic,
  setHapticsEnabled,
  useHapticsEnabled,
} from "../../lib/haptics";
import { paletteOptions, useTheme, useThemedStyles } from "../../lib/theme";
import type { Appearance } from "../../lib/theme";
import { Page } from "./shared";
import { createStyles } from "./styles";

const HapticsSetting = ({
  onError,
}: {
  onError: (message: string | null) => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const enabled = useHapticsEnabled();
  return (
    <View style={styles.betaAppearanceCard}>
      <View style={styles.detail}>
        <BodyText style={styles.betaSettingTitle}>Haptic feedback</BodyText>
        <BodyText muted style={styles.betaDescription}>
          Feel responses stream in, and feel taps, selections and results.
        </BodyText>
      </View>
      <Switch
        accessibilityLabel="Haptic feedback"
        value={enabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        onValueChange={(next) => {
          onError(null);
          void setHapticsEnabled(next)
            .then(() => {
              playHaptic("select");
              return null;
            })
            .catch((error_) => onError(errorMessage(error_)));
        }}
      />
    </View>
  );
};

const appearanceLabel = (value: Appearance) => {
  if (value === "system") {
    return "System";
  }
  return value === "light" ? "Light" : "Dark";
};

export const AppearanceSettings = () => {
  const { appearance, setAppearance, palette, setPalette, colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [choosingPalette, setChoosingPalette] = useState(false);
  const paletteLabel =
    paletteOptions.find((option) => option.id === palette)?.name ?? "OpenCoode";
  const palettePicker = (
    <>
      <View style={styles.betaAppearanceCard}>
        <View style={styles.detail}>
          <BodyText style={styles.betaSettingTitle}>Palette</BodyText>
          <BodyText muted style={styles.betaDescription}>
            Choose the app colors.
          </BodyText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Palette: ${paletteLabel}`}
          accessibilityState={{ disabled: busy, expanded: choosingPalette }}
          disabled={busy}
          onPress={() => setChoosingPalette(true)}
          style={styles.betaChooserTarget}
        >
          <View style={styles.betaSettingChooser}>
            <BodyText style={styles.betaBackLabel}>{paletteLabel}</BodyText>
            <View style={{ transform: [{ rotate: "90deg" }] }}>
              <ShellIcon name="chevron" size={12} color={colors.text} />
            </View>
          </View>
        </Pressable>
      </View>
      <Sheet
        visible={choosingPalette}
        title="Palette"
        fitContent
        contentStyle={{ gap: 0 }}
        onClose={() => {
          if (!busy) {
            setChoosingPalette(false);
          }
        }}
      >
        <ErrorNotice error={error} />
        {paletteOptions.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.name}
            accessibilityState={{
              disabled: busy,
              selected: palette === option.id,
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.betaCategoryRow,
              pressed && { backgroundColor: colors.raised },
            ]}
            onPress={() => {
              setBusy(true);
              setError(null);
              void setPalette(option.id)
                .then(() => setChoosingPalette(false))
                .catch((error_) => setError(errorMessage(error_)))
                .finally(() => setBusy(false));
            }}
          >
            <BodyText style={[styles.betaBackLabel, styles.detail]}>
              {option.name}
            </BodyText>
            {palette === option.id && (
              <BodyText accessibilityElementsHidden>✓</BodyText>
            )}
          </Pressable>
        ))}
      </Sheet>
    </>
  );
  const choiceLabel = appearanceLabel(appearance);
  return (
    <Page error={error}>
      <View style={styles.betaAppearanceCard}>
        <View style={styles.detail}>
          <BodyText style={styles.betaSettingTitle}>Color scheme</BodyText>
          <BodyText muted style={styles.betaDescription}>
            Choose the color scheme for the app.
          </BodyText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Color scheme: ${choiceLabel}`}
          accessibilityState={{ disabled: busy, expanded: choosing }}
          disabled={busy}
          onPress={() => setChoosing(true)}
          style={styles.betaChooserTarget}
        >
          <View style={styles.betaSettingChooser}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <BodyText style={styles.betaBackLabel}>{choiceLabel}</BodyText>
            )}
            <View style={{ transform: [{ rotate: "90deg" }] }}>
              <ShellIcon name="chevron" size={12} color={colors.text} />
            </View>
          </View>
        </Pressable>
      </View>
      {palettePicker}
      <HapticsSetting onError={setError} />
      <Sheet
        visible={choosing}
        title="Color scheme"
        fitContent
        contentStyle={{ gap: 0 }}
        onClose={() => {
          if (!busy) {
            setChoosing(false);
          }
        }}
      >
        <ErrorNotice error={error} />
        {(["system", "light", "dark"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={appearanceLabel(value)}
            accessibilityState={{
              disabled: busy,
              selected: appearance === value,
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.betaCategoryRow,
              pressed && { backgroundColor: colors.raised },
            ]}
            onPress={() => {
              setBusy(true);
              setError(null);
              void setAppearance(value)
                .then(() => setChoosing(false))
                .catch((error_) => setError(errorMessage(error_)))
                .finally(() => setBusy(false));
            }}
          >
            <BodyText style={[styles.betaBackLabel, styles.detail]}>
              {appearanceLabel(value)}
            </BodyText>
            {appearance === value && (
              <BodyText accessibilityElementsHidden>✓</BodyText>
            )}
          </Pressable>
        ))}
      </Sheet>
    </Page>
  );
};
