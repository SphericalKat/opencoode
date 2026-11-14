import type { SessionInfo } from "@opencode/client";

import { Sheet } from "../../components/ui";
import { MessageRow } from "./message-rows";
import type { ChatController } from "./use-chat-controller";

interface SelectTextSheetProps extends Pick<
  ChatController,
  | "opencodeClient"
  | "panel"
  | "setPanel"
  | "setTextSelectionMessage"
  | "textSelectionMessage"
> {
  session: SessionInfo;
}

export const SelectTextSheet = ({
  opencodeClient,
  panel,
  session,
  setPanel,
  setTextSelectionMessage,
  textSelectionMessage,
}: SelectTextSheetProps) => (
  <Sheet
    visible={panel === "selectText"}
    title="Select text"
    onClose={() => {
      setPanel(null);
      setTextSelectionMessage(null);
    }}
  >
    {textSelectionMessage && (
      <MessageRow
        message={textSelectionMessage}
        client={opencodeClient}
        directory={session.location.directory}
      />
    )}
  </Sheet>
);
