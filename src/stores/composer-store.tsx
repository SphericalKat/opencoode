import { createStoreContext } from "./create-store-context";

export interface AttachmentHandoff {
  context?: string;
  path?: string;
}

export interface ComposerState {
  // One-shot file handoff from the workspace, keyed by session ID. The chat
  // composer clears the entry after it consumes it. Drafts stay in `lib/drafts.ts`.
  handoffs: Record<string, AttachmentHandoff | undefined>;
}

export const {
  Provider: ComposerStoreProvider,
  useApi: useComposerStoreApi,
  useSelector: useComposerStore,
} = createStoreContext<ComposerState>("Composer store", () => ({
  handoffs: {},
}));
