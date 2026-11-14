export const modelPreferenceID = (
  providerID: string,
  modelID: string
): string => JSON.stringify([providerID, modelID]);
