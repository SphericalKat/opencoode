import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import type { SessionInfo } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { useTheme } from '../lib/theme';
import { Button, Busy, Card, Empty, ErrorNotice, Label, Row, confirmAction } from './ui';

export function ChildSessions({ client, sessionID, onOpenSession }: { client: Client; sessionID: string; onOpenSession: (id: string) => void }) {
  const { colors } = useTheme();
  const [items, setItems] = useState<SessionInfo[]>([]);
  const [activeIDs, setActiveIDs] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string>();
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stoppingID, setStoppingID] = useState<string>();
  const [error, setError] = useState<string>();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const knownIDs = useRef(new Set<string>());
  const refreshRef = useRef<() => void>(() => {});
  const moreRef = useRef<() => void>(() => {});
  const stopRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!foreground) return;
    const controller = new AbortController();
    let version = 0;
    let nextCursor: string | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseRetry: (() => void) | undefined;
    let attempts = 0;
    let paging = false;
    setItems([]); setActiveIDs(new Set()); setCursor(undefined); setError(undefined); setLoadingMore(false); setStoppingID(undefined);
    knownIDs.current.clear();
    const refresh = async () => {
      const request = ++version;
      setLoading(true);
      try {
        const [sessions, active] = await Promise.all([
          client.session.list({ parentID: sessionID, archived, order: 'desc', limit: 40 }, { signal: controller.signal }),
          client.session.active({ signal: controller.signal }),
        ]);
        if (controller.signal.aborted || request !== version) return;
        knownIDs.current = new Set(sessions.data.map(item => item.id));
        nextCursor = sessions.cursor.next ?? undefined;
        setItems(sessions.data); setActiveIDs(new Set(Object.keys(active))); setCursor(nextCursor); setError(undefined);
      } catch (cause) { if (!controller.signal.aborted && request === version) setError(errorMessage(cause)); }
      finally { if (!controller.signal.aborted && request === version) setLoading(false); }
    };
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 250);
    };
    refreshRef.current = () => { void refresh(); };
    moreRef.current = () => {
      if (!nextCursor || paging) return;
      paging = true;
      const request = version;
      const pageCursor = nextCursor;
      setLoadingMore(true);
      void client.session.list({ parentID: sessionID, archived, cursor: pageCursor, limit: 40 }, { signal: controller.signal }).then(page => {
        if (controller.signal.aborted || request !== version) return;
        for (const item of page.data) knownIDs.current.add(item.id);
        nextCursor = page.cursor.next ?? undefined;
        setCursor(nextCursor);
        setItems(current => [...current, ...page.data.filter(item => !current.some(existing => existing.id === item.id))]);
      }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { paging = false; if (!controller.signal.aborted) setLoadingMore(false); });
    };
    stopRef.current = id => {
      void (async () => {
        if (!await confirmAction('Stop this child session?', 'This interrupts its current execution.')) return;
        if (controller.signal.aborted) return;
        setStoppingID(id);
        try { await client.session.interrupt({ sessionID: id }, { signal: controller.signal }); await refresh(); }
        catch (cause) { if (!controller.signal.aborted) setError(errorMessage(cause)); }
        finally { if (!controller.signal.aborted) setStoppingID(undefined); }
      })();
    };
    void (async () => {
      await refresh();
      while (!controller.signal.aborted) {
        try {
          for await (const event of client.event.subscribe({ signal: controller.signal, types: ['session.created', 'session.deleted', 'session.archived', 'session.unarchived', 'session.renamed', 'session.execution.started', 'session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted', 'session.usage.updated'] })) {
            if (controller.signal.aborted) break;
            attempts = 0;
            if (event.type === 'server.connected' || (event.type === 'session.created' && event.data.parentID === sessionID)) { scheduleRefresh(); continue; }
            if (!('sessionID' in event.data) || !knownIDs.current.has(event.data.sessionID)) continue;
            const id = event.data.sessionID;
            if (event.type === 'session.deleted' || event.type === 'session.archived' || event.type === 'session.unarchived') { scheduleRefresh(); continue; }
            if (event.type === 'session.execution.started') setActiveIDs(current => new Set([...current, id]));
            if (event.type === 'session.execution.succeeded' || event.type === 'session.execution.failed' || event.type === 'session.execution.interrupted') {
              if (event.type === 'session.execution.interrupted' && event.data.reason === 'shutdown') { scheduleRefresh(); continue; }
              setActiveIDs(current => { const next = new Set(current); next.delete(id); return next; });
              void client.session.get({ sessionID: id }, { signal: controller.signal }).then(item => { if (!controller.signal.aborted && knownIDs.current.has(id)) setItems(current => current.map(existing => existing.id === id ? item : existing)); }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
            }
            if (event.type === 'session.renamed') setItems(current => current.map(item => item.id === id ? { ...item, title: event.data.title } : item));
            if (event.type === 'session.usage.updated') setItems(current => current.map(item => item.id === id ? { ...item, cost: event.data.cost, tokens: event.data.tokens } : item));
          }
          if (!controller.signal.aborted) throw new Error('Child session updates disconnected');
        } catch (cause) {
          if (controller.signal.aborted) break;
          setError(errorMessage(cause));
          await new Promise<void>(resolve => { releaseRetry = resolve; retryTimer = setTimeout(resolve, Math.min(1000 * 2 ** Math.min(attempts++, 4), 15000)); });
          if (!controller.signal.aborted) await refresh();
        }
      }
    })().catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => { controller.abort(); clearTimeout(refreshTimer); clearTimeout(retryTimer); releaseRetry?.(); refreshRef.current = () => {}; moreRef.current = () => {}; stopRef.current = () => {}; };
  }, [client, sessionID, archived, foreground]);

  const running = items.filter(item => activeIDs.has(item.id)).length;
  return <View style={{ gap: 14 }}><Row><Button title="Current" compact selected={!archived} onPress={() => setArchived(false)} /><Button title="Archived" compact selected={archived} onPress={() => setArchived(true)} /><Button title="Refresh" compact disabled={!foreground || loading} onPress={() => refreshRef.current()} /></Row><ErrorNotice error={error} onRetry={() => refreshRef.current()} /><Label muted>{running} running · {items.length}{cursor ? '+' : ''} child sessions</Label>{loading && !items.length && <Busy />}{!loading && !error && !items.length && <Empty title="No child sessions" detail="Subagents appear here when this session delegates work." />}{items.map(item => {
    const isActive = activeIDs.has(item.id);
    const status = isActive ? 'Running' : item.outcome === 'succeeded' ? 'Completed' : item.outcome === 'failed' ? 'Failed' : item.outcome === 'interrupted' ? 'Stopped' : 'Idle';
    return <Card key={item.id}><Row style={{ justifyContent: 'space-between' }}><Label numberOfLines={2} style={{ fontWeight: '500', flex: 1 }}>{item.title || 'Child session'}</Label><Label style={{ color: isActive ? colors.success : item.outcome === 'failed' ? colors.danger : colors.muted }}>{status}</Label></Row><Label muted>{item.agent || 'Server default agent'} · {item.tokens.output.toLocaleString()} output tokens · ${item.cost.toFixed(3)}</Label><Label muted style={{ fontSize: 12 }}>Updated {new Date(item.time.updated).toLocaleString()}</Label><Row><Button title="Open session" compact onPress={() => onOpenSession(item.id)} />{isActive && <Button title="Stop" compact variant="danger" busy={stoppingID === item.id} disabled={!!stoppingID} onPress={() => stopRef.current(item.id)} />}</Row></Card>;
  })}{cursor && <Button title="Load more child sessions" variant="ghost" busy={loadingMore} onPress={() => moreRef.current()} />}</View>;
}
