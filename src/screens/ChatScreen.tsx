import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, BackHandler, FlatList, Image, Keyboard, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type TextInputProps } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView, KeyboardEvents } from 'react-native-keyboard-controller';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { AgentInfo, CommandInfo, FileDiffInfo, FileSystemEntry, FormInfo, ModelInfo, OpenCodeEvent, PermissionRequest, SessionInboxInfo, SessionInfo, SessionMessageAssistant, SessionMessageInfo, SessionPromptInput, SessionStatus, SkillInfo } from '@opencode/client';
import { errorMessage, type Client } from '../lib/client';
import { isAssistantProgress, mergeMessages, parseComposer, projectLiveEvents, serverFileUri } from '../lib/chat';
import { Button, Busy, Card, confirmAction, Disclosure, Empty, ErrorNotice, Field, Heading, JsonView, Label, mono, Row, Sheet } from '../components/ui';
import { SessionForms } from '../components/SessionForms';
import { Markdown } from '../components/Markdown';
import { Instructions } from '../components/Instructions';
import { Schedules } from '../components/Schedules';
import { loadDraft, saveDraft } from '../lib/drafts';
import { useUnsavedChanges } from '../lib/unsaved';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { ShellIcon } from '../components/ShellIcon';
import { MotionContent, PressFeedback, WorkingIndicator } from '../components/motion';
import { ActivityDisclosure, AgentActivityBar } from '../components/AgentActivity';
import { sessionActivity, toolActivityLabel, type AgentActivity } from '../lib/activity';
import { createStreamBatch } from '../lib/streamBatch';
import { BackgroundCommands } from '../components/BackgroundCommands';
import { ChildSessions } from '../components/ChildSessions';
import { SessionStats } from '../components/SessionStats';
import { SideQuestion } from '../components/SideQuestion';
import { McpResources } from '../components/McpResources';
import { ArtifactContent } from '../components/ArtifactContent';
import { modelPreferenceID, useModelPreferences } from '../lib/modelPreferences';
import { MessageActionsContext, MessageDisclosureContext } from '../lib/messageActions';
import { useNativePresentation } from '../lib/sheets';

type Props = {
  client: Client;
  sessionID: string;
  onSessionChanged: () => void;
  onOpenSession: (id: string) => void;
  attachmentPath?: string;
  attachmentContext?: string;
  onAttachmentConsumed?: () => void;
  draftKey?: string;
  visible?: boolean;
  onOpenNavigation?: () => void;
  projectLabel?: string;
  serverID?: string;
};
type Attachment = NonNullable<SessionPromptInput['files']>[number];
type Panel = 'actions' | 'models' | 'agents' | 'commands' | 'mentions' | 'tools' | 'message' | 'selectText' | 'diff' | 'context' | 'instructions' | 'schedules' | 'background' | 'children' | 'stats' | 'btw' | 'resources' | null;
type SyncScope = 'metadata' | 'history' | 'inbox' | 'requests';
const messageKey = (message: SessionMessageInfo) => message.id;
const messageType = (message: SessionMessageInfo) => message.type;
const MessageSeparator = ({ leadingItem, trailingItem }: { leadingItem?: SessionMessageInfo; trailingItem?: SessionMessageInfo }) => <View style={{ height: leadingItem?.type === 'assistant' && trailingItem?.type === 'assistant' ? 10 : 24 }} />;

export function ChatScreen(props: Props) {
  return <ChatSession key={props.sessionID} {...props} />;
}

