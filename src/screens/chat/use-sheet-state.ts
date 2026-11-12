import { useRef, useState } from "react";

import type { Panel } from "./types";

export const useSheetState = () => {
  const [panel, setPanel] = useState<Panel>(null);
  const [backgroundShellID, setBackgroundShellID] = useState<string>();
  const [backgroundDirectory, setBackgroundDirectory] = useState<string>();
  const [sideQuestion, setSideQuestion] = useState<string>();
  const [title, setTitle] = useState("");
  const [moveDirectory, setMoveDirectory] = useState("");
  const queuedMessagePanelRef = useRef<"selectText" | "background" | null>(
    null
  );
  return {
    backgroundDirectory,
    backgroundShellID,
    moveDirectory,
    panel,
    queuedMessagePanelRef,
    setBackgroundDirectory,
    setBackgroundShellID,
    setMoveDirectory,
    setPanel,
    setSideQuestion,
    setTitle,
    sideQuestion,
    title,
  };
};
