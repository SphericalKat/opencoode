import { useRef, useState } from "react";

import type { Panel } from "./types";

export const useSheetState = () => {
  const [panel, setPanel] = useState<Panel>(null);
  const [backgroundShellID, setBackgroundShellID] = useState<string>();
  const [backgroundDirectory, setBackgroundDirectory] = useState<string>();
  const [sideQuestion, setSideQuestion] = useState<string>();
  const queuedMessagePanelRef = useRef<"selectText" | "background" | null>(
    null
  );
  return {
    backgroundDirectory,
    backgroundShellID,
    panel,
    queuedMessagePanelRef,
    setBackgroundDirectory,
    setBackgroundShellID,
    setPanel,
    setSideQuestion,
    sideQuestion,
  };
};
