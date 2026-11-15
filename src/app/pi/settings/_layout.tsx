import { useMemo } from "react";

import { Busy } from "../../../components/ui";
import { piSettingsSectionPath, routes } from "../../../lib/routes";
import { usePiWorkspace } from "../../../screens/pi-workspace";
import {
  SettingsHostContext,
  SettingsRoutesLayout,
} from "../../../screens/settings-layout";
import type { Section } from "../../../screens/settings/sections";

const sections: Section[] = ["Look and feel", "Models"];

const sectionPath = (section: Section) => piSettingsSectionPath(section);

const PiSettingsLayout = () => {
  const { backend, onBack, onManageServers, session } = usePiWorkspace();
  const directory = session?.location.directory;
  const host = useMemo(
    () =>
      directory === undefined
        ? null
        : {
            backLabel: "Chat",
            directory,
            modelCatalog: backend.core.model,
            onBack,
            onManageServers,
          },
    [backend, directory, onBack, onManageServers]
  );
  if (!host) {
    return <Busy />;
  }

  return (
    <SettingsHostContext.Provider value={host}>
      <SettingsRoutesLayout
        indexPath={routes.piSettings}
        sectionPath={sectionPath}
        sections={sections}
      />
    </SettingsHostContext.Provider>
  );
};

export default PiSettingsLayout;
