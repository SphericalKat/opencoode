import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { McpResource, McpResourceCatalog, McpResourceTemplate } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { useTheme } from '../lib/theme';
import { Button, Busy, Card, Empty, ErrorNotice, Field, Label, mono, Row, sans } from './ui';

type Props = {
  client: Client;
  location: { directory: string };
  onAttachContext: (text: string) => void;
};

export function McpResources({ client, location, onAttachContext }: Props) {
  const [catalog, setCatalog] = useState<McpResourceCatalog>();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | undefined>(undefined);
  const { directory } = location;

  useEffect(() => {
    setCatalog(undefined);
    setQuery('');
    void refresh();
    return () => request.current?.abort();
  }, [client, directory]);
  useEffect(() => setLimit(15), [query]);

  async function refresh() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await client.mcp.resource.catalog({ location: { directory } }, { signal: controller.signal });
      if (!controller.signal.aborted) setCatalog(result.data);
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const search = query.trim().toLowerCase();
  const matches = [
    ...(catalog?.resources ?? []).map(resource => ({ type: 'resource' as const, resource })),
    ...(catalog?.templates ?? []).map(resource => ({ type: 'template' as const, resource })),
  ].filter(item => `${item.resource.server} ${item.resource.name} ${'uri' in item.resource ? item.resource.uri : item.resource.uriTemplate} ${item.resource.description ?? ''}`.toLowerCase().includes(search));

  const attach = (resource: McpResource | McpResourceTemplate, uri: string) => {
    const metadata = {
      server: resource.server,
      uri,
      name: resource.name,
      ...(resource.description ? { description: resource.description } : {}),
      ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    };
    onAttachContext(`MCP resource reference (catalog metadata only; contents are not attached):\n${JSON.stringify(metadata, null, 2)}\n\nUse this resource as context if the server supports resource reads.`);
  };

  return <View style={{ gap: 14 }}>
    <Row style={{ justifyContent: 'space-between' }}><Label style={{ fontSize: 17, fontWeight: '600' }}>MCP resources</Label><Button title="Refresh resources" compact variant="ghost" busy={loading} onPress={() => void refresh()} /></Row>
    <Label muted>OpenCode supplies catalog metadata here. Add a reference to your draft. The agent can resolve it if its server tools support resource reads.</Label>
    <Field label="Find a resource" placeholder="Name, server, or URI" value={query} onChangeText={setQuery} />
    <ErrorNotice error={error} onRetry={() => void refresh()} />
    {loading && !catalog && <Busy />}
    {matches.slice(0, limit).map((item, index) => item.type === 'resource'
      ? <ResourceCard key={`${item.resource.server}:${item.resource.uri}:${index}`} resource={item.resource} onAttach={() => attach(item.resource, item.resource.uri)} />
      : <TemplateCard key={`${item.resource.server}:${item.resource.uriTemplate}:${index}`} resource={item.resource} onAttach={uri => attach(item.resource, uri)} />)}
    {matches.length > limit && <><Label muted>Showing {limit} of {matches.length} matches</Label><Button title="Load more resources" onPress={() => setLimit(value => value + 15)} /></>}
    {catalog && !matches.length && <Empty title={search ? 'No matching resources' : 'No resource catalog'} detail={search ? 'Try another name, server, or URI.' : 'Connect an MCP server that exposes resources or resource templates.'} />}
  </View>;
}

function ResourceCard({ resource, onAttach }: { resource: McpResource; onAttach: () => void }) {
  const { colors } = useTheme();
  return <Card>
    <Label style={{ fontWeight: '600' }}>{resource.name}</Label><Label muted>{resource.server}{resource.mimeType ? ` · ${resource.mimeType}` : ''}</Label>
    <Text selectable style={{ color: colors.text, fontFamily: mono, fontSize: 12, lineHeight: 18 }}>{resource.uri}</Text>
    {resource.description && <Text selectable style={{ color: colors.muted, fontFamily: sans, lineHeight: 21 }}>{resource.description}</Text>}
    <Button title="Add resource reference" compact onPress={onAttach} />
  </Card>;
}

function TemplateCard({ resource, onAttach }: { resource: McpResourceTemplate; onAttach: (uri: string) => void }) {
  const { colors } = useTheme();
  const [uri, setUri] = useState('');
  const unresolved = /[{}]/.test(uri);
  return <Card>
    <Label style={{ fontWeight: '600' }}>{resource.name}</Label><Label muted>{resource.server} · Resource template</Label>
    <Text selectable style={{ color: colors.text, fontFamily: mono, fontSize: 12, lineHeight: 18 }}>{resource.uriTemplate}</Text>
    {resource.description && <Label muted>{resource.description}</Label>}
    <Field label={`Resource URI for ${resource.name}`} value={uri} onChangeText={setUri} placeholder="Enter a complete URI from this template" />
    <Label muted>Replace each template parameter with the value that you need.</Label>
    {unresolved && <Label style={{ color: colors.danger }}>Replace all template parameters before you add the reference.</Label>}
    <Button title="Add template reference" compact disabled={!uri.trim() || unresolved} onPress={() => onAttach(uri.trim())} />
  </Card>;
}
