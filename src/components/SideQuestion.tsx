import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { errorMessage, type Client } from '../lib/client';
import { Markdown } from './Markdown';
import { Button, Card, ErrorNotice, Field, Label, Row } from './ui';

export function SideQuestion({ client, sessionID, initialQuestion, onQuestionConsumed }: {
  client: Client;
  sessionID: string;
  initialQuestion?: string;
  onQuestionConsumed?: () => void;
}) {
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [answer, setAnswer] = useState<{ question: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const consume = useRef(onQuestionConsumed);
  consume.current = onQuestionConsumed;

  const cancel = () => {
    epoch.current += 1;
    request.current?.abort();
    request.current = null;
    setBusy(false);
  };

  useEffect(() => {
    mounted.current = true;
    setQuestion(initialQuestion ?? '');
    setAnswer(null);
    setError(null);
    setBusy(false);
    setCopied(false);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && request.current) cancel();
    });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      request.current?.abort();
      request.current = null;
      subscription.remove();
    };
  }, [client, sessionID]);

  useEffect(() => {
    if (initialQuestion !== undefined) {
      setQuestion(initialQuestion);
      consume.current?.();
    }
  }, [client, sessionID, initialQuestion]);

  const ask = async () => {
    const prompt = question.trim();
    if (!prompt || request.current) return;
    const controller = new AbortController();
    const current = ++epoch.current;
    request.current = controller;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await client.session.generate({ sessionID, prompt }, { signal: controller.signal });
      if (!mounted.current || current !== epoch.current || controller.signal.aborted) return;
      setAnswer({ question: prompt, text: result.text });
    } catch (cause) {
      if (mounted.current && current === epoch.current && !controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (mounted.current && current === epoch.current) {
        request.current = null;
        setBusy(false);
      }
    }
  };

  const copy = async () => {
    if (!answer) return;
    const current = epoch.current;
    try {
      await Clipboard.setStringAsync(answer.text);
      if (mounted.current && current === epoch.current) setCopied(true);
    } catch (cause) {
      if (mounted.current && current === epoch.current) setError(errorMessage(cause));
    }
  };

  return <View style={{ gap: 18 }}>
    <Label muted>Ask a question with the current session context. OpenCode returns a separate answer without a change to the session history.</Label>
    <Field label="Side question" multiline value={question} onChangeText={setQuestion} placeholder="Ask about this conversation" />
    <Row>
      <Button title="Ask" variant="primary" disabled={!question.trim()} busy={busy} onPress={() => void ask()} />
      {busy && <Button title="Cancel request" onPress={cancel} />}
    </Row>
    <ErrorNotice error={error} />
    {answer && <Card>
      <Label muted>{answer.question}</Label>
      {answer.text ? <Markdown text={answer.text} /> : <Label muted>OpenCode returned an empty answer.</Label>}
      <Row><Button title={copied ? 'Copied' : 'Copy answer'} compact disabled={!answer.text} onPress={() => void copy()} /></Row>
    </Card>}
  </View>;
}
