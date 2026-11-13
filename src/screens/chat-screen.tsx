import { LoadedChat } from "./chat/loaded-chat";
import type { Props } from "./chat/types";
import { SessionUnavailable } from "./chat/unavailable";
import { useChatController } from "./chat/use-chat-controller";

const ChatSession = (props: Props) => {
  const chat = useChatController(props);
  const {
    betaLayout,
    error,
    fetchError,
    loading,
    onOpenNavigation,
    projectLabel,
    refresh,
    session,
    styles,
  } = chat;
  if (!session) {
    return (
      <SessionUnavailable
        betaLayout={betaLayout}
        error={error}
        fetchError={fetchError}
        loading={loading}
        onOpenNavigation={onOpenNavigation}
        projectLabel={projectLabel}
        refresh={refresh}
        styles={styles}
      />
    );
  }
  return <LoadedChat chat={chat} session={session} />;
};

export const ChatScreen = (props: Props) => (
  <ChatSession key={props.sessionID} {...props} />
);
