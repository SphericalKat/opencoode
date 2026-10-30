import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import type { FormField, FormInfo, PermissionRequest } from '@opencode/client';
import type { Client } from '../lib/client';
import { initialFormValues, isFieldActive, prepareFormAnswer, type FormValues } from '../lib/forms';
import { useTheme } from '../lib/theme';
import { Button, Card, ErrorNotice, Field, Heading, Label, Row, mono } from './ui';

export function DynamicFields({ fields, values, onChange, errors = {} }: {
  fields: readonly FormField[];
  values: FormValues;
  onChange: (values: FormValues) => void;
  errors?: Record<string, string>;
}) {
  const { colors } = useTheme();
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<string | null>(null);
  const current = prepareFormAnswer(fields, values).answer;
  const change = (key: string, value: FormValues[string]) => onChange({ ...values, [key]: value });
  const open = async (url: string) => {
    try {
      if (!/^https?:\/\//i.test(url)) throw new Error('This link requires an HTTP or HTTPS address');
      await Linking.openURL(url);
      setLinkError(null);
    } catch (error) { setLinkError(error instanceof Error ? error.message : 'Cannot open this link'); }
  };
  return <View style={{ gap: 18 }}>
    <ErrorNotice error={linkError} />
    {fields.map(field => {
      if (field.type !== 'external' && (field.hidden || !isFieldActive(field, current))) return null;
      const label = `${field.title || field.key}${field.type !== 'external' && field.required ? ' *' : ''}`;
      const value = values[field.key];
      return <View key={field.key} style={{ gap: 8 }}>
        <Label style={{ fontWeight: '600' }}>{label}</Label>
        {field.description && <Label muted>{field.description}</Label>}
        {field.type === 'external' ? <><Label muted style={{ fontFamily: mono, fontSize: 12 }}>{field.url}</Label><Button title="Open link" onPress={() => void open(field.url)} /><Button title={value === true ? '✓ Completed' : 'I completed this step'} variant={value === true ? 'primary' : 'secondary'} onPress={() => change(field.key, value !== true)} /></> :
          field.type === 'boolean' ? <Row>{[true, false].map(choice => <Button key={String(choice)} title={choice ? 'Yes' : 'No'} variant={value === choice ? 'primary' : 'secondary'} compact onPress={() => change(field.key, choice)} />)}{!field.required && value !== undefined && <Button title="Clear" compact variant="ghost" onPress={() => change(field.key, undefined)} />}</Row> :
          field.type === 'multiselect' ? <>
            <Row>{field.options.map(option => <Button key={option.value} title={`${Array.isArray(value) && value.includes(option.value) ? '✓ ' : ''}${option.label}`} variant={Array.isArray(value) && value.includes(option.value) ? 'primary' : 'secondary'} compact onPress={() => change(field.key, Array.isArray(value) && value.includes(option.value) ? value.filter(item => item !== option.value) : [...(Array.isArray(value) ? value : []), option.value])} />)}</Row>
            {field.custom && <><Row>{(Array.isArray(value) ? value : []).filter(item => !field.options.some(option => option.value === item)).map(item => <Button key={item} title={`${item} ×`} compact onPress={() => change(field.key, Array.isArray(value) ? value.filter(selected => selected !== item) : [])} />)}</Row><Field label={`Custom value for ${field.title || field.key}`} value={custom[field.key] || ''} onChangeText={text => setCustom({ ...custom, [field.key]: text })} /><Button title="Add custom value" compact disabled={!custom[field.key]?.trim()} onPress={() => { change(field.key, [...new Set([...(Array.isArray(value) ? value : []), custom[field.key].trim()])]); setCustom({ ...custom, [field.key]: '' }); }} /></>}
          </> : field.type === 'string' && field.options ? <>
            <Row>{field.options.map(option => <Button key={option.value} title={option.label} variant={value === option.value ? 'primary' : 'secondary'} compact onPress={() => change(field.key, option.value)} />)}</Row>
            {field.custom && <Field label={`Custom value for ${field.title || field.key}`} value={typeof value === 'string' ? value : ''} onChangeText={text => change(field.key, text)} />}
            {!field.required && value !== undefined && <Button title="Clear selection" compact variant="ghost" onPress={() => change(field.key, undefined)} />}
          </> : <Field accessibilityLabel={label} value={value === undefined ? '' : String(value)} placeholder={field.type === 'string' ? field.placeholder : undefined} keyboardType={field.type === 'string' ? field.format === 'email' ? 'email-address' : 'default' : 'numbers-and-punctuation'} onChangeText={text => change(field.key, text)} />}
        {errors[field.key] && <Label style={{ color: colors.danger }}>{errors[field.key]}</Label>}
      </View>;
    })}
  </View>;
}

function PendingForm({ client, form, onChanged, onError, locationDirectory }: { client: Client; form: FormInfo; onChanged: () => void; onError: (error: unknown) => void; locationDirectory?: string }) {
  const { colors } = useTheme();
  const [values, setValues] = useState<FormValues>(() => initialFormValues(form.fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = async (cancel: boolean) => {
    const prepared = prepareFormAnswer(form.fields, values);
    if (!cancel && Object.keys(prepared.errors).length) { setErrors(prepared.errors); return; }
    setBusy(true);
    try {
      const options = locationDirectory ? { headers: { 'x-opencode-directory': encodeURIComponent(locationDirectory) } } : undefined;
      if (cancel) await client.session.form.cancel({ sessionID: form.sessionID, formID: form.id }, options);
      else await client.session.form.reply({ sessionID: form.sessionID, formID: form.id, answer: prepared.answer }, options);
      onChanged();
    } catch (error) { onError(error); } finally { setBusy(false); }
  };
  return <Card style={{ borderColor: colors.blue }}><Heading>{form.title}</Heading><DynamicFields fields={form.fields} values={values} onChange={setValues} errors={errors} />
    {Object.keys(errors).some(key => { const field = form.fields.find(item => item.key === key); return field && field.type !== 'external' && field.hidden; }) && <ErrorNotice error="A hidden field requires a valid default. Check the server configuration." />}
    <Row><Button title="Submit answers" variant="primary" disabled={busy} onPress={() => void run(false)} /><Button title="Dismiss" disabled={busy} onPress={() => void run(true)} /></Row>
  </Card>;
}

function PendingPermission({ client, sessionID, permission, onChanged, onError }: { client: Client; sessionID: string; permission: PermissionRequest; onChanged: () => void; onError: (error: unknown) => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reply = async (decision: 'once' | 'always' | 'reject') => {
    setBusy(true);
    try { await client.permission.reply({ sessionID, requestID: permission.id, decision, message: message.trim() || undefined }); onChanged(); }
    catch (error) { onError(error); } finally { setBusy(false); }
  };
  return <Card style={{ borderColor: colors.success }}><Label style={{ color: colors.success, fontWeight: '600' }}>Permission required</Label><Heading>{permission.action}</Heading>
    {permission.message && <Label>{permission.message}</Label>}
    {permission.resources.map((resource, index) => <Label key={`${index}-${resource}`} style={{ fontFamily: mono, fontSize: 12 }}>{resource}</Label>)}
    <Field label="Reply message (optional)" value={message} onChangeText={setMessage} />
    <Row><Button title="Allow once" variant="primary" disabled={busy} onPress={() => void reply('once')} />{permission.save && permission.save.length > 0 && <Button title="Always allow" disabled={busy} onPress={() => void reply('always')} />}<Button title="Reject" variant="danger" disabled={busy} onPress={() => void reply('reject')} /></Row>
    {permission.save && permission.save.length > 0 && <Label muted>Always allow saves permission for: {permission.save.join(', ')}</Label>}
  </Card>;
}

export function SessionForms({ client, sessionID, forms, permissions, onChanged, onError, locationDirectory }: { client: Client; sessionID: string; forms: FormInfo[]; permissions: PermissionRequest[]; onChanged: () => void; onError: (error: unknown) => void; locationDirectory?: string }) {
  if (!forms.length && !permissions.length) return null;
  return <View style={{ gap: 12 }}>{permissions.filter(permission => permission.sessionID === sessionID).map(permission => <PendingPermission key={permission.id} client={client} sessionID={sessionID} permission={permission} onChanged={onChanged} onError={onError} />)}{forms.filter(form => form.sessionID === sessionID || form.sessionID === 'global').map(form => <PendingForm key={form.id} client={client} form={form} onChanged={onChanged} onError={onError} locationDirectory={locationDirectory} />)}</View>;
}
