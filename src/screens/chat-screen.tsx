import { LoadedChat } from "./chat/loaded-chat";
import type { Props } from "./chat/types";
import { SessionUnavailable } from "./chat/unavailable";
import { useChatController } from "./chat/use-chat-controller";

const ChatSession = (props: Props) => {
  const chat = useChatController(props);
  const { session } = chat;
  if (!session) {
    return <SessionUnavailable chat={chat} />;
  }
  return <LoadedChat chat={chat} session={session} />;
};

export const ChatScreen = (props: Props) => (
  <ChatSession key={props.sessionID} {...props} />
);
