import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const invalidateKeys = async (
  queryClient: QueryClient,
  queryKeys: QueryKey[]
): Promise<void> => {
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
};
