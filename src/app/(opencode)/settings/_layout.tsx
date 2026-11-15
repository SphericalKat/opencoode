import { routes, settingsSectionPath } from "../../../lib/routes";
import { SettingsRoutesLayout } from "../../../screens/settings-layout";
import { allSections } from "../../../screens/settings/sections";
import type { Section } from "../../../screens/settings/sections";

const sectionPath = (section: Section) => settingsSectionPath(section);

const SettingsLayoutRoute = () => (
  <SettingsRoutesLayout
    indexPath={routes.settings}
    sectionPath={sectionPath}
    sections={allSections}
  />
);

export default SettingsLayoutRoute;
