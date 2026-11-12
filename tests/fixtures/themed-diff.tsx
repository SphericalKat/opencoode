import { registerRootComponent } from "expo";
import React from "react";

import { Patch } from "../../src/components/Patch";
import { ThemeProvider } from "../../src/lib/theme";
function Demo() {
  return (
    <ThemeProvider>
      <Patch
        patch={
          "--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n context\n-old\n+new\n---removed\n+++added\n\\ No newline at end of file\n"
        }
      />
    </ThemeProvider>
  );
}
registerRootComponent(Demo);
