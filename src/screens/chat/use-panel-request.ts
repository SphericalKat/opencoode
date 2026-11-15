import { useState } from "react";

import { useChatUiStore } from "../../stores/chat-ui-store";
import type { Capabilities, SetPanel } from "./types";

interface UsePanelRequestOptions {
  capabilities: Capabilities;
  sessionID: string;
  setPanel: SetPanel;
  visible: boolean;
}

export const usePanelRequest = ({
  capabilities,
  sessionID,
  setPanel,
  visible,
}: UsePanelRequestOptions) => {
  const panelRequest = useChatUiStore((state) => state.panelRequest);
  const [handledPanelRequest, setHandledPanelRequest] = useState<
    number | undefined
  >();
  if (
    visible &&
    panelRequest &&
    panelRequest.sessionID === sessionID &&
    handledPanelRequest !== panelRequest.id
  ) {
    setHandledPanelRequest(panelRequest.id);
    if (panelRequest.panel !== "stats" || capabilities.statistics) {
      setPanel(panelRequest.panel);
    }
  }
};
