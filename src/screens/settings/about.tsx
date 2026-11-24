import { useState } from "react";

import appConfig from "../../../app.json";
import { SheetGroup } from "../../components/list-sheet";
import { BodyText, Button } from "../../components/ui";
import {
  ISSUES_URL,
  openExternalUrl,
  PRIVACY_POLICY_URL,
  REPOSITORY_URL,
} from "../../lib/privacy";
import { SettingsRow } from "./settings-list";
import { Page } from "./shared";

export const About = () => {
  const [error, setError] = useState<string | null>(null);

  const openUrl = (url: string) => {
    setError(null);
    openExternalUrl(url, setError);
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
            onPress={() => openUrl(PRIVACY_POLICY_URL)}
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
