import React from 'react';
import { registerRootComponent } from 'expo';
import { ThemeProvider } from '../../src/lib/theme';
import { Patch } from '../../src/components/Patch';
function Demo() { return <ThemeProvider><Patch patch={'--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n context\n-old\n+new\n---removed\n+++added\n\\ No newline at end of file\n'} /></ThemeProvider>; }
registerRootComponent(Demo);
