import type { SessionInfo } from "@opencode/client";

export const sessionStatus = (
  running: boolean,
  outcome: SessionInfo["outcome"]
) => {
  if (running) {
    return "Running";
  }
  if (outcome === "succeeded") {
    return "Completed";
  }
  if (outcome === "failed") {
    return "Failed";
  }
  if (outcome === "interrupted") {
    return "Stopped";
  }
  return "Idle";
};
