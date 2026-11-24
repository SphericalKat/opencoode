import { View } from "react-native";

import { AdvancedSettings } from "../../components/advanced-settings";
import type { Client } from "../../lib/client";
import { About } from "./about";
import { Accounts } from "./accounts";
import { AppearanceSettings } from "./appearance-settings";
import { Configuration } from "./configuration";
import { Mcp } from "./mcp";
import { Models } from "./models";
import { Permissions } from "./permissions";
import { Plugins } from "./plugins";
import type { Section, ModelCatalog } from "./sections";
import { Skills } from "./skills";

export const SettingsSection = ({
  client,
  modelCatalog,
  directory,
  section,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  section: Section;
}) => {
  if (section === "Look and feel") {
    return (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <AppearanceSettings />
      </View>
    );
  }
  if (section === "About") {
    return (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <About />
      </View>
    );
  }
  if (section === "Models") {
    return modelCatalog ? (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <Models catalog={modelCatalog} client={client} directory={directory} />
      </View>
    ) : null;
  }
  if (!client) {
    return null;
  }
  return (
    <View key={`${directory}:${section}`} style={{ flex: 1 }}>
      {section === "Accounts" && (
        <Accounts client={client} directory={directory} />
      )}
      {section === "MCP" && <Mcp client={client} directory={directory} />}
      {section === "Config" && (
        <Configuration client={client} directory={directory} />
      )}
      {section === "Skills" && <Skills client={client} directory={directory} />}
      {section === "Plugins" && (
        <Plugins client={client} directory={directory} />
      )}
      {section === "Permissions" && (
        <Permissions client={client} directory={directory} />
      )}
      {section === "Advanced" && (
        <AdvancedSettings client={client} directory={directory} />
      )}
    </View>
  );
};
