import { useState } from "react";
import { Text } from "react-native";

import {
  Button,
  Card,
  Disclosure,
  Empty,
  Field,
  BodyText,
  mono,
  Row,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { Page, useResource } from "./shared";
import { createStyles } from "./styles";

export const Skills = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
      <Row style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
        <Field
          label="Find a skill or command"
          value={query}
          onChangeText={setQuery}
          containerStyle={{ flex: 1 }}
        />
        {!!query && (
          <Button
            title="Clear"
            accessibilityLabel="Clear skill and command search"
            compact
            variant="ghost"
            onPress={() => setQuery("")}
          />
        )}
      </Row>
      <BodyText muted>
        Use slash commands and skills from the chat composer.
      </BodyText>
      <BodyText style={styles.sectionLabel}>SKILLS · {skills.length}</BodyText>
      {skills.map((item) => (
        <Disclosure key={item.id} title={item.name}>
          <BodyText muted>{item.description}</BodyText>
          <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
            {item.path}
          </BodyText>
          <Text
            selectable
            style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}
          >
            {item.content}
          </Text>
        </Disclosure>
      ))}
      <BodyText style={styles.sectionLabel}>
        COMMANDS · {commands.length}
      </BodyText>
      {commands.map((item) => (
        <Card key={item.name}>
          <BodyText style={styles.name}>/{item.name}</BodyText>
          <BodyText muted>{item.description}</BodyText>
        </Card>
      ))}
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
    </Page>
  );
};
