import type { SessionInfo } from "@opencode/client";
import { View } from "react-native";

import { ActionsSheet } from "./actions-sheet";
import { ErrorBanners, RevertBanner } from "./banners";
import { Composer } from "./composer";
import {
  AgentsSheet,
  ToolsSheet,
  CommandsSheet,
  MentionsSheet,
} from "./composer-sheets";
import { ChatKeyboardView } from "./controls";
import { ChatHeader } from "./header";
import { MessageSheet, SelectTextSheet } from "./message-sheets";
import { VariantsSheet, ModelsSheet } from "./model-sheets";
import {
  DiffSheet,
  ContextSheet,
  InstructionsSheet,
  SchedulesSheet,
  BackgroundSheet,
  ChildrenSheet,
  StatsSheet,
  SideQuestionSheet,
  ResourcesSheet,
} from "./panel-sheets";
import { TranscriptList } from "./transcript";
import type { ChatController } from "./use-chat-controller";

export const LoadedChat = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { panel, styles, visible } = chat;
  return (
    <View style={styles.frame}>
      <ChatKeyboardView enabled={visible && !panel}>
        <ChatHeader chat={chat} session={session} />
        <ErrorBanners chat={chat} />
        <RevertBanner chat={chat} session={session} />
        <TranscriptList chat={chat} session={session} />
        <Composer chat={chat} session={session} />
        <ActionsSheet chat={chat} session={session} />
        <VariantsSheet chat={chat} session={session} />
        <ModelsSheet chat={chat} session={session} />
        <AgentsSheet chat={chat} session={session} />
        <ToolsSheet chat={chat} session={session} />
        <MessageSheet chat={chat} session={session} />
        <SelectTextSheet chat={chat} session={session} />
        <CommandsSheet chat={chat} />
        <MentionsSheet chat={chat} session={session} />
        <DiffSheet chat={chat} />
        <ContextSheet chat={chat} session={session} />
        <InstructionsSheet chat={chat} />
        <SchedulesSheet chat={chat} />
        <BackgroundSheet chat={chat} session={session} />
        <ChildrenSheet chat={chat} />
        <StatsSheet chat={chat} session={session} />
        <SideQuestionSheet chat={chat} />
        <ResourcesSheet chat={chat} session={session} />
      </ChatKeyboardView>
    </View>
  );
};
