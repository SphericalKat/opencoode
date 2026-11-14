import type { SessionMessageInfo } from "@opencode/client";
import { useState } from "react";

import type { Panel } from "./types";

export const useSheetState = () => {
  const [panel, setPanel] = useState<Panel>(null);
  const [backgroundShellID, setBackgroundShellID] = useState<string>();
  const [backgroundDirectory, setBackgroundDirectory] = useState<string>();
  const [sideQuestion, setSideQuestion] = useState<string>();
  const [textSelectionMessage, setTextSelectionMessage] =
    useState<SessionMessageInfo | null>(null);
  return {
    backgroundDirectory,
    backgroundShellID,
    panel,
    setBackgroundDirectory,
    setBackgroundShellID,
    setPanel,
    setSideQuestion,
    setTextSelectionMessage,
    sideQuestion,
    textSelectionMessage,
  };
};
