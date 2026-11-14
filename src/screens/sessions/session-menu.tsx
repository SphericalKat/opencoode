import type { SessionInfo } from "@opencode/client";

import { AnchoredMenu } from "../../components/anchored-menu";
import type { AnchoredMenuItem, Rect } from "../../components/anchored-menu";
import { isUnread } from "./format";

export interface SessionActions {
  archive: (item: SessionInfo) => void;
  exportSession: (item: SessionInfo) => void;
  markRead: (item: SessionInfo) => void;
  remove: (item: SessionInfo) => void;
  rename: (item: SessionInfo) => void;
}

const menuItems = (
  session: SessionInfo,
  actions: SessionActions,
  busy: boolean
): AnchoredMenuItem[] => {
  const items: AnchoredMenuItem[] = [
    { key: "rename", label: "Rename", onSelect: () => actions.rename(session) },
    {
      disabled: busy,
      key: "export",
      label: "Export…",
      onSelect: () => actions.exportSession(session),
    },
  ];
  if (isUnread(session)) {
    items.push({
      key: "mark-read",
      label: "Mark as read",
      onSelect: () => actions.markRead(session),
    });
  }
  items.push(
    {
      key: "archive",
      label: session.time.archived ? "Restore" : "Archive",
      onSelect: () => actions.archive(session),
    },
    { key: "separator", type: "separator" },
    {
      destructive: true,
      key: "delete",
      label: "Delete",
      onSelect: () => actions.remove(session),
    }
  );
  return items;
};

export const SessionMenu = ({
  actions,
  anchor,
  busy,
  onClose,
  onClosed,
  session,
  visible,
}: {
  actions: SessionActions;
  anchor: Rect | null;
  busy: boolean;
  onClose: () => void;
  onClosed: () => void;
  session: SessionInfo | undefined;
  visible: boolean;
}) => (
  <AnchoredMenu
    accessibilityLabel="Session actions"
    anchor={anchor}
    gutter={2}
    items={session ? menuItems(session, actions, busy) : []}
    onClose={onClose}
    onClosed={onClosed}
    placement="bottom-start"
    visible={visible}
  />
);
