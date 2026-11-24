import { Linking } from "react-native";

export const PRIVACY_POLICY_URL =
  "https://sphericalkat.github.io/opencoode/privacy/";

export const openPrivacyPolicy = (): Promise<unknown> =>
  Linking.openURL(PRIVACY_POLICY_URL);
