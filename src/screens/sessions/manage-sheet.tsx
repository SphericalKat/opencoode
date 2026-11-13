import type { SessionInfo } from "@opencode/client";

import {
  BodyText,
  Button,
  ErrorNotice,
  Field,
  Row,
  Sheet,
} from "../../components/ui";

interface ManageSheetProps {
  busy: boolean;
  editTitle: string;
  moveDirectory: string;
  onArchive: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEditTitle: (title: string) => void;
  onExport: () => void;
  onFork: () => void;
  onMove: () => void;
  onMoveDirectory: (directory: string) => void;
  onSaveTitle: () => void;
  selected: SessionInfo | undefined;
  sheetError: string | undefined;
}

export const ManageSheet = ({
  busy,
  editTitle,
  moveDirectory,
  onArchive,
  onClose,
  onDelete,
  onEditTitle,
  onExport,
  onFork,
  onMove,
  onMoveDirectory,
  onSaveTitle,
  selected,
  sheetError,
}: ManageSheetProps) => (
  <Sheet visible={!!selected} title="Manage session" onClose={onClose}>
    <BodyText selectable style={{ fontSize: 17, fontWeight: "500" }}>
      {selected?.title || "Untitled session"}
    </BodyText>
    {selected && (
      <BodyText muted>
        Updated {new Date(selected.time.updated).toLocaleString()}
      </BodyText>
    )}
    <Field label="Session title" value={editTitle} onChangeText={onEditTitle} />
    <Button
      title="Save title"
      busy={busy}
      disabled={!editTitle.trim()}
      onPress={onSaveTitle}
    />
    <Row>
      <Button
        title={selected?.time.archived ? "Restore session" : "Archive session"}
        disabled={busy}
        onPress={onArchive}
      />
      <Button title="Fork session" disabled={busy} onPress={onFork} />
    </Row>
    <Field
      label="Move to remote directory"
      value={moveDirectory}
      onChangeText={onMoveDirectory}
    />
    <Button
      title="Move session"
      disabled={
        busy ||
        !moveDirectory.trim() ||
        moveDirectory.trim() === selected?.location.directory
      }
      onPress={onMove}
    />
    <BodyText muted>
      A move during active work takes effect at a safe server boundary.
    </BodyText>
    <Button title="Export JSON" disabled={busy} onPress={onExport} />
    <BodyText muted>
      Export and import require a server with the experimental transcript API.
    </BodyText>
    <Button
      title="Delete session"
      variant="danger"
      disabled={busy}
      onPress={onDelete}
    />
    <ErrorNotice error={sheetError} />
  </Sheet>
);
