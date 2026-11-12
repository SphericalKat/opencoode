import { registerRootComponent } from "expo";
import React from "react";
import { ScrollView } from "react-native";

import { Markdown } from "../../src/components/Markdown";
import { ThemeProvider } from "../../src/lib/theme";

function Demo() {
  return (
    <ThemeProvider>
      <ScrollView>
        <Markdown
          text={
            '```javascript\nconst answer = "hello";\n```\n\n```unknown\nconst plain = "hello";\n```'
          }
        />
      </ScrollView>
    </ThemeProvider>
  );
}
registerRootComponent(Demo);
