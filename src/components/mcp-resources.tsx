import type {
  McpResource,
  McpResourceCatalog,
  McpResourceTemplate,
} from "@opencode/client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useTheme } from "../lib/theme";
import {
  Button,
  Busy,
  Card,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  mono,
  Row,
  sans,
} from "./ui";

interface Props {
  client: Client;
  location: { directory: string };
  onAttachContext: (text: string) => void;
}

const ResourceCard = ({
  resource,
  onAttach,
}: {
  resource: McpResource;
  onAttach: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <Card>
      <BodyText style={{ fontWeight: "600" }}>{resource.name}</BodyText>
      <BodyText muted>
        {resource.server}
        {resource.mimeType ? ` · ${resource.mimeType}` : ""}
      </BodyText>
      <Text
        selectable
        style={{
          color: colors.text,
          fontFamily: mono,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        {resource.uri}
      </Text>
      {resource.description && (
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: sans,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {resource.description}
        </Text>
      )}
      <Button title="Add resource reference" compact onPress={onAttach} />
    </Card>
  );
};

const TemplateCard = ({
  resource,
  onAttach,
}: {
  resource: McpResourceTemplate;
  onAttach: (uri: string) => void;
}) => {
  const { colors } = useTheme();
  const [uri, setUri] = useState("");
  const unresolved = /[{}]/u.test(uri);
  return (
    <Card>
      <BodyText style={{ fontWeight: "600" }}>{resource.name}</BodyText>
      <BodyText muted>{resource.server} · Resource template</BodyText>
      <Text
        selectable
        style={{
          color: colors.text,
          fontFamily: mono,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        {resource.uriTemplate}
      </Text>
      {resource.description && (
        <BodyText muted>{resource.description}</BodyText>
      )}
      <Field
        label={`Resource URI for ${resource.name}`}
        value={uri}
        onChangeText={setUri}
        placeholder="Enter a complete URI from this template"
      />
      <BodyText muted>
        Replace each template parameter with the value that you need.
      </BodyText>
      {unresolved && (
        <BodyText style={{ color: colors.danger }}>
          Replace all template parameters before you add the reference.
        </BodyText>
      )}
      <Button
        title="Add template reference"
        compact
        disabled={!uri.trim() || unresolved}
        onPress={() => onAttach(uri.trim())}
      />
    </Card>
  );
};

export const McpResources = ({ client, location, onAttachContext }: Props) => {
  const [catalog, setCatalog] = useState<McpResourceCatalog>();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | undefined>(undefined);
  const { directory } = location;

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await client.mcp.resource.catalog(
        { location: { directory } },
        { signal: controller.signal }
      );
      if (!controller.signal.aborted) {
        setCatalog(result.data);
      }
    } catch (error_) {
      if (!controller.signal.aborted) {
        setError(errorMessage(error_));
      }
    }
    if (!controller.signal.aborted) {
      setLoading(false);
    }
  }, [client, directory]);

  useEffect(() => {
    setCatalog(undefined);
    setQuery("");
    refresh();
    return () => request.current?.abort();
  }, [refresh]);
  useEffect(() => setLimit(15), [query]);

  const search = query.trim().toLowerCase();
  const matches = [
    ...(catalog?.resources ?? []).map((resource) => ({
      resource,
      type: "resource" as const,
    })),
    ...(catalog?.templates ?? []).map((resource) => ({
      resource,
      type: "template" as const,
    })),
  ].filter((item) =>
    `${item.resource.server} ${item.resource.name} ${"uri" in item.resource ? item.resource.uri : item.resource.uriTemplate} ${item.resource.description ?? ""}`
      .toLowerCase()
      .includes(search)
  );

  const attach = (resource: McpResource | McpResourceTemplate, uri: string) => {
    const metadata = {
      name: resource.name,
      server: resource.server,
      uri,
      ...(resource.description ? { description: resource.description } : {}),
      ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    };
    onAttachContext(
      `MCP resource reference (catalog metadata only; contents are not attached):\n${JSON.stringify(metadata, null, 2)}\n\nUse this resource as context if the server supports resource reads.`
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <BodyText style={{ fontSize: 18, fontWeight: "600" }}>
          MCP resources
        </BodyText>
        <Button
          title="Refresh resources"
          compact
          variant="ghost"
          busy={loading}
          onPress={() => {
            refresh();
          }}
        />
      </Row>
      <BodyText muted>
        OpenCode supplies catalog metadata here. Add a reference to your draft.
        The agent can resolve it if its server tools support resource reads.
      </BodyText>
      <Field
        label="Find a resource"
        placeholder="Name, server, or URI"
        value={query}
        onChangeText={setQuery}
      />
      <ErrorNotice
        error={error}
        onRetry={() => {
          refresh();
        }}
      />
      {loading && !catalog && <Busy />}
      {matches
        .slice(0, limit)
        .map((item, index) =>
          item.type === "resource" ? (
            <ResourceCard
              key={`${item.resource.server}:${item.resource.uri}:${index}`}
              resource={item.resource}
              onAttach={() => attach(item.resource, item.resource.uri)}
            />
          ) : (
            <TemplateCard
              key={`${item.resource.server}:${item.resource.uriTemplate}:${index}`}
              resource={item.resource}
              onAttach={(uri) => attach(item.resource, uri)}
            />
          )
        )}
      {matches.length > limit && (
        <>
          <BodyText muted>
            Showing {limit} of {matches.length} matches
          </BodyText>
          <Button
            title="Load more resources"
            onPress={() => setLimit((value) => value + 15)}
          />
        </>
      )}
      {catalog && !matches.length && (
        <Empty
          title={search ? "No matching resources" : "No resource catalog"}
          detail={
            search
              ? "Try another name, server, or URI."
              : "Connect an MCP server that exposes resources or resource templates."
          }
        />
      )}
    </View>
  );
};