function ChatSession({ client, sessionID, onSessionChanged, onOpenSession, attachmentPath, attachmentContext, onAttachmentConsumed, draftKey = sessionID, visible = true, onOpenNavigation, projectLabel, serverID }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const modelPreferences = useModelPreferences(serverID || '');
  const withNativePresentation = useNativePresentation();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<SessionMessageInfo[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [inbox, setInbox] = useState<SessionInboxInfo[]>([]);
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [draft, setDraft] = useState('');
  const [composerHeight, setComposerHeight] = useState(44);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SkillInfo[]>([]);
  const [selectedAgentIDs, setSelectedAgentIDs] = useState<string[]>([]);
  const [restoredSkillIDs, setRestoredSkillIDs] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [fileResults, setFileResults] = useState<FileSystemEntry[]>([]);
  const [fileSearchBusy, setFileSearchBusy] = useState(false);
  const [delivery, setDelivery] = useState<'steer' | 'queue'>('steer');
  const [active, setActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopReady, setStopReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Partial<Record<SyncScope, string>>>({});
  const [streamStatus, setStreamStatus] = useState('Connecting');
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedMessageID, setSelectedMessageID] = useState<string | null>(null);
  const [textSelectionMessage, setTextSelectionMessage] = useState<SessionMessageInfo | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const [backgroundShellID, setBackgroundShellID] = useState<string>();
  const [backgroundDirectory, setBackgroundDirectory] = useState<string>();
  const [sideQuestion, setSideQuestion] = useState<string>();
  const [modelSearch, setModelSearch] = useState('');
  const [modelFilter, setModelFilter] = useState<'all' | 'favorites' | 'recent'>('all');
  const [title, setTitle] = useState('');
  const [moveDirectory, setMoveDirectory] = useState('');
  const [diffs, setDiffs] = useState<FileDiffInfo[]>([]);
  const [context, setContext] = useState<SessionMessageInfo[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [followingLatest, setFollowingLatest] = useState(true);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const alive = useRef(true);
  const submitting = useRef(false);
  const list = useRef<FlashListRef<SessionMessageInfo>>(null);
  const nearEnd = useRef(true);
  const scrollMetrics = useRef({ content: 0, viewport: 0, offset: 0 });
  const followingLatestRef = useRef(true);
  const userScrolling = useRef(false);
  const wheelDirection = useRef(0);
  const webScrollCleanup = useRef<() => void>(() => {});
  const followKeyboard = useRef(false);
  const followFrame = useRef<number | undefined>(undefined);
  const transcriptVisible = useRef(visible);
  transcriptVisible.current = visible;
  const screenReaderEnabled = useRef(screenReader);
  screenReaderEnabled.current = screenReader;
  const refreshRef = useRef<() => void>(() => {});
  const flushStream = useRef<() => void>(() => {});
  const requestVersion = useRef(0);
  const sessionDirectory = useRef<string | undefined>(undefined);
  const liveMessages = useRef(new Map<string, SessionMessageAssistant>());
  const historyEpoch = useRef(1);
  const activityRevision = useRef(0);
  const expandedParts = useRef(new Set<string>());
  const appliedHistoryEpoch = useRef(0);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);
  const didLoadDraft = useRef(false);
  const onSessionChangedRef = useRef(onSessionChanged);
  const consumedAttachment = useRef<{ path: string; context?: string } | null>(null);
  const queuedDevicePicker = useRef(false);
  const queuedMessagePanel = useRef<'selectText' | 'background' | null>(null);
  const devicePickerActive = useRef(false);
  onSessionChangedRef.current = onSessionChanged;
  const draftRef = useRef({ text: draft, files: attachments, skillIDs: selectedSkills.map(skill => skill.id), agentIDs: selectedAgentIDs, delivery });
  draftRef.current = { text: draft, files: attachments, skillIDs: [...new Set([...restoredSkillIDs, ...selectedSkills.map(skill => skill.id)])], agentIDs: selectedAgentIDs, delivery };
  useUnsavedChanges(`chat:${draftKey}`, 'Message draft', !!draft || attachments.length > 0 || selectedSkills.length > 0 || restoredSkillIDs.length > 0 || selectedAgentIDs.length > 0);

  useEffect(() => { alive.current = true; return () => { alive.current = false; requestVersion.current++; }; }, []);
  const showError = useCallback((reason: unknown) => { if (alive.current) setError(errorMessage(reason)); }, []);
  const updateComposerHeight = useCallback<NonNullable<TextInputProps['onContentSizeChange']>>(event => setComposerHeight(Math.max(44, Math.min(120, event.nativeEvent.contentSize.height))), []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (current) setScreenReader(enabled); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { current = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible || !selectedMessageID) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setSelectedMessageID(null); return true; });
    return () => subscription.remove();
  }, [visible, selectedMessageID]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !selectedMessageID || panel) return;
    const closeSelection = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setSelectedMessageID(null);
    };
    document.addEventListener('keydown', closeSelection);
    return () => document.removeEventListener('keydown', closeSelection);
  }, [visible, selectedMessageID, panel]);
  useEffect(() => {
    if (selectedMessageID && !messages.some(message => message.id === selectedMessageID)) {
      setSelectedMessageID(null);
      setPanel(current => current === 'message' || current === 'selectText' ? null : current);
    }
  }, [messages, selectedMessageID]);
  const setFollowing = useCallback((follow: boolean) => {
    followingLatestRef.current = follow;
    if (!follow && followFrame.current !== undefined) { cancelAnimationFrame(followFrame.current); followFrame.current = undefined; }
    setAwayFromLatest(follow ? false : !nearEnd.current);
    setFollowingLatest(current => current === follow ? current : follow);
  }, []);
  const disclosures = useMemo(() => ({
    isOpen: (key: string) => expandedParts.current.has(key),
    toggle: (key: string) => {
      followKeyboard.current = false;
      setFollowing(false);
      const open = !expandedParts.current.has(key);
      if (open) expandedParts.current.add(key); else expandedParts.current.delete(key);
      return open;
    },
  }), [setFollowing]);
  const selectMessage = useCallback((id: string) => {
    followKeyboard.current = false;
    setFollowing(false);
    Keyboard.dismiss();
    setSelectedMessageID(id);
    if (screenReaderEnabled.current) setPanel('message');
  }, [setFollowing]);
  const followContent = useCallback(() => {
    if (!followingLatestRef.current || userScrolling.current || !transcriptVisible.current || followFrame.current !== undefined) return;
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = undefined;
      if (!alive.current || !followingLatestRef.current || userScrolling.current || !transcriptVisible.current) return;
      list.current?.getNativeScrollRef()?.scrollToEnd({ animated: false });
    });
  }, []);
  useEffect(() => () => { if (followFrame.current !== undefined) cancelAnimationFrame(followFrame.current); }, []);
  useEffect(() => {
    if (!visible && followFrame.current !== undefined) { cancelAnimationFrame(followFrame.current); followFrame.current = undefined; }
    if (visible) followContent();
  }, [visible, followContent]);
  const jumpToLatest = useCallback(() => {
    userScrolling.current = false;
    wheelDirection.current = 0;
    setFollowing(true);
    nearEnd.current = true;
    setAwayFromLatest(false);
    setSelectedMessageID(null);
    list.current?.scrollToEnd({ animated: false });
  }, [setFollowing]);
  const measureEndDistance = useCallback(() => {
    const { content, viewport, offset } = scrollMetrics.current;
    const nextNearEnd = content - offset - viewport <= 48;
    if (nextNearEnd !== nearEnd.current) {
      nearEnd.current = nextNearEnd;
      if (!followingLatestRef.current) setAwayFromLatest(!nextNearEnd);
    }
  }, []);
  const contentSizeChanged = useCallback((_width: number, height: number) => {
    scrollMetrics.current.content = height;
    measureEndDistance();
    followContent();
  }, [measureEndDistance, followContent]);
  const transcriptLayoutChanged = useCallback((event: LayoutChangeEvent) => {
    scrollMetrics.current.viewport = event.nativeEvent.layout.height;
    measureEndDistance();
    followContent();
  }, [measureEndDistance, followContent]);
  const updateScrollPosition = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const previousOffset = scrollMetrics.current.offset;
    scrollMetrics.current = { content: contentSize.height, viewport: layoutMeasurement.height, offset: contentOffset.y };
    measureEndDistance();
    if (Platform.OS !== 'web' && contentOffset.y < previousOffset - 1 && !nearEnd.current) setFollowing(false);
    if (Platform.OS === 'web' && userScrolling.current && nearEnd.current && wheelDirection.current >= 0) setFollowing(true);
  }, [setFollowing, measureEndDistance]);
  const beginUserScroll = useCallback(() => {
    userScrolling.current = true;
    followKeyboard.current = false;
    setFollowing(false);
  }, [setFollowing]);
  const finishUserScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateScrollPosition(event);
    userScrolling.current = false;
    setFollowing(nearEnd.current);
  }, [updateScrollPosition, setFollowing]);
  const attachWebScroll = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const node = list.current?.getScrollableNode();
    if (!(node instanceof HTMLElement)) return;
    webScrollCleanup.current();
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.deltaY > 0 && nearEnd.current) {
        userScrolling.current = false;
        setFollowing(true);
        return;
      }
      userScrolling.current = true;
      wheelDirection.current = event.deltaY;
      followKeyboard.current = false;
      if (event.deltaY < 0) setFollowing(false);
    };
    const touch = () => { wheelDirection.current = 0; beginUserScroll(); };
    const end = () => { if (userScrolling.current) { userScrolling.current = false; setFollowing(nearEnd.current); } };
    const selectedRow = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[id^="chat-message-"]') : null;
    const context = (event: MouseEvent) => {
      const row = selectedRow(event.target);
      if (!row) return;
      event.preventDefault();
      selectMessage(row.id.slice('chat-message-'.length));
    };
    const keyboard = (event: KeyboardEvent) => {
      const row = selectedRow(event.target);
      if (!row || event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10') && !(event.target === row && (event.key === 'Enter' || event.key === ' '))) return;
      event.preventDefault();
      selectMessage(row.id.slice('chat-message-'.length));
    };
    node.addEventListener('wheel', wheel, { passive: true });
    node.addEventListener('touchmove', touch, { passive: true });
    node.addEventListener('touchend', end, { passive: true });
    node.addEventListener('touchcancel', end, { passive: true });
    node.addEventListener('scrollend', end);
    node.addEventListener('contextmenu', context);
    node.addEventListener('keydown', keyboard);
    webScrollCleanup.current = () => { node.removeEventListener('wheel', wheel); node.removeEventListener('touchmove', touch); node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', end); node.removeEventListener('scrollend', end); node.removeEventListener('contextmenu', context); node.removeEventListener('keydown', keyboard); };
  }, [beginUserScroll, setFollowing, selectMessage]);
  const listLoaded = useCallback(() => {
    if (followingLatestRef.current && !userScrolling.current) list.current?.scrollToEnd({ animated: false });
    attachWebScroll();
  }, [attachWebScroll]);
  useEffect(() => { attachWebScroll(); return () => webScrollCleanup.current(); }, [attachWebScroll]);
  const maintainPosition = useMemo(() => ({ disabled: followingLatest }), [followingLatest]);
  const applyMessageSnapshot = useCallback((snapshot: SessionMessageInfo[], reset = false) => {
    setMessages(current => {
      for (const message of snapshot) {
        const live = liveMessages.current.get(message.id);
        if (message.type === 'assistant' && live?.time.completed && message.time.completed && message.time.completed >= live.time.completed) liveMessages.current.delete(message.id);
      }
      return mergeMessages(reset ? [] : current, snapshot, [...liveMessages.current.values()]);
    });
  }, []);

  useEffect(() => {
    if (!foreground || !visible || panel) return;
    let frame: ReturnType<typeof requestAnimationFrame> | undefined;
    const willShow = KeyboardEvents.addListener('keyboardWillShow', () => { followKeyboard.current = followingLatestRef.current; });
    const didShow = KeyboardEvents.addListener('keyboardDidShow', () => {
      const follow = followKeyboard.current;
      followKeyboard.current = false;
      if (!follow) return;
      frame = requestAnimationFrame(() => { if (alive.current && followingLatestRef.current && !userScrolling.current && transcriptVisible.current) jumpToLatest(); });
    });
    const willHide = KeyboardEvents.addListener('keyboardWillHide', () => { followKeyboard.current = false; if (frame !== undefined) cancelAnimationFrame(frame); });
    return () => { willShow.remove(); didShow.remove(); willHide.remove(); followKeyboard.current = false; if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [foreground, visible, panel, jumpToLatest]);

  useEffect(() => {
    let cancelled = false;
    void loadDraft(draftKey).then(value => {
      if (cancelled) return;
      if (value) { setDraft(value.text); setAttachments(value.files); setRestoredSkillIDs(value.skillIDs); setSelectedAgentIDs(value.agentIDs); setDelivery(value.delivery); }
      didLoadDraft.current = true;
      setDraftLoaded(true);
    }).catch(reason => { if (!cancelled) { showError(reason); didLoadDraft.current = true; setDraftLoaded(true); } });
    return () => {
      cancelled = true;
      if (didLoadDraft.current) void saveDraft(draftKey, draftRef.current).catch(showError);
    };
  }, [draftKey, showError]);
  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => { void saveDraft(draftKey, draftRef.current).catch(showError); }, 500);
    return () => clearTimeout(timer);
  }, [draftKey, draft, attachments, selectedSkills, restoredSkillIDs, selectedAgentIDs, delivery, draftLoaded, showError]);
  useEffect(() => {
    if (!skills.length || !restoredSkillIDs.length) return;
    const resolved = skills.filter(skill => restoredSkillIDs.includes(skill.id));
    if (!resolved.length) return;
    setSelectedSkills(current => [...current, ...resolved.filter(skill => !current.some(value => value.id === skill.id))]);
    setRestoredSkillIDs(current => current.filter(id => !resolved.some(skill => skill.id === id)));
  }, [skills, restoredSkillIDs]);
  useEffect(() => {
    if (panel !== 'mentions' || !session) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setFileSearchBusy(true);
      void client.file.find({ location: { directory: session.location.directory }, query: fileQuery, type: 'file', limit: 40 }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setFileResults(value.data); }).catch(reason => { if (!controller.signal.aborted) showError(reason); }).finally(() => { if (!controller.signal.aborted) setFileSearchBusy(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [panel, client, session?.location.directory, fileQuery, showError]);

  const refresh = useCallback(async (signal?: AbortSignal): Promise<void> => {
    flushStream.current();
    if (refreshing.current) { refreshAgain.current = true; return refreshing.current; }
    const work = async () => {
    const version = ++requestVersion.current;
    const historyVersion = historyEpoch.current;
    const activityVersion = activityRevision.current;
    const reset = historyVersion !== appliedHistoryEpoch.current;
    const opts = { signal };
    const sessionRequest = client.session.get({ sessionID }, opts);
    const results = await Promise.allSettled([
      sessionRequest,
      client.message.list({ sessionID, limit: 80, order: 'desc' }, opts),
      client.session.inbox.list({ sessionID }, opts),
      client.session.form.list({ sessionID }, opts),
      client.permission.list({ sessionID }, opts),
      client.session.active(opts),
      sessionRequest.then(info => client.form.list({ location: { directory: info.location.directory } }, opts)),
    ] as const);
    if (!alive.current || signal?.aborted || version !== requestVersion.current) return;
    const [sessionResult, messageResult, inboxResult, formsResult, permissionsResult, activeResult, globalFormsResult] = results;
    if (sessionResult.status === 'fulfilled') {
      sessionDirectory.current = sessionResult.value.location.directory;
      setSession(sessionResult.value);
      setTitle(current => current || sessionResult.value.title || '');
    }
    if (messageResult.status === 'fulfilled') {
      applyMessageSnapshot(messageResult.value.data, reset);
      if (reset) { setCursor(messageResult.value.data.length === 80 ? messageResult.value.cursor.next ?? undefined : undefined); appliedHistoryEpoch.current = historyVersion; }
    }
    if (inboxResult.status === 'fulfilled') setInbox(inboxResult.value);
    if (formsResult.status === 'fulfilled' || globalFormsResult.status === 'fulfilled') setForms(current => [...(formsResult.status === 'fulfilled' ? formsResult.value : current.filter(form => form.sessionID === sessionID)), ...(globalFormsResult.status === 'fulfilled' ? globalFormsResult.value.data.filter(form => form.sessionID === 'global') : current.filter(form => form.sessionID === 'global'))]);
    if (permissionsResult.status === 'fulfilled') setPermissions(permissionsResult.value);
    if (activeResult.status === 'fulfilled' && activityVersion === activityRevision.current) {
      const running = !!activeResult.value[sessionID];
      setActive(running);
      if (!running) setSessionStatus({ type: 'idle' });
    }
    const failed = results.find(result => result.status === 'rejected');
    setFetchError(failed?.status === 'rejected' ? errorMessage(failed.reason) : null);
    if (!failed) setSyncErrors({});
    setLoading(false);
    };
    refreshing.current = work();
    try { await refreshing.current; }
    finally {
      refreshing.current = null;
      if (refreshAgain.current && alive.current) { refreshAgain.current = false; void refresh(signal?.aborted ? undefined : signal); }
    }
  }, [client, sessionID, applyMessageSnapshot]);
  refreshRef.current = () => { void refresh(); };

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active' && didLoadDraft.current) void saveDraft(draftKey, draftRef.current).catch(showError); });
    return () => listener.remove();
  }, [draftKey, showError]);

  useEffect(() => {
    if (!foreground || !visible) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryResolve: (() => void) | undefined;
    let attempts = 0;
    const scopeTimers = new Map<SyncScope, ReturnType<typeof setTimeout>>();
    const scopeVersions = new Map<SyncScope, number>();
    const applyEvents = (events: OpenCodeEvent[]) => {
      setMessages(current => {
        const next = projectLiveEvents(current, events, sessionID);
        if (next === current) return current;
        const touched = new Set<string>();
        for (const event of events) {
          const data = event.data as Record<string, unknown>;
          if (typeof data.assistantMessageID === 'string') touched.add(data.assistantMessageID);
        }
        for (const message of next) if (message.type === 'assistant' && touched.has(message.id)) liveMessages.current.set(message.id, message);
        return next;
      });
    };
    const stream = createStreamBatch<OpenCodeEvent>(applyEvents, { frame: true });
    flushStream.current = stream.flush;
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = undefined; void refresh(controller.signal); }, 300);
    };
    const refreshScope = async (scope: SyncScope) => {
      if (refreshing.current) await refreshing.current;
      if (controller.signal.aborted) return;
      const version = (scopeVersions.get(scope) || 0) + 1;
      scopeVersions.set(scope, version);
      const snapshotVersion = requestVersion.current;
      const current = () => !controller.signal.aborted && scopeVersions.get(scope) === version && snapshotVersion === requestVersion.current;
      const options = { signal: controller.signal };
      try {
        if (scope === 'metadata') {
          const info = await client.session.get({ sessionID }, options);
          if (!current()) return;
          sessionDirectory.current = info.location.directory;
          setSession(info);
        } else if (scope === 'history') {
          const page = await client.message.list({ sessionID, limit: 80, order: 'desc' }, options);
          if (!current()) return;
          applyMessageSnapshot(page.data);
        } else if (scope === 'inbox') {
          const pending = await client.session.inbox.list({ sessionID }, options);
          if (!current()) return;
          setInbox(pending);
        } else {
          const directory = sessionDirectory.current;
          if (!directory) { scheduleRefresh(); return; }
          const [own, permissions, global] = await Promise.allSettled([
            client.session.form.list({ sessionID }, options),
            client.permission.list({ sessionID }, options),
            client.form.list({ location: { directory } }, options),
          ] as const);
          if (!current()) return;
          if (permissions.status === 'fulfilled') setPermissions(permissions.value);
          setForms(previous => [...(own.status === 'fulfilled' ? own.value : previous.filter(form => form.sessionID === sessionID)), ...(global.status === 'fulfilled' ? global.value.data.filter(form => form.sessionID === 'global') : previous.filter(form => form.sessionID === 'global'))]);
          const failure = [own, permissions, global].find(result => result.status === 'rejected');
          if (failure?.status === 'rejected') throw failure.reason;
        }
        if (current()) setSyncErrors(previous => { if (!previous[scope]) return previous; const next = { ...previous }; delete next[scope]; return next; });
      } catch (reason) { if (current()) setSyncErrors(previous => ({ ...previous, [scope]: errorMessage(reason) })); }
    };
    const scheduleScope = (scope: SyncScope) => {
      if (scopeTimers.has(scope)) return;
      scopeTimers.set(scope, setTimeout(() => { scopeTimers.delete(scope); void refreshScope(scope); }, 200));
    };
    void (async () => {
      await refresh(controller.signal);
      while (!controller.signal.aborted) {
        try {
          setStreamStatus(attempts ? 'Reconnecting' : 'Connecting');
          for await (const event of client.event.subscribe({ signal: controller.signal })) {
            if (controller.signal.aborted) break;
            setStreamStatus('Live');
            attempts = 0;
            if (event.type === 'server.connected') {
              stream.flush();
              setSessionStatus(null);
              setMessages(current => { liveMessages.current.clear(); return current; });
              historyEpoch.current++;
              scheduleRefresh();
              continue;
            }
            const data = event.data as Record<string, unknown>;
            if (event.type === 'location.shutdown' || /^(model|provider|agent|command|skill|credential|config)\./.test(event.type)) setCatalogRevision(value => value + 1);
            if (data.sessionID === sessionID) {
              if (event.type === 'session.status') {
                activityRevision.current++;
                setSessionStatus(event.data.status);
                setActive(event.data.status.type !== 'idle');
                if (event.data.status.type === 'idle') scheduleRefresh();
                continue;
              }
              if (event.type === 'session.retry.scheduled') {
                activityRevision.current++;
                setSessionStatus({ type: 'retry', attempt: event.data.attempt, next: event.data.at, message: event.data.error.message });
              } else if (isAssistantProgress(event)) {
                setSessionStatus(current => current?.type === 'retry' ? { type: 'busy' } : current);
              }
              if (event.type === 'session.compaction.delta') continue;
              if (event.type.endsWith('.delta') || event.type === 'session.tool.progress') { stream.push(event); continue; }
              stream.flush();
              if ('assistantMessageID' in data) { applyEvents([event]); continue; }
              switch (event.type) {
                case 'session.execution.started': activityRevision.current++; setActive(true); setSessionStatus({ type: 'busy' }); break;
                case 'session.usage.updated': setSession(previous => previous ? { ...previous, cost: event.data.cost, tokens: event.data.tokens } : previous); break;
                case 'session.execution.succeeded':
                case 'session.execution.failed':
                case 'session.execution.interrupted': activityRevision.current++; setActive(false); setSessionStatus({ type: 'idle' }); scheduleRefresh(); break;
                case 'session.revert.committed': historyEpoch.current++; setMessages(current => { liveMessages.current.clear(); return current; }); scheduleRefresh(); break;
                case 'session.moved':
                case 'session.revert.staged':
                case 'session.revert.cleared':
                case 'session.deleted': scheduleRefresh(); break;
                case 'session.idle': activityRevision.current++; setActive(false); setSessionStatus({ type: 'idle' }); scheduleRefresh(); break;
                case 'permission.asked':
                case 'permission.replied':
                case 'form.replied':
                case 'form.cancelled': scheduleScope('requests'); break;
                case 'session.inbox.delivered': scheduleScope('inbox'); scheduleScope('history'); break;
                case 'session.inbox.enqueued':
                case 'session.inbox.cancelled':
                case 'session.inbox.delivery.changed': scheduleScope('inbox'); break;
                case 'session.agent.selected':
                case 'session.model.selected': scheduleScope('metadata'); scheduleScope('history'); break;
                case 'session.renamed':
                case 'session.metadata.updated':
                case 'session.permissions':
                case 'session.viewed':
                case 'session.archived':
                case 'session.unarchived': scheduleScope('metadata'); break;
                case 'session.synthetic':
                case 'session.skill.activated':
                case 'session.instructions.updated':
                case 'session.shell.started':
                case 'session.shell.ended':
                case 'session.compaction.started':
                case 'session.compaction.ended':
                case 'session.compaction.failed':
                case 'session.message.content.updated': scheduleScope('history'); break;
              }
            } else if (event.type === 'location.shutdown') scheduleRefresh();
            const formSession = event.type === 'form.created' ? event.data.form.sessionID : event.type === 'form.replied' || event.type === 'form.cancelled' ? event.data.sessionID : undefined;
            if (formSession === sessionID || formSession === 'global' && (!event.location?.directory || event.location.directory === sessionDirectory.current)) scheduleScope('requests');
          }
          if (!controller.signal.aborted) throw new Error('The live connection closed');
        } catch (reason) {
          stream.flush();
          if (controller.signal.aborted) break;
          setStreamStatus('Reconnecting');
          if (attempts > 1) setFetchError(errorMessage(reason));
          await new Promise<void>(resolve => {
            retryResolve = resolve;
            retryTimer = setTimeout(resolve, Math.min(1000 * 2 ** attempts++, 15000));
          });
          if (!controller.signal.aborted) await refresh(controller.signal);
        }
      }
    })().catch(showError);
    return () => { stream.flush(); stream.clear(); if (flushStream.current === stream.flush) flushStream.current = () => {}; controller.abort(); clearTimeout(timer); clearTimeout(retryTimer); for (const pending of scopeTimers.values()) clearTimeout(pending); retryResolve?.(); };
  }, [client, sessionID, foreground, visible, refresh, showError, applyMessageSnapshot]);

  useEffect(() => {
    if (!session || !foreground || !visible) return;
    const controller = new AbortController();
    const location = { directory: session.location.directory };
    void Promise.allSettled([
      client.model.list({ location, types: ['chat'] }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setModels(value.data); }),
      client.agent.list({ location }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setAgents(value.data); }),
      client.command.list({ location }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setCommands(value.data); }),
      client.skill.list({ location }, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setSkills(value.data); }),
    ]).then(results => {
      const failed = results.find(result => result.status === 'rejected');
      if (!controller.signal.aborted) setCatalogError(failed?.status === 'rejected' ? errorMessage(failed.reason) : null);
    });
    return () => controller.abort();
  }, [client, session?.location.directory, sessionID, !!session, foreground, visible, catalogRevision, showError]);

  useEffect(() => {
    if (!foreground || !visible || !session?.time.idle) return;
    const controller = new AbortController();
    void client.session.view({ sessionID, idle: session.time.idle }, { signal: controller.signal }).then(() => { if (!controller.signal.aborted) onSessionChangedRef.current(); }).catch(reason => { if (!controller.signal.aborted) showError(reason); });
    return () => controller.abort();
  }, [client, sessionID, session?.time.idle, foreground, visible, showError]);

  useEffect(() => {
    if (session?.location.directory) onSessionChangedRef.current();
  }, [session?.location.directory]);

  useEffect(() => {
    if (!attachmentPath) { consumedAttachment.current = null; return; }
    if (!draftLoaded || (consumedAttachment.current?.path === attachmentPath && consumedAttachment.current.context === attachmentContext)) return;
    try {
      if (attachmentContext !== undefined) {
        if (attachmentContext) setDraft(current => current ? `${current}\n\n${attachmentContext}` : attachmentContext);
      } else {
        const uri = serverFileUri(attachmentPath);
        setAttachments(current => current.some(file => file.uri === uri) ? current : [...current, { uri, name: attachmentPath.split('/').pop() }]);
      }
      consumedAttachment.current = { path: attachmentPath, context: attachmentContext };
      onAttachmentConsumed?.();
    } catch (reason) { showError(reason); }
  }, [attachmentPath, attachmentContext, onAttachmentConsumed, showError, draftLoaded]);

  const run = useCallback(async (action: () => Promise<unknown>, closePanel = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      if (alive.current) {
        if (closePanel) setPanel(null);
        void refresh().catch(showError);
        onSessionChanged();
      }
    } catch (reason) { showError(reason); }
    finally { submitting.current = false; if (alive.current) setPending(false); }
  }, [refresh, onSessionChanged, showError]);

  const send = async () => {
    if (!draftLoaded) return;
    if (!draft.trim() && !attachments.length && !selectedSkills.length && !restoredSkillIDs.length && !selectedAgentIDs.length) return;
    const btw = /^\/btw(?:\s+([\s\S]*))?$/.exec(draft.trim());
    if (btw) {
      if (attachments.length || selectedSkills.length || restoredSkillIDs.length || selectedAgentIDs.length) { showError(new Error('Side questions use the current session context. Remove unsent files, agents, or skills first.')); return; }
      setSideQuestion(btw[1] || '');
      setPanel('btw');
      return;
    }
    const sentText = draft;
    const sentAttachments = attachments;
    const sentSkills = selectedSkills;
    const sentSkillIDs = [...new Set([...sentSkills.map(skill => skill.id), ...restoredSkillIDs])];
    const sentAgentIDs = selectedAgentIDs;
    if (submitting.current) return;
    setSending(true);
    try {
    await run(async () => {
      const submission = parseComposer(sentText, commands.map(command => command.name));
      if (submission.type === 'shell') {
        if (sentAttachments.length || sentSkillIDs.length || sentAgentIDs.length) throw new Error('Shell commands cannot include attachments, agents, or skills');
        await client.session.shell({ sessionID, command: submission.command });
      } else {
        const common = { sessionID, files: sentAttachments, skills: sentSkillIDs.map(id => ({ id })), agents: sentAgentIDs.map(name => ({ name })), delivery };
        if (submission.type === 'command') await client.session.command({ ...common, name: submission.name, text: submission.text });
        else await client.session.prompt({ ...common, text: submission.text });
      }
      if (alive.current) {
        setDraft(current => current === sentText ? '' : current);
        setAttachments(current => current.filter(file => !sentAttachments.includes(file)));
        setSelectedSkills(current => current.filter(skill => !sentSkills.includes(skill)));
        setRestoredSkillIDs(current => current.filter(id => !sentSkillIDs.includes(id)));
        setSelectedAgentIDs(current => current.filter(id => !sentAgentIDs.includes(id)));
        jumpToLatest();
        const latest = draftRef.current;
        await saveDraft(draftKey, { ...latest, text: latest.text === sentText ? '' : latest.text, files: latest.files.filter(file => !sentAttachments.includes(file)), skillIDs: latest.skillIDs.filter(id => !sentSkillIDs.includes(id)), agentIDs: latest.agentIDs.filter(id => !sentAgentIDs.includes(id)) }).catch(reason => showError(new Error(`Message sent. Draft save failed: ${errorMessage(reason)}`)));
      }
    });
    } finally { if (alive.current) setSending(false); }
  };

  const interrupt = () => run(async () => {
    setStopping(true);
    try { await client.session.interrupt({ sessionID }); }
    catch (reason) { if (alive.current) setStopping(false); throw reason; }
  });
  useEffect(() => { if (!active) setStopping(false); }, [active]);

  const attachDevice = async () => {
    if (!draftLoaded || !alive.current || devicePickerActive.current) return;
    devicePickerActive.current = true;
    try {
      const result = await withNativePresentation(() => DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true }));
      if (result.canceled) return;
      const files: Attachment[] = [];
      for (const asset of result.assets) {
        if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error(`${asset.name} exceeds the 10 MB attachment limit`);
        let base64: string;
        if (Platform.OS === 'web' && asset.file) {
          base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(`Cannot read ${asset.name}`)); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.readAsDataURL(asset.file!); });
        } else base64 = await new File(asset.uri).base64();
        if (base64.length > 14 * 1024 * 1024) throw new Error(`${asset.name} exceeds the 10 MB attachment limit`);
        files.push({ uri: `data:${asset.mimeType || 'application/octet-stream'};base64,${base64}`, name: asset.name });
      }
      if (alive.current) setAttachments(current => [...current, ...files]);
    } catch (reason) { showError(reason); }
    finally { devicePickerActive.current = false; }
  };

  const queueDevicePicker = () => {
    if (!draftLoaded || queuedDevicePicker.current || devicePickerActive.current) return;
    queuedDevicePicker.current = true;
    Keyboard.dismiss();
    setPanel(null);
  };
  const toolsDismissed = () => {
    if (!queuedDevicePicker.current) return;
    queuedDevicePicker.current = false;
    if (alive.current && visible && foreground) void attachDevice();
  };

  const loadOlder = async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    const historyVersion = historyEpoch.current;
    try {
      const page = await client.message.list({ sessionID, cursor, limit: 80 });
      if (alive.current && historyVersion === historyEpoch.current) { setMessages(current => mergeMessages(page.data, current)); setCursor(page.data.length === 80 ? page.cursor.next ?? undefined : undefined); }
    } catch (reason) { showError(reason); }
    finally { if (alive.current) setLoadingOlder(false); }
  };

  const editInbox = (item: SessionInboxInfo) => run(async () => {
    if (!draftLoaded) return;
    if (item.type !== 'user' && item.type !== 'synthetic') return;
    if ((draft || attachments.length || selectedSkills.length || restoredSkillIDs.length || selectedAgentIDs.length) && !await confirmAction('Replace the message draft?', 'This opens the pending input in the composer and replaces the current draft.')) return;
    await client.session.inbox.cancel({ sessionID, inboxID: item.id });
    if (!alive.current) return;
    setDraft(item.payload.text);
    setDelivery(item.delivery);
    if (item.type === 'user') {
      setAttachments((item.payload.files ?? []).map(file => ({ uri: file.source.type === 'uri' ? file.source.uri : `data:${file.mime};base64,${file.data}`, name: file.name })));
      setSelectedSkills(skills.filter(skill => item.payload.skills?.some(selected => selected.id === skill.id)));
      setRestoredSkillIDs((item.payload.skills ?? []).filter(selected => !skills.some(skill => skill.id === selected.id)).map(skill => skill.id));
      setSelectedAgentIDs((item.payload.agents ?? []).map(agent => agent.name));
    } else { setAttachments([]); setSelectedSkills([]); setRestoredSkillIDs([]); setSelectedAgentIDs([]); }
  });

  const editMessage = async (message: Extract<SessionMessageInfo, { type: 'user' }>) => {
    if (!draftLoaded) return;
    if ((draft || attachments.length || selectedSkills.length || restoredSkillIDs.length || selectedAgentIDs.length) && !await confirmAction('Replace the message draft?', 'This opens the earlier message in the composer and replaces the current draft.')) return;
    if (!alive.current) return;
    setDraft(message.text);
    setAttachments((message.files ?? []).map(file => ({ uri: file.source.type === 'uri' ? file.source.uri : `data:${file.mime};base64,${file.data}`, name: file.name })));
    setSelectedSkills(skills.filter(skill => message.skills?.some(selected => selected.id === skill.id)));
    setRestoredSkillIDs((message.skills ?? []).filter(selected => !skills.some(skill => skill.id === selected.id)).map(skill => skill.id));
    setSelectedAgentIDs((message.agents ?? []).map(agent => agent.name));
    setSelectedMessageID(null);
    setPanel(null);
  };

  const inspect = async (target: 'diff' | 'context') => {
    setPanel(target);
    setPanelLoading(true);
    try {
      if (target === 'diff') {
        const value = await client.session.diff({ sessionID });
        if (alive.current) setDiffs(value);
      } else {
        const value = await client.session.context({ sessionID });
        if (alive.current) setContext(value);
      }
    } catch (reason) { showError(reason); }
    finally { if (alive.current) setPanelLoading(false); }
  };

  const exportSession = () => run(async () => {
    const value = await client.experimental.session.export({ sessionID });
    const content = JSON.stringify(value, null, 2);
    const filename = `${sessionID.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      const file = new File(Paths.cache, filename);
      await file.write(content);
      if (await Sharing.isAvailableAsync()) await withNativePresentation(() => Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: session?.title || 'OpenCode session' }));
      else await withNativePresentation(() => Share.share({ title: session?.title || 'OpenCode session', message: content }));
    }
  });

  const currentModel = useMemo(() => models.find(model => model.id === session?.model?.id && model.providerID === session?.model.providerID), [models, session?.model?.id, session?.model?.providerID]);
  const actionMessage = selectedMessageID ? messages.find(message => message.id === selectedMessageID) : undefined;
  const enabledModels = useMemo(() => models.filter(model => model.enabled), [models]);
  const preferredIDs = modelFilter === 'favorites' ? modelPreferences.favoriteIDs : modelPreferences.recentIDs;
  const scopedModels = useMemo(() => modelFilter === 'all' ? enabledModels : enabledModels.filter(model => preferredIDs.includes(modelPreferenceID(model.providerID, model.id))).sort((a, b) => preferredIDs.indexOf(modelPreferenceID(a.providerID, a.id)) - preferredIDs.indexOf(modelPreferenceID(b.providerID, b.id))), [enabledModels, modelFilter, preferredIDs]);
  const filteredModels = useMemo(() => scopedModels.filter(model => `${model.name} ${model.providerID} ${model.id}`.toLowerCase().includes(modelSearch.toLowerCase())), [scopedModels, modelSearch]);
  const hasPrompt = !!draft.trim() || attachments.length > 0 || selectedSkills.length > 0 || restoredSkillIDs.length > 0 || selectedAgentIDs.length > 0;
  useEffect(() => {
    setStopReady(false);
    if (!active || hasPrompt) return;
    const timer = setTimeout(() => setStopReady(true), 400);
    return () => clearTimeout(timer);
  }, [active, hasPrompt]);
  const activity = useMemo(() => sessionActivity(messages, active, sessionStatus, permissions.filter(permission => permission.sessionID === sessionID).length, forms.filter(form => form.sessionID === sessionID).length), [messages, active, sessionStatus, permissions, forms, sessionID]);
  const showActivityBar = streamStatus !== 'Live' || stopping || ['retry', 'approval', 'question', 'error'].includes(activity.kind);
  const showHeaderActivity = active && !showActivityBar && (awayFromLatest || !['thinking', 'tool', 'writing'].includes(activity.kind));
  const latestStep = messages.findLast(message => ['assistant', 'idle', 'user', 'shell', 'compaction'].includes(message.type));
  const liveMessageID = active && latestStep?.type === 'assistant' && latestStep.time.completed === undefined && !latestStep.error ? latestStep.id : undefined;
  const chooseModel = (model: ModelInfo, variant?: string) => run(async () => {
    await client.session.switchModel({ sessionID, model: { id: model.id, providerID: model.providerID, ...(variant === undefined ? {} : { variant }) } });
    await modelPreferences.recordRecent(model.providerID, model.id);
  });
  const messageDirectory = session?.location.directory || '';
  const transcriptMessages = useMemo(() => messages.filter(message => message.type !== 'idle' || !!message.error), [messages]);
  const renderMessage = useCallback(({ item }: { item: SessionMessageInfo }) => <MessageRow message={item} live={item.id === liveMessageID} activityKind={item.id === liveMessageID ? activity.kind : undefined} animate={visible && foreground && streamStatus === 'Live'} onSelect={selectMessage} selected={item.id === selectedMessageID} selectionActive={!!selectedMessageID} screenReader={screenReader} client={client} directory={messageDirectory} />, [selectMessage, selectedMessageID, screenReader, client, messageDirectory, liveMessageID, activity.kind, visible, foreground, streamStatus]);
  const canCopySelected = actionMessage?.type === 'assistant' ? actionMessage.content.some(part => part.type === 'text' && !!part.text) : !!actionMessage;
  const copySelected = () => { if (actionMessage) { const messageID = actionMessage.id; const text = messageText(actionMessage); if (text) void Clipboard.setStringAsync(text).then(() => { if (alive.current) setSelectedMessageID(current => current === messageID ? null : current); }).catch(showError); } };

  if (!session) return <View style={styles.container}><View style={styles.header}>{onOpenNavigation && <ChatIconButton name="menu" label="Open navigation" onPress={onOpenNavigation} />}<View style={styles.headerTitle}><Label numberOfLines={1} style={styles.sessionTitle}>{loading ? 'Loading session' : 'Session unavailable'}</Label><Label numberOfLines={1} muted style={styles.projectLabel}>{projectLabel || 'OpenCode'}</Label></View></View>{loading ? <Busy /> : <View style={{ padding: 16 }}><ErrorNotice error={error || fetchError || 'The session is unavailable'} onRetry={() => { void refresh(); }} /></View>}</View>;
  return <View style={styles.frame}><KeyboardAvoidingView style={styles.container} behavior="padding" automaticOffset enabled={visible && !panel}>
    <MotionContent variant="context" transitionKey={!!actionMessage} style={[styles.header, !!actionMessage && styles.selectionHeader]}>{actionMessage ? <><ChatIconButton name="close" label="Close message selection" onPress={() => setSelectedMessageID(null)} /><Label accessibilityRole="header" style={styles.selectionCount}>1 selected</Label><Button title="Copy" compact variant="ghost" disabled={!canCopySelected} onPress={copySelected} />{actionMessage.type === 'user' ? <Button title="Edit" compact variant="ghost" disabled={!draftLoaded || pending} onPress={() => { void editMessage(actionMessage); }} /> : <Button title="Fork" compact variant="ghost" disabled={pending} onPress={() => { void run(async () => { const next = await client.session.fork({ sessionID, before: actionMessage.id }); onOpenSession(next.id); }); }} />}<ChatIconButton name="more" label="Selected message actions" onPress={() => setPanel('message')} /></> : <>
      {onOpenNavigation && <ChatIconButton name="menu" label="Open navigation" onPress={onOpenNavigation} />}
      <View style={styles.headerTitle}><Label numberOfLines={1} accessibilityLabel={session.title || 'New session'} style={styles.sessionTitle}>{session.title || 'New session'}</Label><View style={styles.headerSubtitle}>{showHeaderActivity && <WorkingIndicator active={visible && foreground} color={colors.muted} size={12} />}<Label numberOfLines={1} muted style={styles.projectLabel}>{showHeaderActivity ? activity.label : projectLabel || session.location.directory.split('/').filter(Boolean).pop() || session.location.directory}</Label></View></View>
      <ChatIconButton name="more" label="Session actions" onPress={() => setPanel('actions')} />
    </>}</MotionContent>
    {error && <View style={styles.errorBanner}><ErrorNotice error={error} /><Button title="Dismiss" compact variant="ghost" onPress={() => setError(null)} /></View>}
    {(fetchError || catalogError || Object.values(syncErrors)[0]) && <View style={styles.errorBanner}><ErrorNotice error={fetchError || catalogError || Object.values(syncErrors)[0]} onRetry={() => { setCatalogRevision(value => value + 1); void refresh(); }} /></View>}
    {session.revert && <View style={styles.revert}><Label>A revert is staged</Label><Label muted>Later messages are excluded from the context.</Label><Row><Button title="Restore" compact onPress={() => { void run(() => client.session.revert.clear({ sessionID })); }} /><Button title="Commit revert" compact variant="danger" disabled={pending} onPress={() => { void run(async () => { if (await confirmAction('Commit this revert?', 'This permanently removes messages after the revert point.')) { await client.session.revert.commit({ sessionID }); historyEpoch.current++; liveMessages.current.clear(); } }); }} /></Row></View>}
    <MessageDisclosureContext.Provider value={disclosures}><View style={styles.transcriptFrame}><FlashList ref={list} data={transcriptMessages} keyExtractor={messageKey} getItemType={messageType} renderItem={renderMessage} ItemSeparatorComponent={MessageSeparator} maintainVisibleContentPosition={maintainPosition}
      style={styles.transcript} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} onLoad={listLoaded} onContentSizeChange={contentSizeChanged} onLayout={transcriptLayoutChanged}
      onScroll={updateScrollPosition} scrollEventThrottle={16} onScrollBeginDrag={beginUserScroll} onScrollEndDrag={finishUserScroll} onMomentumScrollBegin={beginUserScroll} onMomentumScrollEnd={finishUserScroll}
      ListHeaderComponent={cursor ? <Button title="Load earlier messages" variant="ghost" compact busy={loadingOlder} onPress={() => { setFollowing(false); void loadOlder(); }} /> : undefined}
      ListEmptyComponent={<Empty title="Start something good" detail="Ask a question, describe a change, or attach a file from your project." />}
      ListFooterComponent={<View style={{ gap: 12 }}>
        {inbox.length > 0 && <Card><Label muted style={styles.eyebrow}>PENDING INPUTS · {inbox.length}</Label>{inbox.map(item => <View key={item.id} style={{ gap: 8 }}>{item.type === 'synthetic' ? <Disclosure disclosureKey={item.id} title={item.payload.description || 'Server context'}><MessageText text={item.payload.text} /></Disclosure> : <Label numberOfLines={3}>{item.type === 'user' ? item.payload.text : item.type === 'compaction' ? 'Compact context' : 'Move session'}</Label>}<Row><Label muted>{item.delivery === 'steer' ? 'Steer current work' : 'After current work'}</Label><Button disabled={pending} title={item.delivery === 'steer' ? 'Queue' : 'Steer'} compact onPress={() => { void run(() => client.session.inbox.update({ sessionID, inboxID: item.id, delivery: item.delivery === 'steer' ? 'queue' : 'steer' })); }} />{(item.type === 'user' || item.type === 'synthetic') && <Button title="Edit" compact disabled={!draftLoaded || pending} onPress={() => { void editInbox(item); }} />}<Button title="Cancel" compact variant="ghost" disabled={pending} onPress={() => { void run(() => client.session.inbox.cancel({ sessionID, inboxID: item.id })); }} /></Row></View>)}</Card>}
        <SessionForms client={client} sessionID={sessionID} forms={forms} permissions={permissions} onChanged={refreshRef.current} onError={showError} locationDirectory={session.location.directory} />
      </View>}
    />{!followingLatest && awayFromLatest && activity.kind !== 'approval' && activity.kind !== 'question' && <View pointerEvents="box-none" style={styles.latestButton}><ChatIconButton name="down" label="Jump to latest" raised onPress={jumpToLatest} /></View>}</View></MessageDisclosureContext.Provider>
    <View style={styles.composerDock}><AgentActivityBar activity={activity} connectionStatus={streamStatus} sending={sending} stopping={stopping} animate={visible && foreground} show={showActivityBar} onReview={jumpToLatest} /><View style={styles.composer}>
      {!draftLoaded ? <Busy /> : <>
      {(attachments.length > 0 || selectedSkills.length > 0 || restoredSkillIDs.length > 0 || selectedAgentIDs.length > 0) && <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
        {attachments.map((file, index) => <Button key={`${file.name}-${index}`} title={`${file.name || 'File'} ×`} compact onPress={() => setAttachments(current => current.filter((_, i) => i !== index))} />)}
        {selectedSkills.map(skill => <Button key={skill.id} title={`${skill.name} ×`} compact onPress={() => setSelectedSkills(current => current.filter(item => item.id !== skill.id))} />)}
        {restoredSkillIDs.map(id => <Button key={id} title={`${id} ×`} compact onPress={() => setRestoredSkillIDs(current => current.filter(value => value !== id))} />)}
        {selectedAgentIDs.map(id => <Button key={id} title={`@${agents.find(agent => agent.id === id)?.name || id} ×`} compact onPress={() => setSelectedAgentIDs(current => current.filter(value => value !== id))} />)}
      </ScrollView>}
      <Field accessibilityLabel="Message" placeholder="Ask OpenCode…" multiline value={draft} onChangeText={setDraft} onContentSizeChange={updateComposerHeight} onFocus={() => setSelectedMessageID(null)} style={[styles.composerInput, { height: draft ? composerHeight : 44 }]} />
      <View style={styles.composerToolbar}><ChatIconButton name="plus" label="Message tools" onPress={() => setPanel('tools')} /><Pressable accessibilityRole="button" accessibilityLabel={`Choose model, ${currentModel?.name || session.model?.id || 'Server default'}`} onPress={() => setPanel('models')} style={({ pressed }) => [styles.modelTrigger, pressed && { opacity: 0.6 }]}><Label numberOfLines={1} style={styles.modelTriggerText}>{currentModel?.name || session.model?.id || 'Server default'}</Label><ChatGlyph name="down" size={14} color={colors.muted} /></Pressable>{active && hasPrompt && <Button title={delivery === 'steer' ? 'Steer' : 'Queue'} accessibilityLabel="Message delivery" compact variant="ghost" onPress={() => setDelivery(value => value === 'steer' ? 'queue' : 'steer')} />}<ChatIconButton name={active && !hasPrompt ? 'stop' : 'up'} label={active && !hasPrompt ? 'Stop generation' : active && delivery === 'queue' ? 'Queue message' : 'Send message'} raised busy={pending} disabled={active && !hasPrompt ? !stopReady || stopping : !hasPrompt} onPress={() => { if (active && !hasPrompt) void interrupt(); else void send(); }} /></View>
      </>}
    </View></View>
    <Sheet visible={panel === 'actions'} title="Session" onClose={() => setPanel(null)}>
      <Label selectable style={{ fontSize: 18, lineHeight: 25 }}>{session.title || 'New session'}</Label>
      <ErrorNotice error={error} />
      <Label muted>Tools</Label>
      <View><PanelLink title="File changes" onPress={() => { void inspect('diff'); }} /><PanelLink title="Background commands" onPress={() => { setBackgroundShellID(undefined); setBackgroundDirectory(undefined); setPanel('background'); }} /><PanelLink title="Child sessions" onPress={() => setPanel('children')} /><PanelLink title="Side question · /btw" onPress={() => { setSideQuestion(undefined); setPanel('btw'); }} /></View>
      <Label muted>Configure</Label>
      <View><PanelLink title={`Agent · ${agents.find(agent => agent.id === session.agent)?.name || session.agent || 'Server default'}`} onPress={() => setPanel('agents')} /><PanelLink title="Model" onPress={() => setPanel('models')} /><PanelLink title="Instructions" onPress={() => setPanel('instructions')} /><PanelLink title="Schedules" onPress={() => setPanel('schedules')} /></View>
      <Label muted>Details</Label>
      <View><PanelLink title="Session statistics" onPress={() => setPanel('stats')} /><PanelLink title="Agent context" onPress={() => { void inspect('context'); }} /><PanelLink title="Export session" onPress={() => { void exportSession(); }} /></View>
      <Disclosure title="Manage session"><Field label="Session title" value={title} onChangeText={setTitle} /><Button title="Rename" disabled={!title.trim()} busy={pending} onPress={() => { void run(() => client.session.update({ sessionID, title: title.trim() }), true); }} /><Field label="Move to server directory" placeholder="/path/to/project" value={moveDirectory} onChangeText={setMoveDirectory} /><Button title="Move session" disabled={!moveDirectory.startsWith('/') || pending} onPress={() => { void run(() => client.session.move({ sessionID, directory: moveDirectory, delivery }), true); }} /><Button title="Fork session" disabled={pending} onPress={() => { void run(async () => { const next = await client.session.fork({ sessionID }); onOpenSession(next.id); }, true); }} /><Button title="Compact context" disabled={pending} onPress={() => { void run(() => client.session.compact({ sessionID, delivery: 'queue' }), true); }} />{active && <Button title="Background blocking tools" disabled={pending} onPress={() => { void run(() => client.session.background({ sessionID }), true); }} />}{(session.parentID || session.fork?.sessionID) && <Button title="Open source session" onPress={() => { setPanel(null); onOpenSession(session.parentID || session.fork!.sessionID); }} />}<Button title={session.time.archived ? 'Unarchive session' : 'Archive session'} disabled={pending} onPress={() => { void run(() => client.session.update({ sessionID, archived: !session.time.archived }), true); }} /><Button title="Delete session" variant="danger" disabled={pending} onPress={() => { void run(async () => { if (await confirmAction('Delete this session?', 'This permanently deletes this session and its messages.')) { await client.session.remove({ sessionID }); onOpenSession(''); } }, true); }} /></Disclosure>
      <Disclosure title="Raw session details"><JsonView value={session} /></Disclosure>
    </Sheet>
    <Sheet visible={panel === 'models'} title="Choose model" scroll={false} onClose={() => setPanel(null)}>
      {panel === 'models' && <View style={{ flex: 1, minHeight: 0 }}><View style={styles.modelSearch}><Field label="Search models" value={modelSearch} onChangeText={setModelSearch} placeholder="Model or provider" /><Row><Button title="All" compact selected={modelFilter === 'all'} onPress={() => setModelFilter('all')} /><Button title="Favorites" compact selected={modelFilter === 'favorites'} onPress={() => setModelFilter('favorites')} /><Button title="Recent" compact selected={modelFilter === 'recent'} onPress={() => setModelFilter('recent')} /></Row><ErrorNotice error={error || catalogError || modelPreferences.error} onRetry={() => { modelPreferences.reload(); setCatalogRevision(value => value + 1); }} /></View>
      <FlatList data={filteredModels} keyExtractor={model => `${model.providerID}/${model.id}`} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5} contentContainerStyle={styles.modelList}
        ListHeaderComponent={currentModel?.variants.length ? <View style={styles.variants}><Label muted>Variant · {currentModel.name}</Label><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}><Button title="Model default" compact selected={!session.model?.variant} disabled={pending} onPress={() => { void chooseModel(currentModel); }} />{currentModel.variants.map(variant => <Button key={variant.id} title={variant.id} selected={session.model?.variant === variant.id} compact disabled={pending} onPress={() => { void chooseModel(currentModel, variant.id); }} />)}</ScrollView></View> : undefined}
        renderItem={({ item: model }) => { const selected = session.model?.id === model.id && session.model.providerID === model.providerID; const favorite = modelPreferences.favoriteIDs.includes(modelPreferenceID(model.providerID, model.id)); return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: pending }} disabled={pending} onPress={() => { if (!selected) void chooseModel(model); }} style={({ pressed }) => [styles.modelRow, selected && { backgroundColor: colors.selected }, pressed && { opacity: 0.6 }]}><View style={{ flex: 1, minWidth: 0 }}><Label numberOfLines={2} style={{ fontWeight: '500' }}>{model.name}</Label><Label muted numberOfLines={1} style={{ fontSize: 12 }}>{model.providerID} · {model.limit.context.toLocaleString()} context</Label></View><ChatIconButton name="star" label={`${favorite ? 'Remove' : 'Add'} ${model.name} ${favorite ? 'from' : 'to'} favorites`} selected={favorite} disabled={!serverID || modelPreferences.loading || modelPreferences.saving} onPress={() => { void modelPreferences.toggleFavorite(model.providerID, model.id); }} /><View style={styles.radio}>{selected && <View style={styles.radioDot} />}</View></Pressable>; }}
        ListEmptyComponent={<View style={{ padding: 20, gap: 12 }}><Empty title={!enabledModels.length ? 'No connected models' : modelFilter !== 'all' && !scopedModels.length ? modelFilter === 'favorites' ? 'No favorite models' : 'No recent models' : 'No models match'} detail={!enabledModels.length ? 'Connect a provider in Settings, then refresh this list.' : modelFilter === 'favorites' && !scopedModels.length ? 'Tap the star beside a model to save it here.' : modelFilter === 'recent' && !scopedModels.length ? 'Models appear here after you select them.' : 'Try a model name or provider.'} />{enabledModels.length ? <Row>{modelSearch && <Button title="Clear search" onPress={() => setModelSearch('')} />}{modelFilter !== 'all' && <Button title="Show all models" onPress={() => setModelFilter('all')} />}</Row> : <><Button title="Refresh models" onPress={() => setCatalogRevision(value => value + 1)} />{onOpenNavigation && <Button title="Open navigation" onPress={() => { setPanel(null); onOpenNavigation(); }} />}</>}</View>} />
      </View>}
    </Sheet>
    <Sheet visible={panel === 'agents'} title="Choose agent" onClose={() => setPanel(null)}><ErrorNotice error={error} />{agents.filter(agent => !agent.hidden && agent.mode !== 'subagent').map(agent => <Card key={agent.id}><Label style={{ fontWeight: '600' }}>{agent.name}</Label>{agent.description && <Label muted>{agent.description}</Label>}<Button title={session.agent === agent.id ? 'Selected' : 'Use agent'} selected={session.agent === agent.id} disabled={pending} onPress={() => { void run(() => client.session.switchAgent({ sessionID, agent: agent.id }), true); }} /></Card>)}</Sheet>
    <Sheet visible={panel === 'tools'} title="Message tools" onClose={() => setPanel(null)} onDismiss={toolsDismissed}><Button title="Attach from device" disabled={!draftLoaded} onPress={queueDevicePicker} /><Button title="Files & agents" disabled={!draftLoaded} onPress={() => setPanel('mentions')} /><Button title="MCP resource references" disabled={!draftLoaded} onPress={() => setPanel('resources')} /><Button title="Commands & skills" disabled={!draftLoaded} onPress={() => setPanel('commands')} /><Button title="Ask a side question · /btw" onPress={() => { setSideQuestion(undefined); setPanel('btw'); }} /><Button title={`Agent: ${agents.find(agent => agent.id === session.agent)?.name || session.agent || 'Choose agent'}`} onPress={() => setPanel('agents')} /><Label muted>Message delivery</Label><Row><Button title="Steer current work" selected={delivery === 'steer'} onPress={() => setDelivery('steer')} /><Button title="Queue after current work" selected={delivery === 'queue'} onPress={() => setDelivery('queue')} /></Row><Label muted>Start a message with ! to run a shell command on the server.</Label></Sheet>
    <Sheet visible={panel === 'message'} title="Message" fitContent onClose={() => { queuedMessagePanel.current = null; setPanel(null); }} onDismiss={() => {
      const target = queuedMessagePanel.current;
      queuedMessagePanel.current = null;
      if (target && alive.current && panel === null && selectedMessageID) setPanel(target);
    }}><ErrorNotice error={error} />{actionMessage && <>
      <Button title="Select text" onPress={() => { setTextSelectionMessage(actionMessage); queuedMessagePanel.current = 'selectText'; setPanel(null); }} />
      {'text' in actionMessage && <Button title="Copy message" onPress={() => { void Clipboard.setStringAsync(actionMessage.text).then(() => setPanel(null)).catch(showError); }} />}
      {actionMessage.type === 'assistant' && <Button title="Copy response" onPress={() => { void Clipboard.setStringAsync(actionMessage.content.filter(part => part.type === 'text').map(part => part.text).join('\n\n')).then(() => setPanel(null)).catch(showError); }} />}
      {actionMessage.type === 'user' && <Button title="Edit & resend" disabled={!draftLoaded} onPress={() => { void editMessage(actionMessage); }} />}
      {actionMessage.type === 'shell' && <Button title="Full command output" onPress={() => {
        const index = messages.findIndex(message => message.id === actionMessage.id);
        const nextMove = messages.slice(index + 1).find((message): message is Extract<SessionMessageInfo, { type: 'location-switched' }> => message.type === 'location-switched');
        setBackgroundShellID(actionMessage.shellID);
        setBackgroundDirectory(nextMove?.previous?.location.directory ?? session.location.directory);
        queuedMessagePanel.current = 'background';
        setPanel(null);
      }} />}
      <Button title="Fork before this message" disabled={pending} onPress={() => { void run(async () => { const next = await client.session.fork({ sessionID, before: actionMessage.id }); onOpenSession(next.id); }, true); }} />
      {actionMessage.type === 'user' && <Button title="Undo from this message" disabled={pending || active} onPress={() => { void run(async () => { if (await confirmAction('Undo from this message?', 'The server will stage a revert of later messages and file changes. You can restore the staged changes.')) await client.session.revert.stage({ sessionID, messageID: actionMessage.id, files: true }); }, true); }} />}
    </>}</Sheet>
    <Sheet visible={panel === 'selectText'} title="Select text" onClose={() => { setPanel(null); setTextSelectionMessage(null); }}>{textSelectionMessage && <MessageRow message={textSelectionMessage} client={client} directory={session.location.directory} />}</Sheet>
    <Sheet visible={panel === 'commands'} title="Commands & skills" onClose={() => setPanel(null)}>
      <Label muted>Commands run on the server. Skills join your next message.</Label>
      <Card><Label style={{ fontFamily: mono }}>/btw</Label><Label muted>Ask about this session without a change to its history.</Label><Button title="Use side question" compact disabled={!draftLoaded} onPress={() => { setDraft('/btw '); setPanel(null); }} /></Card>
      {commands.map(command => <Card key={command.name}><Label style={{ fontFamily: mono }}>/{command.name}</Label>{command.description && <Label muted>{command.description}</Label>}<Button title="Use command" compact onPress={() => { setDraft(`/${command.name} `); setPanel(null); }} /></Card>)}
      {skills.map(skill => <Card key={skill.id}><Label>{skill.name}</Label>{skill.description && <Label muted>{skill.description}</Label>}<Button title="Attach skill" compact onPress={() => { setSelectedSkills(current => current.some(item => item.id === skill.id) ? current : [...current, skill]); setPanel(null); }} /></Card>)}
      {!commands.length && !skills.length && <Empty title="No commands or skills" detail="Your server exposes its configured commands and skills here." />}
    </Sheet>
    <Sheet visible={panel === 'mentions'} title="Files & agents" onClose={() => setPanel(null)}><Label muted>Attach files from the server or ask a subagent to help.</Label><Field label="Find a server file" value={fileQuery} onChangeText={setFileQuery} placeholder="Path or filename" />{fileSearchBusy && <Busy />}{fileResults.map(file => <Button key={file.path} title={file.path} onPress={() => { const path = `${session.location.directory.replace(/\/$/, '')}/${file.path}`; const uri = serverFileUri(path); setAttachments(current => current.some(item => item.uri === uri) ? current : [...current, { uri, name: file.path }]); setPanel(null); }} />)}<Heading>Agents</Heading>{agents.filter(agent => !agent.hidden).map(agent => <Card key={agent.id}><Label>{agent.name}</Label>{agent.description && <Label muted>{agent.description}</Label>}<Button title="Mention agent" compact onPress={() => { setSelectedAgentIDs(current => current.includes(agent.id) ? current : [...current, agent.id]); setPanel(null); }} /></Card>)}</Sheet>
    <Sheet visible={panel === 'diff'} title="Session changes" onClose={() => setPanel(null)}>{panelLoading ? <Busy /> : diffs.length ? diffs.map(diff => <Card key={diff.file}><Label style={{ fontFamily: mono }}>{diff.file}</Label><Row><Label style={{ color: colors.success }}>+{diff.additions}</Label><Label style={{ color: colors.danger }}>−{diff.deletions}</Label><Label muted>{diff.status}</Label></Row><CodeBlock code={diff.patch} />{diff.more && <Label muted>The server truncated this diff.</Label>}</Card>) : <Empty title="No file changes" />}</Sheet>
    <Sheet visible={panel === 'context'} title="Agent context" onClose={() => setPanel(null)}>{panelLoading ? <Busy /> : <><Label muted>{context.length} messages in the current context</Label>{context.map(message => <MessageRow key={message.id} message={message} client={client} directory={session.location.directory} />)}</>}</Sheet>
    <Sheet visible={panel === 'instructions'} title="Session instructions" onClose={() => setPanel(null)}>{panel === 'instructions' && <Instructions client={client} sessionID={sessionID} />}</Sheet>
    <Sheet visible={panel === 'schedules'} title="Session schedules" onClose={() => setPanel(null)}>{panel === 'schedules' && <Schedules client={client} sessionID={sessionID} />}</Sheet>
    <Sheet visible={panel === 'background'} title="Background commands" onClose={() => setPanel(null)}>{panel === 'background' && <BackgroundCommands client={client} sessionID={sessionID} directory={session.location.directory} initialShellID={backgroundShellID} initialDirectory={backgroundDirectory} />}</Sheet>
    <Sheet visible={panel === 'children'} title="Child sessions" onClose={() => setPanel(null)}>{panel === 'children' && <ChildSessions client={client} sessionID={sessionID} onOpenSession={id => { setPanel(null); onOpenSession(id); }} />}</Sheet>
    <Sheet visible={panel === 'stats'} title="Session statistics" onClose={() => setPanel(null)}>{panel === 'stats' && <SessionStats session={session} running={active} />}</Sheet>
    <Sheet visible={panel === 'btw'} title="Side question" onClose={() => setPanel(null)}>{panel === 'btw' && <SideQuestion client={client} sessionID={sessionID} initialQuestion={sideQuestion} onQuestionConsumed={() => setSideQuestion(undefined)} />}</Sheet>
    <Sheet visible={panel === 'resources'} title="MCP resource references" onClose={() => setPanel(null)}>{panel === 'resources' && <McpResources client={client} location={{ directory: session.location.directory }} onAttachContext={text => { setDraft(current => current ? `${current}\n\n${text}` : text); setPanel(null); }} />}</Sheet>
  </KeyboardAvoidingView></View>;
}

function messageText(message: SessionMessageInfo): string {
  if ('text' in message) return message.text;
  if (message.type === 'assistant') return message.content.filter(part => part.type === 'text').map(part => part.text).join('\n\n');
  if (message.type === 'shell') return `$ ${message.command}${message.output?.output ? `\n${message.output.output}` : ''}`;
  if (message.type === 'compaction') return 'summary' in message ? message.summary : 'error' in message ? message.error.message : 'Context compaction';
  if (message.type === 'agent-switched') return `Agent: ${message.agent}`;
  if (message.type === 'model-switched') return `Model: ${message.model.id}`;
  if (message.type === 'location-switched') return `Directory: ${message.location.directory}`;
  return message.error?.message || message.outcome;
}

function messagePreview(message: SessionMessageInfo): string {
  if (message.type === 'assistant') {
    const first = message.content.find(part => part.type === 'text');
    return first?.type === 'text' && first.text ? first.text.slice(0, 240) : 'Assistant message';
  }
  return messageText(message).slice(0, 240);
}

type MessageRowProps = { message: SessionMessageInfo; live?: boolean; activityKind?: AgentActivity['kind']; animate?: boolean; onSelect?: (id: string) => void; selected?: boolean; selectionActive?: boolean; screenReader?: boolean; client: Client; directory: string };
const MessageRow = memo(function MessageRow({ message, live, activityKind, animate, onSelect, selected, selectionActive, screenReader, client, directory }: MessageRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const select = useCallback(() => onSelect?.(message.id), [onSelect, message.id]);
  const separateContent = screenReader || Platform.OS === 'web';
  if (message.type === 'idle' && !message.error) return null;
  if (!onSelect) return <MessageContent message={message} client={client} directory={directory} selectable />;
  return <Pressable nativeID={`chat-message-${message.id}`} accessible={!separateContent}
    accessibilityRole={separateContent ? undefined : 'button'} accessibilityLabel={separateContent ? undefined : messagePreview(message)}
    accessibilityHint={separateContent ? undefined : 'Long press to select this message. Message actions appear in the header.'}
    accessibilityState={separateContent ? undefined : { selected: !!selected }}
    accessibilityActions={separateContent ? undefined : [{ name: 'activate', label: 'Select message' }, { name: 'longpress', label: 'Select message' }]}
    onAccessibilityAction={separateContent ? undefined : () => onSelect(message.id)} focusable={!screenReader}
    onLongPress={() => onSelect(message.id)} onPress={selectionActive ? () => onSelect(message.id) : undefined}
    style={[styles.selectableMessage, selected && { backgroundColor: colors.selected }]}>
    <MessageActionsContext.Provider value={select}><MessageContent message={message} live={live} activityKind={activityKind} animate={animate} client={client} directory={directory} selectable={false} /></MessageActionsContext.Provider>
    {screenReader && <Button title="Message actions" compact variant="ghost" accessibilityLabel={`Message actions: ${messagePreview(message)}`} onPress={() => onSelect(message.id)} />}
  </Pressable>;
});

const MessageContent = memo(function MessageContent({ message, live, activityKind, animate, client, directory, selectable }: { message: SessionMessageInfo; live?: boolean; activityKind?: AgentActivity['kind']; animate?: boolean; client: Client; directory: string; selectable: boolean }) {
  const styles = useThemedStyles(createStyles);
  if (message.type === 'idle') return message.error ? <ErrorNotice error={message.error.message} /> : null;
  if (message.type === 'assistant') return <View style={styles.assistant}>{message.content.map((part, index) => <AssistantPart key={`${message.id}:${part.type === 'tool' ? part.id : index}`} detailsKey={`${message.id}:${part.type === 'tool' ? part.id : index}`} part={part} live={!!live && (part.type === 'tool' || index === message.content.length - 1)} activityKind={activityKind} animate={animate} client={client} directory={directory} selectable={selectable} />)}{message.error && <ErrorNotice error={message.error.message} />}</View>;
  if (message.type === 'user') return <View style={styles.userGroup}><View style={styles.user}><MessageText text={message.text} selectable={selectable} />{message.files?.map((file, index) => <View key={index} style={{ gap: 8 }}><Label muted style={{ fontFamily: mono, fontSize: 12 }}>↳ {file.name || file.mime}</Label>{file.mime.startsWith('image/') && <Image source={{ uri: `data:${file.mime};base64,${file.data}` }} style={{ height: 180, width: '100%', borderRadius: 10 }} resizeMode="contain" accessibilityLabel={file.name || 'Attached image'} />}</View>)}{message.skills?.map(skill => <Label key={skill.id} muted>Skill: {skill.name}</Label>)}</View></View>;
  if (message.type === 'shell') return <Disclosure disclosureKey={message.id} title={`$ ${message.command} · ${message.status}`}><CodeBlock code={message.output?.output || 'No output'} selectable={selectable} />{message.output?.truncated && <Label muted>Output truncated by the server</Label>}</Disclosure>;
  if (message.type === 'compaction') return <Disclosure disclosureKey={message.id} title={`Context compaction · ${message.status}`}>{'summary' in message && <MessageText text={message.summary} selectable={selectable} />}{'error' in message && <ErrorNotice error={message.error.message} />}</Disclosure>;
  if (message.type === 'agent-switched') return <Label muted style={styles.notice}>Agent → {message.agent}</Label>;
  if (message.type === 'model-switched') return <Label muted style={styles.notice}>Model → {message.model.id}{message.model.variant ? ` · ${message.model.variant}` : ''}</Label>;
  if (message.type === 'location-switched') return <Label muted style={styles.notice}>Directory → {message.location.directory}</Label>;
  if (message.type === 'skill') return <Disclosure disclosureKey={message.id} title={`Skill · ${message.name}`}><MessageText text={message.text} selectable={selectable} /></Disclosure>;
  return <Disclosure disclosureKey={message.id} title={message.description || message.type}><MessageText text={message.text} selectable={selectable} /></Disclosure>;
});

const AssistantPart = memo(function AssistantPart({ part, detailsKey, live, activityKind, animate, client, directory, selectable }: { part: SessionMessageAssistant['content'][number]; detailsKey: string; live: boolean; activityKind?: AgentActivity['kind']; animate?: boolean; client: Client; directory: string; selectable: boolean }) {
  const styles = useThemedStyles(createStyles);
  if (part.type === 'text') return <MessageText text={part.text} selectable={selectable} />;
  const waiting = activityKind === 'approval' || activityKind === 'question' || activityKind === 'retry';
  if (part.type === 'reasoning') {
    const thinking = live && !waiting && part.time?.completed === undefined;
    const duration = part.time?.completed === undefined ? undefined : Math.max(1, Math.round((part.time.completed - part.time.created) / 1000));
    return <ActivityDisclosure detailsKey={detailsKey} title={thinking ? 'Thinking' : duration ? `Thought for ${duration}s` : 'Thought process'} busy={thinking} animate={animate} thought><MessageText text={part.text} muted selectable={selectable} /></ActivityDisclosure>;
  }
  const pendingTool = part.state.status === 'streaming' || part.state.status === 'running';
  const busy = live && pendingTool && !waiting;
  const title = part.state.status === 'error' ? `Failed · ${part.name}` : part.state.status === 'completed' || busy ? toolActivityLabel(part) : live && waiting ? activityKind === 'approval' ? 'Waiting for approval' : activityKind === 'question' ? 'Waiting for your answer' : 'Waiting to retry' : `Unfinished · ${part.name}`;
  const input = part.state.status === 'streaming' ? undefined : part.state.input;
  const detail = input && [input.command, input.filePath, input.path, input.pattern, input.url].find(value => typeof value === 'string');
  return <ActivityDisclosure detailsKey={detailsKey} title={title} detail={typeof detail === 'string' ? detail : undefined} busy={busy} animate={animate} failed={part.state.status === 'error'} complete={part.state.status === 'completed'}><Label muted>Input</Label>{part.state.status === 'streaming' ? <CodeBlock code={part.state.input} selectable={selectable} /> : <Text selectable={selectable} style={styles.jsonText}>{JSON.stringify(part.state.input, null, 2)}</Text>}{'content' in part.state && part.state.content?.map((content, index) => content.type === 'text' ? <MessageText key={index} text={content.text} selectable={selectable} /> : <ArtifactContent key={index} content={content} client={client} directory={directory} />)}{part.state.status === 'error' && <ErrorNotice error={part.state.error.message} />}</ActivityDisclosure>;
});

function MessageText({ text, muted, selectable = true }: { text: string; muted?: boolean; selectable?: boolean }) {
  return <Markdown text={text} muted={muted} selectable={selectable} />;
}
function CodeBlock({ code, language, selectable = true }: { code: string; language?: string; selectable?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <View style={styles.code}><Row style={{ justifyContent: 'space-between', paddingHorizontal: 12 }}><Label muted style={{ fontSize: 11 }}>{language || 'TEXT'}</Label><Button title={copied ? 'Copied' : 'Copy'} compact variant="ghost" onPress={() => { void Clipboard.setStringAsync(code).then(() => setCopied(true)).catch(reason => setError(errorMessage(reason))); }} /></Row>{error && <ErrorNotice error={error} />}<ScrollView horizontal><Text selectable={selectable} style={styles.codeText}>{code}</Text></ScrollView></View>;
}

function PanelLink({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}><Label style={{ flex: 1 }}>{title}</Label><ShellIcon name="chevron" size={16} color={colors.muted} /></Pressable>;
}

type ChatIconName = 'menu' | 'more' | 'plus' | 'up' | 'down' | 'star' | 'stop' | 'close';
function ChatGlyph({ name, color, size = 20, selected }: { name: ChatIconName; color: string; size?: number; selected?: boolean }) {
  if (name === 'menu') return <ShellIcon name="menu" size={size} color={color} />;
  const path = { more: 'M5 12h.01M12 12h.01M19 12h.01', plus: 'M12 5v14M5 12h14', up: 'M12 19V5M6 11l6-6 6 6', down: 'M6 9l6 6 6-6', star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.2-.9Z', stop: 'M7 7h10v10H7Z', close: 'M6 6l12 12M18 6 6 18' }[name];
  return <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><Path d={path} stroke={color} strokeWidth={name === 'more' ? 3 : 1.6} strokeLinecap="round" strokeLinejoin="round" fill={name === 'stop' || name === 'star' && selected ? color : 'none'} /></Svg>;
}
function ChatIconButton({ name, label, onPress, raised, disabled, busy, selected, compactFace }: { name: ChatIconName; label: string; onPress: () => void; raised?: boolean; disabled?: boolean; busy?: boolean; selected?: boolean; compactFace?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy, selected }} aria-pressed={selected} disabled={disabled || busy} onPress={event => { event.stopPropagation(); onPress(); }} style={styles.iconTarget}>{({ pressed }) => <PressFeedback pressed={pressed} disabled={disabled || busy} style={[styles.iconFace, compactFace && { width: 32, height: 32 }, raised && styles.raisedFace, (disabled || busy) && { opacity: 0.4 }]}>{busy ? <ActivityIndicator size="small" color={colors.primaryText} /> : <ChatGlyph name={name} selected={selected} color={raised ? colors.primaryText : selected ? colors.text : colors.muted} />}</PressFeedback>}</Pressable>;
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  frame: { flex: 1, minHeight: 0 }, container: { flex: 1, minHeight: 0, backgroundColor: colors.bg }, header: { minHeight: 56, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border }, selectionHeader: { backgroundColor: colors.panel }, selectionCount: { flex: 1, minWidth: 0, fontSize: 14 }, selectableMessage: { borderRadius: 16 },
  headerTitle: { flex: 1, minWidth: 0, gap: 1, paddingHorizontal: 4 }, sessionTitle: { fontSize: 16, fontWeight: '500', lineHeight: 21 }, headerSubtitle: { flexDirection: 'row', alignItems: 'center', gap: 6 }, projectLabel: { fontSize: 12, lineHeight: 16, flexShrink: 1 }, dot: { width: 5, height: 5, borderRadius: 3 }, transcriptFrame: { flex: 1, minHeight: 0 }, transcript: { flex: 1, minHeight: 0, width: '100%', maxWidth: 760, alignSelf: 'center' }, messages: { padding: 16, paddingBottom: 24, flexGrow: 1 }, latestButton: { position: 'absolute', bottom: 12, right: 16 },
  userGroup: { alignSelf: 'flex-end', maxWidth: '92%' }, user: { alignSelf: 'flex-end', padding: 14, borderRadius: 14, backgroundColor: colors.raised, gap: 12 }, assistant: { gap: 6 }, jsonText: { color: colors.text, fontFamily: mono, fontSize: 12, lineHeight: 19 },
  eyebrow: { fontFamily: mono, fontSize: 10, color: colors.muted, letterSpacing: 1.2 }, notice: { fontFamily: mono, fontSize: 11 },
  composerDock: { padding: 12, paddingTop: 4, alignItems: 'center' }, composer: { width: '100%', maxWidth: 736, paddingHorizontal: 8, paddingVertical: 6, gap: 4, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.controlTopEdge, borderRadius: 18, backgroundColor: colors.panel }, composerInput: { minHeight: 44, maxHeight: 120, borderWidth: 0, borderRadius: 0, boxShadow: [], backgroundColor: colors.panel, paddingHorizontal: 6, paddingVertical: 6, fontSize: 16, lineHeight: 24 }, composerToolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }, modelTrigger: { flex: 1, minWidth: 0, minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }, modelTriggerText: { flexShrink: 1, fontSize: 12, color: colors.muted },
  iconTarget: { width: Platform.OS === 'android' ? 48 : 44, height: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, iconFace: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, raisedFace: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.controlTopEdge, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2 },
  errorBanner: { paddingHorizontal: 12, paddingTop: 8, gap: 4 }, modelSearch: { padding: 16, paddingBottom: 10, gap: 8 }, modelList: { paddingHorizontal: 12, paddingBottom: 24 }, modelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }, variants: { gap: 8, paddingHorizontal: 4, paddingBottom: 16 }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' }, radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
  code: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' }, codeText: { color: colors.text, fontFamily: mono, fontSize: 12, lineHeight: 19, padding: 12, paddingTop: 4 },
  revert: { margin: 12, padding: 14, gap: 8, backgroundColor: colors.raised, borderRadius: 10 },
}); }
