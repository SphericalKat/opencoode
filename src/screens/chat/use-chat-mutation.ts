import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import type React from "react";

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
  // Keys that the write changes. The mutation table in the data layer spec
  // names them for each write.
  invalidate: (variables: V) => QueryKey[];
  mutationFn: (variables: V) => Promise<unknown>;
}

// Every chat write shares one mutation scope, so writes run one at a time. A
// write that starts while another runs is dropped, as the composer expects.
export const useChatMutation = <V = void>(
  context: ChatMutationContext,
  { invalidate, mutationFn }: ChatMutationOptions<V>,
  closePanel = false
) => {
  const { alive, onSessionChanged, sessionID, setError, setPanel, showError } =
    context;
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const mutationKey = ["chat", scope, sessionID] as const;
  const mutation = useMutation({
    mutationFn,
    mutationKey,
    onError: (reason) => {
      if (alive.current) {
        showError(reason);
      }
    },
    onMutate: () => setError(null),
    onSuccess: (_result, variables) => {
      if (!alive.current) {
        return;
      }
      if (closePanel) {
        setPanel(null);
      }
      for (const queryKey of invalidate(variables)) {
        void queryClient.invalidateQueries({ queryKey });
      }
      onSessionChanged();
    },
    scope: { id: `chat:${scope}:${sessionID}` },
  });
  const { mutateAsync } = mutation;
  const run = (variables: V): Promise<boolean> => {
    if (queryClient.isMutating({ mutationKey }) > 0) {
      return Promise.resolve(false);
    }
    return mutateAsync(variables)
      .then(() => true)
      .catch(() => false);
  };
  return { isPending: mutation.isPending, run };
};

export const useChatPending = (context: ChatMutationContext) => {
  const scope = useServerScope();
  return useIsMutating({ mutationKey: ["chat", scope, context.sessionID] }) > 0;
};
