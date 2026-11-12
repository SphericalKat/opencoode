import * as Clipboard from "expo-clipboard";
import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import { AppState, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { Markdown } from "./markdown";
import { Button, Card, ErrorNotice, Field, BodyText, Row } from "./ui";

export const SideQuestion = ({
  client,
  sessionID,
  initialQuestion,
  onQuestionConsumed,
}: {
  client: Client;
  sessionID: string;
  initialQuestion?: string;
  onQuestionConsumed?: () => void;
}) => {
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [answer, setAnswer] = useState<{
    question: string;
    text: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const consume = useEffectEvent(() => {
    onQuestionConsumed?.();
  });

  const cancel = () => {
    epoch.current += 1;
    request.current?.abort();
    request.current = null;
    setBusy(false);
  };

  const onAppStateChange = useEffectEvent((state: string) => {
    if (state !== "active" && request.current) {
      cancel();
    }
  });

  useEffect(() => {
    mounted.current = true;
    setQuestion(initialQuestion ?? "");
    setAnswer(null);
    setError(null);
    setBusy(false);
    setCopied(false);
    const subscription = AppState.addEventListener("change", (state) => {
      onAppStateChange(state);
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
      consume();
    }
  }, [client, sessionID, initialQuestion]);

  const ask = async () => {
    const prompt = question.trim();
    if (!prompt || request.current) {
      return;
    }
    const controller = new AbortController();
    epoch.current += 1;
    const { current } = epoch;
    request.current = controller;
    setBusy(true);
    setError(null);
    setCopied(false);
    const finish = () => {
      if (mounted.current && current === epoch.current) {
        request.current = null;
        setBusy(false);
      }
    };
    let result: Awaited<ReturnType<Client["session"]["generate"]>>;
    try {
      result = await client.session.generate(
        { prompt, sessionID },
        { signal: controller.signal }
      );
    } catch (error_) {
      if (
        mounted.current &&
        current === epoch.current &&
        !controller.signal.aborted
      ) {
        setError(errorMessage(error_));
      }
      finish();
      return;
    }
    if (
      mounted.current &&
      current === epoch.current &&
      !controller.signal.aborted
    ) {
      setAnswer({ question: prompt, text: result.text });
    }
    finish();
  };

  const copy = async () => {
    if (!answer) {
      return;
    }
    const { current } = epoch;
    try {
      await Clipboard.setStringAsync(answer.text);
      if (mounted.current && current === epoch.current) {
        setCopied(true);
      }
    } catch (error_) {
      if (mounted.current && current === epoch.current) {
        setError(errorMessage(error_));
      }
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <BodyText muted>
        Ask a question with the current session context. OpenCode returns a
        separate answer without a change to the session history.
      </BodyText>
      <Field
        label="Side question"
        multiline
        value={question}
        onChangeText={setQuestion}
        placeholder="Ask about this conversation"
      />
      <Row>
        <Button
          title="Ask"
          variant="primary"
          disabled={!question.trim()}
          busy={busy}
          onPress={() => {
            ask();
          }}
        />
        {busy && <Button title="Cancel request" onPress={cancel} />}
      </Row>
      <ErrorNotice error={error} />
      {answer && (
        <Card>
          <BodyText muted>{answer.question}</BodyText>
          {answer.text ? (
            <Markdown text={answer.text} />
          ) : (
            <BodyText muted>OpenCode returned an empty answer.</BodyText>
          )}
          <Row>
            <Button
              title={copied ? "Copied" : "Copy answer"}
              compact
              disabled={!answer.text}
              onPress={() => {
                copy();
              }}
            />
          </Row>
        </Card>
      )}
    </View>
  );
};
