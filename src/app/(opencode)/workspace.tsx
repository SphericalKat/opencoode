import { useLocalSearchParams } from "expo-router";

import { WorkspaceTab } from "../../shell/tabs";

export default function WorkspaceRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <WorkspaceTab section={section} />;
}
