import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // release-please generates CHANGELOG.md in its own Markdown style.
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), "CHANGELOG.md"],
});
