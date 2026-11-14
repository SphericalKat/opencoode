import { registerRootComponent } from "expo";
import React from "react";

import { diffRows } from "../../src/lib/diff";
import { ThemeProvider } from "../../src/lib/theme";
import { DiffLineRow } from "../../src/screens/changes/diff-line";

const patch =
  "--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n context\n-old\n+new\n---removed\n+++added\n\\ No newline at end of file\n";

const Demo = () => (
  <ThemeProvider>
    {diffRows(patch, new Set()).map((row, index) =>
      row.kind === "line" ? (
        <DiffLineRow key={index} line={row.line} gutterWidth={39} />
      ) : null
    )}
  </ThemeProvider>
);
registerRootComponent(Demo);
