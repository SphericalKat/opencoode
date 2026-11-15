import { useLocalSearchParams } from "expo-router";

import { SettingsRouteScreen } from "../../../screens/settings-layout";

const SettingsSectionRoute = () => {
  const { section } = useLocalSearchParams<{ section: string }>();
  return <SettingsRouteScreen section={section} />;
};

export default SettingsSectionRoute;
