import { useEffect, useState } from "react";

import { useTheme } from "./theme";

// An Android Modal copies the activity's status bar icon style once, when it
// opens, and the status bar module does not update it afterwards. Use the
// returned value as the Modal key so a theme change opens a new window. The
// timer lets the status bar style reach the activity before the new window
// reads it.
export const useModalSchemeKey = () => {
  const { scheme } = useTheme();
  const [settled, setSettled] = useState(scheme);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(scheme), 0);
    return () => clearTimeout(timer);
  }, [scheme]);
  return settled;
};
