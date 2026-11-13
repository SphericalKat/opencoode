import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useModelPreferences } from "../../lib/model-preferences";
import { useNativePresentation } from "../../lib/sheets";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { createStyles } from "./styles";
import type { Props } from "./types";
import { useAttachmentHandoff } from "./use-attachment-handoff";
import { useChatErrors } from "./use-chat-errors";
import { useComposerDraft } from "./use-composer-draft";
import { useComposerMetrics } from "./use-composer-metrics";
import { useDeviceAttachments } from "./use-device-attachments";
import { useDraftEditing } from "./use-draft-editing";
import { useFileSearch } from "./use-file-search";
import { useForegroundTracking } from "./use-foreground-tracking";
import { useLiveSession } from "./use-live-session";
import { useMessageSelection } from "./use-message-selection";
import { useModelSelection } from "./use-model-selection";
import { useOlderMessages } from "./use-older-messages";
import { usePanelRequest } from "./use-panel-request";
import { useResponseHaptics } from "./use-response-haptics";
import { useRunAction } from "./use-run-action";
import { useScreenReader } from "./use-screen-reader";
import { useSendMessage } from "./use-send-message";
import { useSessionCatalog } from "./use-session-catalog";
import { useSessionRefresh } from "./use-session-refresh";
import { useSessionState } from "./use-session-state";
import { useSessionTools } from "./use-session-tools";
import { useSessionViewSync } from "./use-session-view-sync";
import { useSheetState } from "./use-sheet-state";
import { useTranscriptScroll } from "./use-transcript-scroll";
import { useTranscriptView } from "./use-transcript-view";

