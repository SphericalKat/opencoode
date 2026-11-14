const fallbackPattern =
  /^(?<label>New session|Child session) - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const sessionLabel = (session: {
  title?: string;
  parentID?: string;
}): string => {
  if (!session.title) {
    return session.parentID ? "Child session" : "New session";
  }
  return fallbackPattern.exec(session.title)?.groups?.label ?? session.title;
};
