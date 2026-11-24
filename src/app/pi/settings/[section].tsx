import { useLocalSearchParams } from "expo-router";

import { SettingsRouteScreen } from "../../../screens/settings-layout";

const PiSettingsSection = () => {
  const { section } = useLocalSearchParams<{ section: string }>();
  return <SettingsRouteScreen section={section} />;
};

export default PiSettingsSection;
