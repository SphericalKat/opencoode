import { Linking } from "react-native";

import { errorMessage } from "./client";

export const PRIVACY_POLICY_URL =
  "https://sphericalkat.github.io/opencoode/privacy/";
export const REPOSITORY_URL = "https://github.com/SphericalKat/opencoode";
export const ISSUES_URL = "https://github.com/SphericalKat/opencoode/issues";

export const openExternalUrl = (
  url: string,
  onError: (message: string) => void
): void => {
  void Linking.openURL(url).catch((error_) => onError(errorMessage(error_)));
};
