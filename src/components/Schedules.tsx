import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ScheduleInfo } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { prepareSchedule, type ScheduleDraft } from '../lib/schedules';
import { Button, Busy, Card, ErrorNotice, Field, Label, Row, confirmAction } from './ui';

const emptyDraft: ScheduleDraft = { name: '', prompt: '', mode: 'in', trigger: '', timezone: '', after: '', until: '', runs: '' };
const modes = [{ id: 'in', title: 'After a delay' }, { id: 'at', title: 'At a time' }, { id: 'every', title: 'Repeat' }, { id: 'cron', title: 'Cron' }] as const;

function triggerLabel(item: ScheduleInfo) {
  const when = item.when;
  if (when.type === 'in') return `After ${when.in}`;
  if (when.type === 'at') return `At ${when.at}`;
  if (when.type === 'every') return `Every ${when.every}`;
  return `Cron: ${when.cron}`;
}

export function Schedules({ client, sessionID }: { client: Client; sessionID: string }) {
  const [items, setItems] = useState<ScheduleInfo[]>([]);
  const [draft, setDraft] = useState<ScheduleDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<ScheduleInfo>();
  const request = useRef(0);
  const scope = useRef({ client, sessionID });
  if (scope.current.client !== client || scope.current.sessionID !== sessionID) scope.current = { client, sessionID };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current += 1; }; }, []);

  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(undefined);
    try {
      const schedules = await client.experimental.schedule.list({ sessionID });
      if (mounted.current && request.current === id) setItems(schedules);
    } catch (cause) {
      if (mounted.current && request.current === id) setError(errorMessage(cause));
    } finally {
      if (mounted.current && request.current === id) setLoading(false);
    }
  }, [client, sessionID]);

  useEffect(() => {
    setItems([]); setDetail(undefined); setAdding(false); setDraft(emptyDraft);
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    const owner = scope.current;
    setBusy(true); setError(undefined);
    try { await action(); }
    catch (cause) { if (mounted.current && owner === scope.current) setError(errorMessage(cause)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const mutate = async (action: () => Promise<unknown>) => {
    const owner = scope.current;
    await action();
    if (owner !== scope.current || !mounted.current) return;
    setDetail(undefined);
    await refresh();
  };
  const change = (field: keyof ScheduleDraft, value: string) => setDraft(previous => ({ ...previous, [field]: value }));
  const repeating = draft.mode === 'every' || draft.mode === 'cron';

  return <View style={{ gap: 14 }}>
    <Label muted>Schedules run on the server. They need OpenCode 2.2.1 or later and experimental.schedules in this session configuration.</Label>
    <Row><Button title={adding ? 'Cancel new schedule' : '+ Schedule prompt'} compact disabled={busy} onPress={() => setAdding(!adding)} /><Button title="Refresh" compact disabled={busy || loading} onPress={() => { void refresh(); }} /></Row>
    <ErrorNotice error={error} onRetry={() => { void refresh(); }} />
    {loading && <Busy />}
    {!loading && !error && items.length === 0 && <Label muted>No schedules for this session</Label>}
    {adding && <Card>
      <Field label="Name (optional)" value={draft.name} onChangeText={value => change('name', value)} />
      <Field label="Prompt" multiline placeholder="What must OpenCode do when this schedule runs?" value={draft.prompt} onChangeText={value => change('prompt', value)} />
      <Row>{modes.map(mode => <Button key={mode.id} title={mode.title} compact variant={draft.mode === mode.id ? 'primary' : 'secondary'} onPress={() => setDraft(previous => ({ ...previous, mode: mode.id, trigger: '' }))} />)}</Row>
      <Field label={draft.mode === 'at' ? 'Date and time' : draft.mode === 'cron' ? 'Cron expression' : draft.mode === 'every' ? 'Repeat interval' : 'Delay'} placeholder={draft.mode === 'at' ? 'YYYY-MM-DDTHH:mm' : draft.mode === 'cron' ? '0 9 * * 1-5' : '20 minutes'} value={draft.trigger} onChangeText={value => change('trigger', value)} />
      <Field label="Time zone (optional)" placeholder="Server time zone, or enter Asia/Kolkata" value={draft.timezone} onChangeText={value => change('timezone', value)} />
      {repeating && <>
        <Field label="Maximum runs (optional)" keyboardType="number-pad" placeholder="Leave empty for no run limit" value={draft.runs} onChangeText={value => change('runs', value)} />
        <Field label="Stop after a duration (optional)" placeholder="8 hours" value={draft.after} onChangeText={value => change('after', value)} />
        <Field label="Stop at a time (optional)" placeholder="YYYY-MM-DDTHH:mm" value={draft.until} onChangeText={value => change('until', value)} />
        <Label muted>The schedule stops at the first limit. Without limits, it repeats until you pause or delete it.</Label>
      </>}
      <Button title="Create schedule" variant="primary" busy={busy} onPress={() => { void run(async () => {
        const input = prepareSchedule(sessionID, draft);
        const owner = scope.current;
        await client.experimental.schedule.create(input);
        if (owner !== scope.current || !mounted.current) return;
        setAdding(false); setDraft(emptyDraft); await refresh();
      }); }} />
    </Card>}
    {items.map(item => <Card key={item.id}>
      <Label style={{ fontSize: 16, fontWeight: '600' }}>{item.name || 'Scheduled prompt'}</Label>
      <Label>{triggerLabel(item)} · {item.tz}</Label>
      <Label muted>{item.status} · {item.runCount} runs{item.remainingRuns !== undefined ? ` · ${item.remainingRuns} remaining` : ''}</Label>
      {item.nextDueAt !== undefined && <Label muted>Next: {new Date(item.nextDueAt).toLocaleString()}</Label>}
      <Label numberOfLines={3}>{item.action.prompt}</Label>
      <Row>
        <Button title="Details" compact disabled={busy} onPress={() => { void run(async () => { const owner = scope.current; const result = await client.experimental.schedule.get({ scheduleID: item.id }); if (owner === scope.current && mounted.current) setDetail(result); }); }} />
        {item.status !== 'done' && <Button title={item.status === 'paused' ? 'Resume' : 'Pause'} compact disabled={busy} onPress={() => { void run(() => mutate(() => item.status === 'paused' ? client.experimental.schedule.resume({ scheduleID: item.id }) : client.experimental.schedule.pause({ scheduleID: item.id }))); }} />}
        <Button title="Delete" compact variant="danger" disabled={busy} onPress={() => { void run(async () => { const owner = scope.current; if (await confirmAction('Delete schedule?', `Delete ${item.name || 'this scheduled prompt'}?`) && owner === scope.current && mounted.current) await mutate(() => client.experimental.schedule.delete({ scheduleID: item.id })); }); }} />
      </Row>
      {detail?.id === item.id && <View style={{ gap: 8 }}>
        <Label selectable>{detail.action.prompt}</Label>
        <Label muted>Current status: {detail.status}</Label>
        {detail.lastFiredAt !== undefined && <Label muted>Last run: {new Date(detail.lastFiredAt).toLocaleString()} · {detail.lastOutcome || 'No outcome reported'}</Label>}
        {detail.endsAt !== undefined && <Label muted>Ends: {new Date(detail.endsAt).toLocaleString()}</Label>}
        <Label selectable muted>{detail.id}</Label>
        <Button title="Hide details" compact variant="ghost" onPress={() => setDetail(undefined)} />
      </View>}
    </Card>)}
  </View>;
}
