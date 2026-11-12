import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import reactNative from "ultracite/oxlint/react-native";

export default defineConfig({
  env: core.env,
  extends: [core, react, reactNative],
  ignorePatterns: core.ignorePatterns,
});
