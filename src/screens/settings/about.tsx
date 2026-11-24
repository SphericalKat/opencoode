import { useState } from "react";
import { Linking } from "react-native";

import appConfig from "../../../app.json";
import { SheetGroup } from "../../components/list-sheet";
import { BodyText, Button } from "../../components/ui";
import { errorMessage } from "../../lib/client";
import { openPrivacyPolicy } from "../../lib/privacy";
import { SettingsRow } from "./settings-list";
import { Page } from "./shared";

const REPOSITORY_URL = "https://github.com/SphericalKat/opencoode";
const ISSUES_URL = "https://github.com/SphericalKat/opencoode/issues";

export const About = () => {
  const [error, setError] = useState<string | null>(null);

  const openUrl = (url: string) => {
    setError(null);
    void Linking.openURL(url).catch((error_) => setError(errorMessage(error_)));
  };

  return (
    <Page error={error}>
      <SheetGroup variant="grouped">
        <SettingsRow title="Version" description="Current Opencoode release.">
          <BodyText muted>{appConfig.expo.version}</BodyText>
        </SettingsRow>
        <SettingsRow
          title="License"
          description="Open-source software by SphericalKat."
        >
          <BodyText muted>MIT</BodyText>
        </SettingsRow>
      </SheetGroup>
      <SheetGroup variant="grouped">
        <SettingsRow
          title="Privacy Policy"
          description="Read how Opencoode handles permissions and local data."
        >
          <Button
            title="Open"
            size="compact"
            accessibilityLabel="Open Privacy Policy"
            onPress={() => {
              setError(null);
              void openPrivacyPolicy().catch((error_) =>
                setError(errorMessage(error_))
              );
            }}
          />
        </SettingsRow>
        <SettingsRow
          title="Source code"
          description="View the repository on GitHub."
        >
          <Button
            title="GitHub"
            size="compact"
            accessibilityLabel="Open GitHub repository"
            onPress={() => openUrl(REPOSITORY_URL)}
          />
        </SettingsRow>
        <SettingsRow
          title="Support"
          description="Report bugs or contact opencoode@kat.bio."
        >
          <Button
            title="Issues"
            size="compact"
            accessibilityLabel="Open GitHub issues"
            onPress={() => openUrl(ISSUES_URL)}
          />
        </SettingsRow>
      </SheetGroup>
    </Page>
  );
};