export const useChatController = ({
  backend,
  onConnectionLost,
  sessionID,
  onSessionChanged,
  onOpenSession,
  attachmentPath,
  attachmentContext,
  onAttachmentConsumed,
  draftKey = sessionID,
  visible = true,
  onOpenNavigation,
  serverID,
  onSelectionChange,
  onSessionInfo,
  sessionPanelRequest,
}: Props) => {
  const client = backend.core;
  const { opencodeClient } = backend;
  const { capabilities } = backend;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const modelPreferences = useModelPreferences(serverID || "");
  const withNativePresentation = useNativePresentation();
  const metrics = useComposerMetrics();
  const sync = useSessionState(backend);
  const sheets = useSheetState();
  const { panel, setPanel, setSideQuestion, setTitle } = sheets;
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background"
  );
  const alive = useRef(true);
  const errors = useChatErrors({ alive, onConnectionLost });
  const { connectionFailures, reportConnectionFailure, setError, showError } =
    errors;
  const { requestVersionRef } = sync;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requestVersionRef.current += 1;
    };
  }, [requestVersionRef]);
  const { screenReader, screenReaderEnabled } = useScreenReader();
  const selection = useMessageSelection({
    alive,
    messages: sync.messages,
    onSelectionChange,
    panel,
    setPanel,
    showError,
    visible,
  });
  const { selectedMessageID, setSelectedMessageID } = selection;
  usePanelRequest({
    capabilities,
    sessionID,
    sessionPanelRequest,
    setPanel,
    visible,
  });
  const scroll = useTranscriptScroll({
    alive,
    foreground,
    panel,
    screenReaderEnabled,
    setPanel,
    setSelectedMessageID,
    visible,
  });
  const { jumpToLatest } = scroll;
  const composer = useComposerDraft({
    draftKey,
    showError,
    skills: sync.skills,
  });
  const fileSearch = useFileSearch({
    capabilities,
    opencodeClient,
    panel,
    session: sync.session,
    showError,
  });
  const { refresh, applyMessageSnapshot, handleChanged } = useSessionRefresh({
    alive,
    capabilities,
    client,
    opencodeClient,
    reportConnectionFailure,
    sessionID,
    setTitle,
    sync,
  });
  useForegroundTracking({ composer, draftKey, setForeground, showError });
  useLiveSession({
    alive,
    applyMessageSnapshot,
    backend,
    capabilities,
    client,
    connectionFailures,
    foreground,
    opencodeClient,
    refresh,
    reportConnectionFailure,
    sessionID,
    showError,
    sync,
    visible,
  });
  useSessionCatalog({
    capabilities,
    client,
    foreground,
    opencodeClient,
    sync,
    visible,
  });
  useSessionViewSync({
    foreground,
    onSessionChanged,
    onSessionInfo,
    opencodeClient,
    session: sync.session,
    sessionID,
    showError,
    visible,
  });
  useAttachmentHandoff({
    attachmentContext,
    attachmentPath,
    composer,
    onAttachmentConsumed,
    showError,
  });
  const { pending, run, submitting } = useRunAction({
    alive,
    onSessionChanged,
    refresh,
    setError,
    setPanel,
    showError,
  });
  const messageSend = useSendMessage({
    alive,
    capabilities,
    client,
    composer,
    draftKey,
    jumpToLatest,
    opencodeClient,
    run,
    sessionID,
    setPanel,
    setSideQuestion,
    showError,
    submitting,
    sync,
  });
  useResponseHaptics({
    active: sync.active,
    following: scroll.followingLatest,
    foreground,
    messages: sync.messages,
    pendingInputCount: sync.permissions.length + sync.forms.length,
    screenReaderEnabled,
    sessionID,
    stopping: messageSend.stopping,
    visible,
  });
  const device = useDeviceAttachments({
    alive,
    backend,
    capabilities,
    composer,
    foreground,
    setPanel,
    showError,
    visible,
    withNativePresentation,
  });
  const older = useOlderMessages({ alive, client, sessionID, showError, sync });
  const editing = useDraftEditing({
    alive,
    capabilities,
    composer,
    opencodeClient,
    run,
    sessionID,
    setPanel,
    setSelectedMessageID,
    sync,
  });
  const tools = useSessionTools({
    alive,
    capabilities,
    opencodeClient,
    run,
    session: sync.session,
    sessionID,
    setPanel,
    showError,
    withNativePresentation,
  });
  const modelChoice = useModelSelection({
    client,
    modelPreferences,
    run,
    sessionID,
    sync,
  });
  const view = useTranscriptView({
    awayFromLatest: scroll.awayFromLatest,
    followingLatest: scroll.followingLatest,
    foreground,
    opencodeClient,
    screenReader,
    selectMessage: scroll.selectMessage,
    selectedMessageID,
    sessionID,
    stopping: messageSend.stopping,
    sync,
    visible,
  });
  return {
    actionMessage: selection.actionMessage,
    active: sync.active,
    activity: view.activity,
    activityNotice: sync.activityNotice,
    agents: sync.agents,
    alive,
    attachments: composer.attachments,
    backend,
    backgroundDirectory: sheets.backgroundDirectory,
    backgroundShellID: sheets.backgroundShellID,
    beginUserScroll: scroll.beginUserScroll,
    canCopySelected: selection.canCopySelected,
    capabilities,
    catalogError: sync.catalogError,
    chooseModel: modelChoice.chooseModel,
    client,
    colors,
    commands: sync.commands,
    composerHeight: metrics.composerHeight,
    contentSizeChanged: scroll.contentSizeChanged,
    context: tools.context,
    copySelected: selection.copySelected,
    currentModel: modelChoice.currentModel,
    cursor: sync.cursor,
    delivery: composer.delivery,
    diffs: tools.diffs,
    disclosures: scroll.disclosures,
    draft: composer.draft,
    draftLoaded: composer.draftLoaded,
    editInbox: editing.editInbox,
    editMessage: editing.editMessage,
    enabledModels: modelChoice.enabledModels,
    error: errors.error,
    exportSession: tools.exportSession,
    fetchError: sync.fetchError,
    fileQuery: fileSearch.fileQuery,
    fileResults: fileSearch.fileResults,
    fileSearchBusy: fileSearch.fileSearchBusy,
    filteredModels: modelChoice.filteredModels,
    finishUserScroll: scroll.finishUserScroll,
    foreground,
    forms: sync.forms,
    handleChanged,
    hasPrompt: composer.hasPrompt,
    historyEpochRef: sync.historyEpochRef,
    inbox: sync.inbox,
    inspect: tools.inspect,
    interrupt: messageSend.interrupt,
    jumpToLatest: scroll.jumpToLatest,
    list: scroll.list,
    listLoaded: scroll.listLoaded,
    liveMessagesRef: sync.liveMessagesRef,
    loadOlder: older.loadOlder,
    loading: sync.loading,
    loadingOlder: older.loadingOlder,
    maintainPosition: scroll.maintainPosition,
    maximumComposerHeight: metrics.maximumComposerHeight,
    messages: sync.messages,
    minimumComposerHeight: metrics.minimumComposerHeight,
    modelFilter: modelChoice.modelFilter,
    modelPreferences,
    modelSearch: modelChoice.modelSearch,
    moveDirectory: sheets.moveDirectory,
    onOpenNavigation,
    onOpenSession,
    opencodeClient,
    panel: sheets.panel,
    panelLoading: tools.panelLoading,
    pending,
    permissions: sync.permissions,
    providerLabel: modelChoice.providerLabel,
    queueDevicePicker: device.queueDevicePicker,
    queuedMessagePanelRef: sheets.queuedMessagePanelRef,
    refresh,
    renderMessage: view.renderMessage,
    restoredSkillIDs: composer.restoredSkillIDs,
    run,
    scopedModels: modelChoice.scopedModels,
    selectedAgentIDs: composer.selectedAgentIDs,
    selectedMessageID: selection.selectedMessageID,
    selectedSkills: composer.selectedSkills,
    send: messageSend.send,
    sending: messageSend.sending,
    serverID,
    session: sync.session,
    sessionID,
    setAttachments: composer.setAttachments,
    setBackgroundDirectory: sheets.setBackgroundDirectory,
    setBackgroundShellID: sheets.setBackgroundShellID,
    setCatalogRevision: sync.setCatalogRevision,
    setDelivery: composer.setDelivery,
    setDraft: composer.setDraft,
    setError: errors.setError,
    setFileQuery: fileSearch.setFileQuery,
    setFollowing: scroll.setFollowing,
    setModelFilter: modelChoice.setModelFilter,
    setModelSearch: modelChoice.setModelSearch,
    setMoveDirectory: sheets.setMoveDirectory,
    setPanel: sheets.setPanel,
    setRestoredSkillIDs: composer.setRestoredSkillIDs,
    setSelectedAgentIDs: composer.setSelectedAgentIDs,
    setSelectedMessageID: selection.setSelectedMessageID,
    setSelectedSkills: composer.setSelectedSkills,
    setSideQuestion: sheets.setSideQuestion,
    setTextSelectionMessage: selection.setTextSelectionMessage,
    setTitle: sheets.setTitle,
    showActivityBar: view.showActivityBar,
    showError: errors.showError,
    showLatestControl: view.showLatestControl,
    sideQuestion: sheets.sideQuestion,
    skills: sync.skills,
    stopReady: messageSend.stopReady,
    stopping: messageSend.stopping,
    streamStatus: sync.streamStatus,
    styles,
    syncErrors: sync.syncErrors,
    textSelectionMessage: selection.textSelectionMessage,
    title: sheets.title,
    toolsDismissed: device.toolsDismissed,
    transcriptLayoutChanged: scroll.transcriptLayoutChanged,
    transcriptMessages: view.transcriptMessages,
    updateComposerHeight: metrics.updateComposerHeight,
    updateScrollPosition: scroll.updateScrollPosition,
    visible,
  };
};

export type ChatController = ReturnType<typeof useChatController>;
