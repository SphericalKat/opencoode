import type { McpResource, McpResourceTemplate } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Text, View } from "react-native";

import { errorMessageOrNull } from "../lib/client";
import type { Client } from "../lib/client";
import { mcpResourcesOptions } from "../lib/queries/panels";
import { useServerScope } from "../lib/server-scope";
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
      <Button
        title="Add resource reference"
        size="compact"
        onPress={onAttach}
      />
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
        size="compact"
        disabled={!uri.trim() || unresolved}
        onPress={() => onAttach(uri.trim())}
      />
    </Card>
  );
};

export const McpResources = ({ client, location, onAttachContext }: Props) => {
  const scope = useServerScope();
  const { directory } = location;
  const resources = useQuery(mcpResourcesOptions(scope, client, directory));
  const catalog = resources.data;
  const loading = resources.isFetching;
  const error = errorMessageOrNull(resources.error);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(15);
  const { refetch } = resources;
  const refresh = () => refetch();

  const [seenScope, setSeenScope] = useState({ client, directory });
  if (seenScope.client !== client || seenScope.directory !== directory) {
    setSeenScope({ client, directory });
    setQuery("");
  }
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setLimit(15);
  }

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
          size="compact"
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
