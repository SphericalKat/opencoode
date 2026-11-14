import { useState } from "react";
import { Text } from "react-native";

import { SheetGroup, SheetRow } from "../../components/list-sheet";
import {
  Button,
  Empty,
  Field,
  BodyText,
  Sheet,
  mono,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { useTheme } from "../../lib/theme";
import { Page, useResource } from "./shared";

export const Skills = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const { data, error, loading, refresh } = useResource(
    client,
    directory,
    async (signal) => {
      const [skills, commands] = await Promise.all([
        client.skill.list({ location: { directory } }, { signal }),
        client.command.list({ location: { directory } }, { signal }),
      ]);
      return { commands: commands.data, skills: skills.data };
    }
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] =
    useState<NonNullable<typeof data>["skills"][number]>();
  const search = query.trim().toLowerCase();
  const skills =
    data?.skills.filter((item) =>
      `${item.name} ${item.description}`.toLowerCase().includes(search)
    ) ?? [];
  const commands =
    data?.commands.filter((item) => item.name.toLowerCase().includes(search)) ??
    [];
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <Field
        label="Find a skill or command"
        placeholder="Name or description"
        value={query}
        onChangeText={setQuery}
        trailing={
          query ? (
            <Button
              title="Clear"
              accessibilityLabel="Clear skill and command search"
              size="compact"
              variant="ghost"
              onPress={() => setQuery("")}
            />
          ) : undefined
        }
      />
      <BodyText muted>
        Use slash commands and skills from the chat composer.
      </BodyText>
      {skills.length > 0 && (
        <SheetGroup title={`Skills (${skills.length})`}>
          {skills.map((item) => (
            <SheetRow
              key={item.id}
              label={item.name}
              description={item.description}
              trailing="chevron"
              onPress={() => setSelected(item)}
            />
          ))}
        </SheetGroup>
      )}
      {commands.length > 0 && (
        <SheetGroup title={`Commands (${commands.length})`}>
          {commands.map((item) => (
            <SheetRow
              key={item.name}
              label={`/${item.name}`}
              description={item.description}
            />
          ))}
        </SheetGroup>
      )}
      {data &&
        !loading &&
        !!(data.skills.length || data.commands.length) &&
        !skills.length &&
        !commands.length && (
          <Empty
            title="No matching skills or commands"
            detail="Try a skill name, description, or command name."
          />
        )}
      {data && !data.skills.length && !data.commands.length && (
        <Empty title="No custom skills or commands" />
      )}
      <Sheet
        visible={!!selected}
        title={selected?.name ?? "Skill"}
        onClose={() => setSelected(undefined)}
      >
        {selected && (
          <>
            <BodyText muted>{selected.description}</BodyText>
            <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
              {selected.path}
            </BodyText>
            <Text
              selectable
              style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}
            >
              {selected.content}
            </Text>
          </>
        )}
      </Sheet>
    </Page>
  );
};
