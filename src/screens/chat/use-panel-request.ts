import { useState } from "react";

import type { Capabilities } from "./session-sync";
import type { Props, SetPanel } from "./types";

interface UsePanelRequestOptions {
  capabilities: Capabilities;
  sessionID: string;
  sessionPanelRequest: Props["sessionPanelRequest"];
  setPanel: SetPanel;
  visible: boolean;
}

export const usePanelRequest = ({
  capabilities,
  sessionID,
  sessionPanelRequest,
  setPanel,
  visible,
}: UsePanelRequestOptions) => {
  const [handledPanelRequest, setHandledPanelRequest] = useState<
    number | undefined
  >();
  if (
    visible &&
    sessionPanelRequest &&
    sessionPanelRequest.sessionID === sessionID &&
    handledPanelRequest !== sessionPanelRequest.id
  ) {
    setHandledPanelRequest(sessionPanelRequest.id);
    if (sessionPanelRequest.panel !== "stats" || capabilities.statistics) {
      setPanel(sessionPanelRequest.panel);
    }
  }
};
