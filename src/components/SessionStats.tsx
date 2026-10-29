import React from 'react';
import { View } from 'react-native';
import type { SessionInfo } from '@opencode/client';
import { Card, Label, Row } from './ui';

export function SessionStats({ session, running }: { session: SessionInfo; running: boolean }) {
  const usage = [
    ['Input tokens', session.tokens.input],
    ['Output tokens', session.tokens.output],
    ['Reasoning tokens', session.tokens.reasoning],
    ['Cache read tokens', session.tokens.cache.read],
    ['Cache write tokens', session.tokens.cache.write],
  ] as const;
  return <View style={{ gap: 14 }}><Label muted>Usage totals recorded by the server for this session.</Label><Card><Row style={{ justifyContent: 'space-between' }}><Label>Cost</Label><Label style={{ fontSize: 22, fontWeight: '500' }}>${session.cost.toFixed(4)}</Label></Row>{usage.map(([name, value]) => <Row key={name} style={{ justifyContent: 'space-between' }}><Label muted>{name}</Label><Label>{value.toLocaleString()}</Label></Row>)}</Card><Card><Row style={{ justifyContent: 'space-between' }}><Label muted>Status</Label><Label>{running ? 'Running' : session.outcome || 'Idle'}</Label></Row><Label muted>Agent</Label><Label>{session.agent || 'Server default'}</Label><Label muted>Model</Label><Label>{session.model ? `${session.model.providerID} / ${session.model.id}${session.model.variant ? ` · ${session.model.variant}` : ''}` : 'Server default'}</Label><Label muted>Created</Label><Label>{new Date(session.time.created).toLocaleString()}</Label><Label muted>Last updated</Label><Label>{new Date(session.time.updated).toLocaleString()}</Label>{session.time.idle !== undefined && <><Label muted>Last idle</Label><Label>{new Date(session.time.idle).toLocaleString()}</Label></>}</Card></View>;
}
