import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import type React from "react";

import { invalidateKeys } from "../../lib/invalidate-keys";
import { useServerScope } from "../../lib/server-scope";
import type { Alive, SetPanel } from "./types";

export interface ChatMutationContext {
  alive: Alive;
  onSessionChanged: () => void;
  sessionID: string;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
}

interface ChatMutationOptions<V> {
  closePanel?: boolean;
  invalidate: (variables: V) => QueryKey[];
  mutationFn: (variables: V) => Promise<unknown>;
  onWritten?: (variables: V) => void;
}

// Every chat write for a session shares one mutation scope, so writes run one
// at a time.
export const useChatMutation = <V = void>(
  context: ChatMutationContext,
  {
    closePanel = false,
    invalidate,
    mutationFn,
    onWritten,
  }: ChatMutationOptions<V>
) => {
  const { onSessionChanged, sessionID, setError, setPanel, showError } =
    context;
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn,
    mutationKey: ["chat", scope, sessionID],
    onMutate: () => setError(null),
    onSuccess: (_result, variables) => {
      onWritten?.(variables);
      void invalidateKeys(queryClient, invalidate(variables));
    },
    scope: { id: `chat:${scope}:${sessionID}` },
  });
  const { mutateAsync } = mutation;
  const run = async (variables: V): Promise<boolean> => {
    try {
      await mutateAsync(variables, {
        onError: showError,
        onSuccess: () => {
          if (closePanel) {
            setPanel(null);
          }
          onSessionChanged();
        },
      });
      return true;
    } catch {
      return false;
    }
  };
  return { isPending: mutation.isPending, run };
};

export const useChatPending = (context: ChatMutationContext) => {
  const scope = useServerScope();
  return useIsMutating({ mutationKey: ["chat", scope, context.sessionID] }) > 0;
};
