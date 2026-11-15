import { useQuery } from "@tanstack/react-query";
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
import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import {
  catalogCommandListOptions,
  catalogSkillListOptions,
} from "../../lib/queries/settings";
import { useServerScope } from "../../lib/server-scope";
import { useTheme } from "../../lib/theme";
import { Page } from "./shared";

const useSkillsData = (client: Client, directory: string) => {
  const scope = useServerScope();
  const skillList = useQuery(catalogSkillListOptions(scope, client, directory));
  const commandList = useQuery(
    catalogCommandListOptions(scope, client, directory)
  );
  const data =
    skillList.data && commandList.data
      ? { commands: commandList.data, skills: skillList.data }
      : undefined;
  const failure = skillList.error ?? commandList.error;
  const error = failure ? errorMessage(failure) : null;
  const loading = skillList.isFetching || commandList.isFetching;
  const { refetch: refetchSkills } = skillList;
  const { refetch: refetchCommands } = commandList;
  const refresh = () => {
    void refetchSkills();
    void refetchCommands();
  };
  return { data, error, loading, refresh };
};

export const Skills = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const { data, error, loading, refresh } = useSkillsData(client, directory);
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
