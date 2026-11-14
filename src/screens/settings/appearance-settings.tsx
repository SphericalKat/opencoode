import { useState } from "react";

import { SheetGroup } from "../../components/list-sheet";
import { SelectMenu } from "../../components/select";
import { Switch } from "../../components/switch";
import { errorMessage } from "../../lib/client";
import {
  playHaptic,
  setHapticsEnabled,
  useHapticsEnabled,
} from "../../lib/haptics";
import { paletteOptions, useTheme } from "../../lib/theme";
import type { Appearance } from "../../lib/theme";
import { SettingsRow } from "./settings-list";
import { Page } from "./shared";

const MENU_MAX_HEIGHT = 192;

const appearanceOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: Appearance; label: string }[];

const paletteMenuOptions = paletteOptions.map((option) => ({
  value: option.id,
  label: option.name,
}));

const HapticsSwitch = ({
  onError,
}: {
  onError: (message: string | null) => void;
}) => {
  const enabled = useHapticsEnabled();
  return (
    <Switch
      accessibilityLabel="Haptic feedback"
      value={enabled}
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
  );
};

export const AppearanceSettings = () => {
  const { appearance, setAppearance, palette, setPalette } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = (apply: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    return apply()
      .finally(() => setBusy(false))
      .catch((error_) => setError(errorMessage(error_)));
  };
  return (
    <Page error={error}>
      <SheetGroup variant="grouped">
        <SettingsRow
          title="Color scheme"
          description="Choose the color scheme for the app."
        >
          <SelectMenu
            accessibilityLabel="Color scheme"
            appearance="inline"
            placement="bottom-end"
            maxHeight={MENU_MAX_HEIGHT}
            busy={busy}
            value={appearance}
            options={appearanceOptions}
            onSelect={(id) => save(() => setAppearance(id))}
          />
        </SettingsRow>
        <SettingsRow title="Palette" description="Choose the app colors.">
          <SelectMenu
            accessibilityLabel="Palette"
            appearance="inline"
            placement="bottom-end"
            maxHeight={MENU_MAX_HEIGHT}
            disabled={busy}
            value={palette}
            options={paletteMenuOptions}
            onSelect={(id) => save(() => setPalette(id))}
          />
        </SettingsRow>
        <SettingsRow
          title="Haptic feedback"
          description="Feel responses stream in, and feel taps, selections and results."
        >
          <HapticsSwitch onError={setError} />
        </SettingsRow>
      </SheetGroup>
    </Page>
  );
};
