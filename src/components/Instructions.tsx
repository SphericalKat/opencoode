import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { InstructionEntryInfo } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { Button, Busy, Card, ErrorNotice, Field, Label, Row, confirmAction } from './ui';

export function Instructions({ client, sessionID }: { client: Client; sessionID: string }) {
  const [entries, setEntries] = useState<InstructionEntryInfo[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [json, setJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const mounted = useRef(true);
  const scope = useRef({ client, sessionID });
  if (scope.current.client !== client || scope.current.sessionID !== sessionID) scope.current = { client, sessionID };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current += 1; }; }, []);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError(undefined);
    try {
      const result = await client.experimental.session.instructions.entry.list({ sessionID });
      if (mounted.current && request === sequence.current) setEntries(result);
    } catch (cause) {
      if (mounted.current && request === sequence.current) setError(errorMessage(cause));
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [client, sessionID]);
  useEffect(() => {
    setEntries([]); setKey(''); setValue(''); setJson(false); void refresh();
    return () => { sequence.current += 1; };
  }, [refresh]);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    const owner = scope.current;
    setBusy(true); setError(undefined);
    try {
      await operation();
      if (owner !== scope.current || !mounted.current) return;
      setKey(''); setValue(''); setJson(false); await refresh();
    } catch (cause) {
      if (owner === scope.current && mounted.current) setError(errorMessage(cause));
    } finally { if (mounted.current) setBusy(false); }
  };

  return <View style={{ gap: 14 }}>
    <Label muted>These instructions stay with this session through compaction and reverts. Changes reach the agent at its next step.</Label>
    <Label muted>This feature needs the experimental instruction API on the server.</Label>
    <Button title="Refresh instructions" compact disabled={busy || loading} onPress={() => { void refresh(); }} />
    <ErrorNotice error={error} onRetry={() => { void refresh(); }} />
    {loading && <Busy />}
    {!loading && !error && entries.length === 0 && <Label muted>No saved instruction entries</Label>}
    {entries.map(entry => <Card key={entry.key}>
      <Label style={{ fontWeight: '600' }}>{entry.key}</Label>
      <Label selectable>{typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)}</Label>
      <Row><Button title="Edit" compact disabled={busy} onPress={() => { setKey(entry.key); setValue(typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)); setJson(typeof entry.value !== 'string'); }} />
        <Button title="Delete" compact variant="danger" disabled={busy} onPress={() => { void run(async () => { const owner = scope.current; if (await confirmAction('Delete instruction?', `Remove the instruction named ${entry.key}?`) && owner === scope.current && mounted.current) await client.experimental.session.instructions.entry.remove({ sessionID, key: entry.key }); }); }} /></Row>
    </Card>)}
    <Card>
      <Label style={{ fontWeight: '600' }}>{entries.some(entry => entry.key === key.trim()) ? 'Update instruction' : 'Add instruction'}</Label>
      <Field label="Instruction name" value={key} onChangeText={setKey} placeholder="project-guidance" />
      <Button title={json ? 'Value format: JSON' : 'Value format: text'} compact onPress={() => setJson(!json)} />
      <Field label={json ? 'JSON value' : 'Instruction text'} multiline value={value} onChangeText={setValue} />
      <Button title="Save instruction" variant="primary" busy={busy} disabled={!key.trim() || (!json && !value.trim())} onPress={() => { void run(async () => {
        if (!key.trim()) throw new Error('Enter an instruction name');
        const parsed = json ? JSON.parse(value) : value;
        await client.experimental.session.instructions.entry.put({ sessionID, key: key.trim(), value: parsed });
      }); }} />
    </Card>
  </View>;
}
