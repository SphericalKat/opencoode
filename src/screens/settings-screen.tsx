import type {
  CredentialEntry,
  IntegrationAttempt,
  IntegrationCommandAttempt,
  IntegrationInfo,
  IntegrationMethod,
  ModelInfo,
  PermissionSavedInfo,
} from "@opencode/client";
import { isFileNotFoundError } from "@opencode/client";
import { HeaderBackButton } from "@react-navigation/elements";
import {
  BaseNavigationContainer,
  DefaultTheme,
  usePreventRemove,
  useNavigationContainerRef,
} from "@react-navigation/native";
import type {
  NavigationAction,
  NavigationContainerRefWithCurrent,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { AdvancedSettings } from "../components/advanced-settings";
import { GlobalForms } from "../components/global-forms";
import { useMotionPreference } from "../components/motion";
import { ScreenHeader } from "../components/screen-header";
import { DynamicFields } from "../components/session-forms";
import { ShellIcon } from "../components/shell-icon";
import {
  Button,
  Busy,
  Card,
  confirmAction,
  Disclosure,
  Empty,
  ErrorNotice,
  Field,
  Heading,
  JsonView,
  BodyText,
  mono,
  sans,
  Row,
  Sheet,
} from "../components/ui";
import { useBetaLayout } from "../lib/beta-layout";
import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { initialFormValues, prepareFormAnswer } from "../lib/forms";
import type { FormValues } from "../lib/forms";
import { pageInset } from "../lib/layout";
import {
  externalURL,
  saveConfigFile,
  withSettingsRequest,
} from "../lib/settings";
import { paletteOptions, useTheme, useThemedStyles } from "../lib/theme";
import type { Appearance, ThemeColors } from "../lib/theme";
import {
  useHasUnsavedChanges,
  useUnsavedChanges,
  useUnsavedGuard,
} from "../lib/unsaved";

export type Section =
  | "Accounts"
  | "Models"
  | "MCP"
  | "Config"
  | "Skills"
  | "Plugins"
  | "Permissions"
  | "Advanced"
  | "Appearance";
type ModelCatalog = Pick<Client["model"], "list">;
const sectionDescriptions: Record<Section, string> = {
  Accounts: "Provider connections and credentials",
  Advanced: "Usage, web search, and generation",
  Appearance: "System, light, or dark theme",
  Config: "Server configuration and shell",
  MCP: "Tool servers and pending requests",
  Models: "Available models and capabilities",
  Permissions: "Saved approvals for this project",
  Plugins: "Server plugins and updates",
  Skills: "Skills in this workspace",
};
const sectionGroups: { title: string; items: Section[] }[] = [
  { items: ["Appearance", "Config"], title: "General" },
  { items: ["Accounts", "Models", "MCP"], title: "Connections" },
  { items: ["Skills", "Plugins", "Permissions"], title: "Agent" },
  { items: ["Advanced"], title: "Advanced" },
];
const allSections = sectionGroups.flatMap((group) => group.items);

type HeaderRefresh = { refresh?: () => void; loading?: boolean } | null;
const HeaderRefreshContext = createContext<React.Dispatch<
  React.SetStateAction<HeaderRefresh>
> | null>(null);
type SettingsStackParams = Record<"Index", undefined> &
  Record<"Section", { section: Section }>;
const SettingsStack = createNativeStackNavigator<SettingsStackParams>();
const zeroInsets = { bottom: 0, left: 0, right: 0, top: 0 };
// The native toolbar supplies its inset before the shared back control applies its own margins.
const nativeBackInsets = Platform.select<ViewStyle>({
  android: { marginEnd: 33, marginStart: -7 },
  ios: { height: 44, justifyContent: "center", minWidth: 44 },
});

const appearanceLabel = (value: Appearance) => {
  if (value === "system") {
    return "System";
  }
  return value === "light" ? "Light" : "Dark";
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    betaAppearanceCard: {
      alignItems: "center",
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    betaBackLabel: { fontSize: 14, lineHeight: 19 },
    betaCategoryRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    betaChooserTarget: { justifyContent: "center", minHeight: 48 },
    betaDescription: { fontSize: 14, lineHeight: 21 },
    betaSettingChooser: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      minHeight: 28,
      paddingHorizontal: 8,
    },
    betaSettingTitle: {
      fontFamily: sans,
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 21,
    },
    content: { flex: 1, flexDirection: "row", minHeight: 0 },
    currentSection: { backgroundColor: colors.selected },
    detail: { flex: 1, minWidth: 0 },
    detailHeader: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexWrap: "nowrap",
      minHeight: 64,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    detailTitle: {
      flex: 1,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 25,
      fontWeight: "500",
      lineHeight: 31,
    },
    group: { gap: 10 },
    groupPanel: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      overflow: "hidden",
    },
    groupTitle: {
      fontSize: 13,
      fontWeight: "500",
      letterSpacing: 0.4,
      paddingHorizontal: 8,
    },
    index: {
      gap: 24,
      padding: 16,
      paddingBottom: 24,
      paddingHorizontal: pageInset,
    },
    indexHeader: { gap: 5 },
    name: { fontFamily: sans, fontSize: 17, fontWeight: "600" },
    narrowContent: { flexDirection: "column" },
    narrowScreen: { flexDirection: "column" },
    nativeNavigation: { flex: 1, minHeight: 0 },
    page: {
      gap: 16,
      padding: 16,
      paddingBottom: 32,
      paddingHorizontal: pageInset,
    },
    screen: {
      backgroundColor: colors.bg,
      flex: 1,
      flexDirection: "row",
      minHeight: 0,
    },
    sectionDescription: { fontSize: 13, lineHeight: 19 },
    sectionDivider: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
      left: 16,
      position: "absolute",
      right: 16,
      top: 0,
    },
    sectionLabel: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: 8,
    },
    sectionName: {
      fontFamily: sans,
      fontSize: 17,
      fontWeight: "500",
      lineHeight: 23,
    },
    sectionRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      minHeight: 68,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sidebar: {
      borderRightColor: colors.border,
      borderRightWidth: 1,
      flexGrow: 0,
      width: 220,
    },
  });

const runBusy = async (
  setBusy: (busy: boolean) => void,
  setError: (message: string) => void,
  task: () => Promise<void>
) => {
  setBusy(true);
  try {
    await task();
  } catch (error_) {
    setError(errorMessage(error_));
  } finally {
    setBusy(false);
  }
};

const useResource = <T,>(
  source: object,
  directory: string,
  load: (signal: AbortSignal) => Promise<T>
) => {
  const scope = useMemo(() => ({ directory, source }), [source, directory]);
  const [stored, setStored] = useState<{ scope: object; value: T }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resourceScope, setResourceScope] = useState(scope);
  const active = useRef(true);
  const latest = useRef({ load, scope });
  useLayoutEffect(() => {
    latest.current = { load, scope };
  });
  const sequence = useRef(0);
  if (resourceScope !== scope) {
    setResourceScope(scope);
    setLoading(true);
    setError(null);
  }
  const run = useCallback(async (owner: object, signal?: AbortSignal) => {
    const { load: read } = latest.current;
    sequence.current += 1;
    const { current } = sequence;
    const isCurrent = () =>
      active.current &&
      current === sequence.current &&
      latest.current.scope === owner;
    try {
      const result = await withSettingsRequest(read, signal);
      if (isCurrent()) {
        setStored({ scope: owner, value: result });
      }
    } catch (error_) {
      if (isCurrent()) {
        setError(errorMessage(error_));
      }
    }
    if (isCurrent()) {
      setLoading(false);
    }
  }, []);
  const refresh = useCallback(
    (signal?: AbortSignal) => {
      const owner = latest.current.scope;
      setResourceScope(owner);
      setLoading(true);
      setError(null);
      return run(owner, signal);
    },
    [run]
  );
  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    void run(
      scope,
      AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
    );
    return () => {
      active.current = false;
      sequence.current += 1;
      controller.abort();
    };
  }, [scope, run]);
  return {
    data: stored?.scope === scope ? stored.value : undefined,
    error: resourceScope === scope ? error : null,
    loading: resourceScope !== scope || loading,
    refresh,
  };
};

const Page = ({
  children,
  error,
  loading,
  refresh,
}: {
  children: React.ReactNode;
  error?: string | null;
  loading?: boolean;
  refresh?: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const setHeaderRefresh = useContext(HeaderRefreshContext);
  useEffect(() => {
    setHeaderRefresh?.({ loading, refresh });
    return () => setHeaderRefresh?.(null);
  }, [setHeaderRefresh, refresh, loading]);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
    >
      {!setHeaderRefresh && refresh && (
        <Row style={{ justifyContent: "flex-end" }}>
          <Button
            title="Refresh"
            compact
            variant="ghost"
            onPress={() => refresh()}
          />
        </Row>
      )}
      <ErrorNotice
        error={error}
        onRetry={refresh ? () => refresh() : undefined}
      />
      {loading && <Busy />}
      {children}
    </ScrollView>
  );
};

export const AppearanceSettings = () => {
  const { appearance, scheme, setAppearance, palette, setPalette, colors } =
    useTheme();
  const styles = useThemedStyles(createStyles);
  const betaLayout = useBetaLayout();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [choosingPalette, setChoosingPalette] = useState(false);
  const paletteLabel =
    paletteOptions.find((option) => option.id === palette)?.name ?? "OpenCoode";
  const palettePicker = (
    <>
      <View style={styles.betaAppearanceCard}>
        <View style={styles.detail}>
          <BodyText style={styles.betaSettingTitle}>Palette</BodyText>
          <BodyText muted style={styles.betaDescription}>
            Choose the app colors.
          </BodyText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Palette: ${paletteLabel}`}
          accessibilityState={{ disabled: busy, expanded: choosingPalette }}
          disabled={busy}
          onPress={() => setChoosingPalette(true)}
          style={styles.betaChooserTarget}
        >
          <View style={styles.betaSettingChooser}>
            <BodyText style={styles.betaBackLabel}>{paletteLabel}</BodyText>
            <View style={{ transform: [{ rotate: "90deg" }] }}>
              <ShellIcon name="chevron" size={12} color={colors.text} />
            </View>
          </View>
        </Pressable>
      </View>
      <Sheet
        visible={choosingPalette}
        title="Palette"
        fitContent
        contentStyle={{ gap: 0 }}
        onClose={() => {
          if (!busy) {
            setChoosingPalette(false);
          }
        }}
      >
        <ErrorNotice error={error} />
        {paletteOptions.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.name}
            accessibilityState={{
              disabled: busy,
              selected: palette === option.id,
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.betaCategoryRow,
              pressed && { backgroundColor: colors.raised },
            ]}
            onPress={() => {
              setBusy(true);
              setError(null);
              void setPalette(option.id)
                .then(() => setChoosingPalette(false))
                .catch((error_) => setError(errorMessage(error_)))
                .finally(() => setBusy(false));
            }}
          >
            <BodyText style={[styles.betaBackLabel, styles.detail]}>
              {option.name}
            </BodyText>
            {palette === option.id && (
              <BodyText accessibilityElementsHidden>✓</BodyText>
            )}
          </Pressable>
        ))}
      </Sheet>
    </>
  );
  const choiceLabel = appearanceLabel(appearance);
  if (betaLayout) {
    return (
      <Page error={error}>
        <View style={styles.betaAppearanceCard}>
          <View style={styles.detail}>
            <BodyText style={styles.betaSettingTitle}>Color scheme</BodyText>
            <BodyText muted style={styles.betaDescription}>
              Choose the color scheme for the app.
            </BodyText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Color scheme: ${choiceLabel}`}
            accessibilityState={{ disabled: busy, expanded: choosing }}
            disabled={busy}
            onPress={() => setChoosing(true)}
            style={styles.betaChooserTarget}
          >
            <View style={styles.betaSettingChooser}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <BodyText style={styles.betaBackLabel}>{choiceLabel}</BodyText>
              )}
              <View style={{ transform: [{ rotate: "90deg" }] }}>
                <ShellIcon name="chevron" size={12} color={colors.text} />
              </View>
            </View>
          </Pressable>
        </View>
        {palettePicker}
        <Sheet
          visible={choosing}
          title="Color scheme"
          fitContent
          contentStyle={{ gap: 0 }}
          onClose={() => {
            if (!busy) {
              setChoosing(false);
            }
          }}
        >
          <ErrorNotice error={error} />
          {(["system", "light", "dark"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={appearanceLabel(value)}
              accessibilityState={{
                disabled: busy,
                selected: appearance === value,
              }}
              disabled={busy}
              style={({ pressed }) => [
                styles.betaCategoryRow,
                pressed && { backgroundColor: colors.raised },
              ]}
              onPress={() => {
                setBusy(true);
                setError(null);
                void setAppearance(value)
                  .then(() => setChoosing(false))
                  .catch((error_) => setError(errorMessage(error_)))
                  .finally(() => setBusy(false));
              }}
            >
              <BodyText style={[styles.betaBackLabel, styles.detail]}>
                {appearanceLabel(value)}
              </BodyText>
              {appearance === value && (
                <BodyText accessibilityElementsHidden>✓</BodyText>
              )}
            </Pressable>
          ))}
        </Sheet>
      </Page>
    );
  }
  return (
    <Page error={error}>
      <BodyText muted>
        Use your device theme or choose a fixed color scheme.
      </BodyText>
      {(["system", "light", "dark"] as const).map((value) => (
        <Button
          key={value}
          title={appearanceLabel(value)}
          selected={appearance === value}
          variant={appearance === value ? "primary" : "secondary"}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            setError(null);
            void setAppearance(value)
              .catch((error_) => setError(errorMessage(error_)))
              .finally(() => setBusy(false));
          }}
        />
      ))}
      <BodyText muted>Current theme: {scheme}</BodyText>
      {palettePicker}
    </Page>
  );
};

type Attempt =
  | { kind: "oauth"; data: IntegrationAttempt }
  | { kind: "command"; data: IntegrationCommandAttempt };
const ConnectIntegration = ({
  client,
  directory,
  integration,
  onClose,
}: {
  client: Client;
  directory: string;
  integration: IntegrationInfo;
  onClose: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const [method, setMethod] = useState<IntegrationMethod>();
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState<Attempt>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const statusRequest = useRef(false);
  useEffect(
    () => () => {
      active.current = false;
    },
    []
  );
  const check = useCallback(async () => {
    if (!attempt || statusRequest.current) {
      return;
    }
    statusRequest.current = true;
    try {
      const input = {
        attemptID: attempt.data.attemptID,
        integrationID: integration.id,
        location: { directory },
      };
      const result =
        attempt.kind === "oauth"
          ? await client.integration.oauth.status(input)
          : await client.integration.command.status(input);
      if (active.current) {
        setStatus(result.data.status);
        if (result.data.status === "failed") {
          setError(result.data.message);
        }
        if (result.data.status === "complete") {
          onClose();
        }
      }
    } catch (error_) {
      if (active.current) {
        setError(errorMessage(error_));
      }
    }
    statusRequest.current = false;
  }, [attempt, client, directory, integration.id, onClose]);
  useEffect(() => {
    if (!attempt || ["complete", "expired", "failed"].includes(status)) {
      return;
    }
    const first = setTimeout(() => {
      void check();
    }, 0);
    const timer = setInterval(() => {
      void check();
    }, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [attempt, status, check]);
  const open = async (url: string) => {
    try {
      await Linking.openURL(externalURL(url));
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error_) {
      if (active.current) {
        setError(errorMessage(error_));
      }
    }
    if (active.current) {
      setBusy(false);
    }
  };
  const start = async () => {
    if (!method || method.type === "env") {
      return;
    }
    const prepared = prepareFormAnswer(
      "form" in method ? (method.form ?? []) : [],
      values
    );
    setFieldErrors(prepared.errors);
    if (Object.keys(prepared.errors).length) {
      return;
    }
    const input = {
      answer: prepared.answer,
      integrationID: integration.id,
      label: label.trim() || undefined,
      location: { directory },
    };
    await run(async () => {
      if (method.type === "key") {
        if (!key.trim()) {
          throw new Error("Enter an API key");
        }
        await client.integration.connect.key({ ...input, key: key.trim() });
        setKey("");
        onClose();
      } else if (method.type === "external") {
        await client.integration.connect.external({
          ...input,
          methodID: method.id,
        });
        onClose();
      } else if (method.type === "oauth") {
        const result = await client.integration.oauth.connect({
          ...input,
          methodID: method.id,
        });
        setAttempt({ data: result.data, kind: "oauth" });
        setStatus("pending");
        await open(result.data.url);
      } else {
        const result = await client.integration.command.connect({
          ...input,
          methodID: method.id,
        });
        setAttempt({ data: result.data, kind: "command" });
        setStatus("pending");
      }
    });
  };
  return (
    <Sheet visible title={`Connect ${integration.name}`} onClose={onClose}>
      <ErrorNotice error={error} />
      {!attempt && (
        <>
          <BodyText muted>
            Choose a connection method. Credentials stay on your OpenCode
            server.
          </BodyText>
          {integration.methods.map((item, index) => (
            <Button
              key={index}
              title={
                item.type === "env"
                  ? `Server environment: ${item.names.join(", ")}`
                  : item.label || (item.type === "key" ? "API key" : item.type)
              }
              selected={method === item}
              variant={method === item ? "primary" : "secondary"}
              onPress={() => {
                setMethod(item);
                setError(null);
                setFieldErrors({});
                setValues(
                  initialFormValues("form" in item ? (item.form ?? []) : [])
                );
              }}
            />
          ))}
          {method?.type === "env" && (
            <BodyText muted>
              Set these environment variables on the server, then restart
              OpenCode.
            </BodyText>
          )}
          {method && method.type !== "env" && (
            <>
              <Field
                label="Account name (optional)"
                value={label}
                onChangeText={setLabel}
              />
              {method.type === "key" && (
                <Field
                  label="API key"
                  secureTextEntry
                  value={key}
                  onChangeText={setKey}
                />
              )}
              {"form" in method && (
                <DynamicFields
                  fields={method.form ?? []}
                  values={values}
                  onChange={setValues}
                  errors={fieldErrors}
                />
              )}
              {method.type === "command" && (
                <Card>
                  <BodyText muted>
                    This starts the sign-in command on your server.
                  </BodyText>
                  <BodyText style={{ fontFamily: mono }}>
                    {method.command.join(" ")}
                  </BodyText>
                </Card>
              )}
              <Button
                title="Continue"
                variant="primary"
                busy={busy}
                onPress={() => {
                  void start();
                }}
              />
            </>
          )}
          {!integration.methods.length && (
            <Empty title="No connection methods" />
          )}
        </>
      )}
      {attempt && (
        <>
          <BodyText style={styles.name}>
            {status === "pending" ? "Complete the sign-in" : status}
          </BodyText>
          {attempt.kind === "oauth" && (
            <>
              <BodyText>{attempt.data.instructions}</BodyText>
              <Button
                title="Open sign-in page"
                onPress={() => {
                  void open(attempt.data.url);
                }}
              />
              {attempt.data.mode === "code" && (
                <>
                  <Field
                    label="Authorization code"
                    value={code}
                    onChangeText={setCode}
                  />
                  <Button
                    title="Submit code"
                    variant="primary"
                    busy={busy}
                    disabled={!code.trim()}
                    onPress={() => {
                      void run(async () => {
                        await client.integration.oauth.complete({
                          attemptID: attempt.data.attemptID,
                          code: code.trim(),
                          integrationID: integration.id,
                          location: { directory },
                        });
                        await check();
                      });
                    }}
                  />
                </>
              )}
            </>
          )}
          {attempt.kind === "command" && (
            <BodyText muted>
              Complete any browser or terminal steps on the server. This page
              checks the result automatically.
            </BodyText>
          )}
          <Button
            title="Check status"
            compact
            onPress={() => {
              void check();
            }}
          />
          <Button
            title="Cancel sign-in"
            variant="danger"
            busy={busy}
            onPress={() => {
              void run(async () => {
                const input = {
                  attemptID: attempt.data.attemptID,
                  integrationID: integration.id,
                  location: { directory },
                };
                await (attempt.kind === "oauth"
                  ? client.integration.oauth.cancel(input)
                  : client.integration.command.cancel(input));
                setAttempt(undefined);
                setStatus("");
              });
            }}
          />
        </>
      )}
    </Sheet>
  );
};

const Accounts = ({
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
      const [integrations, credentials] = await Promise.all([
        client.integration.list({ location: { directory } }, { signal }),
        client.credential.list({ signal }),
      ]);
      return { credentials, integrations: integrations.data };
    }
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IntegrationInfo>();
  const [limit, setLimit] = useState(40);
  const changeQuery = (next: string) => {
    if (next !== query) {
      setLimit(40);
    }
    setQuery(next);
  };
  const [credential, setCredential] = useState<CredentialEntry>();
  const [label, setLabel] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<unknown>) => {
    setActionError(null);
    await runBusy(setBusy, setActionError, async () => {
      await withSettingsRequest(async (signal) => {
        await action(signal);
        await refresh(signal);
      });
    });
  };
  const search = query.trim().toLowerCase();
  const integrations =
    data?.integrations.filter((item) =>
      `${item.name} ${item.id}`.toLowerCase().includes(search)
    ) ?? [];
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <Row style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
        <Field
          label="Find a provider or integration"
          placeholder="Search accounts"
          value={query}
          onChangeText={changeQuery}
          containerStyle={{ flex: 1 }}
        />
        {!!query && (
          <Button
            title="Clear"
            accessibilityLabel="Clear provider search"
            compact
            variant="ghost"
            onPress={() => changeQuery("")}
          />
        )}
      </Row>
      <ErrorNotice error={actionError} />
      {!!data?.credentials.length && (
        <BodyText style={styles.sectionLabel}>SAVED ACCOUNTS</BodyText>
      )}
      {data?.credentials.map((item) => (
        <Card key={item.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.name}>
                {item.label || item.integrationID}
              </BodyText>
              <BodyText muted>
                {item.integrationID} · {item.value.type}
                {item.active ? " · Active" : ""}
              </BodyText>
            </View>
            <Button
              title="Manage"
              compact
              onPress={() => {
                setCredential(item);
                setLabel(item.label);
                setActionError(null);
              }}
            />
          </Row>
        </Card>
      ))}
      <BodyText style={styles.sectionLabel}>CONNECT AN ACCOUNT</BodyText>
      {integrations.slice(0, limit).map((item) => (
        <Card key={item.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.name}>{item.name}</BodyText>
              <BodyText muted>
                {item.connections.length
                  ? `${item.connections.length} connection${item.connections.length === 1 ? "" : "s"}`
                  : "Not connected"}
              </BodyText>
            </View>
            <Button title="Connect" compact onPress={() => setSelected(item)} />
          </Row>
          {item.connections.map(
            (connection, index) =>
              connection.status && (
                <BodyText key={index} style={{ color: colors.danger }}>
                  {connection.status.message}
                </BodyText>
              )
          )}
        </Card>
      ))}
      {integrations.length > limit && (
        <>
          <BodyText muted>
            Showing {limit} of {integrations.length} integrations. Search or
            load more.
          </BodyText>
          <Button
            title="Load more integrations"
            onPress={() => setLimit((value) => value + 40)}
          />
        </>
      )}
      {data &&
        !loading &&
        !!data.integrations.length &&
        !!search &&
        !integrations.length && (
          <Card>
            <Empty
              title="No matching providers"
              detail="Try a provider name or integration ID, or clear the search to see all providers."
            />
            <Button title="Clear search" onPress={() => changeQuery("")} />
          </Card>
        )}
      {data && !data.integrations.length && (
        <Empty
          title="No integrations"
          detail="Your server did not publish any account integrations for this project."
        />
      )}
      <Sheet
        visible={!!credential}
        title="Manage account"
        onClose={() => {
          if (!busy) {
            setCredential(undefined);
          }
        }}
      >
        <ErrorNotice error={actionError} />
        <BodyText muted>{credential?.integrationID}</BodyText>
        <Field
          label="Account name"
          value={label}
          editable={!busy}
          onChangeText={setLabel}
        />
        <Button
          title="Save name"
          busy={busy}
          onPress={() => {
            void run(async (signal) => {
              if (!credential) {
                return;
              }
              await client.credential.update(
                { credentialID: credential.id, label: label.trim() },
                { signal }
              );
              signal.throwIfAborted();
              setCredential(undefined);
            });
          }}
        />
        {!credential?.active && (
          <Button
            title="Use this account"
            variant="primary"
            busy={busy}
            onPress={() => {
              void run(async (signal) => {
                if (!credential) {
                  return;
                }
                await client.credential.activate(
                  { credentialID: credential.id },
                  { signal }
                );
                signal.throwIfAborted();
                setCredential(undefined);
              });
            }}
          />
        )}
        <Button
          title="Remove account"
          variant="danger"
          busy={busy}
          onPress={() => {
            if (!credential) {
              return;
            }
            const credentialID = credential.id;
            void confirmAction(
              "Remove account?",
              "This removes the saved credential from your OpenCode server."
            ).then((confirmed) => {
              if (confirmed) {
                void run(async (signal) => {
                  await client.credential.remove({ credentialID }, { signal });
                  signal.throwIfAborted();
                  setCredential(undefined);
                });
              }
              return confirmed;
            });
          }}
        />
      </Sheet>
      {selected && (
        <ConnectIntegration
          key={selected.id}
          client={client}
          directory={directory}
          integration={selected}
          onClose={() => {
            setSelected(undefined);
            void refresh();
          }}
        />
      )}
    </Page>
  );
};

const ModelCard = ({
  item,
  onSelect,
}: {
  item: ModelInfo;
  onSelect: (item: ModelInfo) => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <BodyText style={styles.name}>{item.name}</BodyText>
          <BodyText muted>
            {item.providerID} · {item.enabled ? "Available" : "Not connected"}
          </BodyText>
        </View>
        <Button title="Details" compact onPress={() => onSelect(item)} />
      </Row>
    </Card>
  );
};

const ModelsStatus = ({
  hasModels,
  loaded,
  matches,
  onClear,
  search,
}: {
  hasModels: boolean;
  loaded: boolean;
  matches: number;
  onClear: () => void;
  search: string;
}) => {
  if (!loaded) {
    return null;
  }
  if (!hasModels) {
    return (
      <Empty
        title="No models available"
        detail="Your server did not publish a model catalog for this project."
      />
    );
  }
  if (!search || matches) {
    return null;
  }
  return (
    <Card>
      <Empty
        title="No matching models"
        detail="Try a model name, provider, or model ID, or clear the search to see all models."
      />
      <Button title="Clear search" onPress={onClear} />
    </Card>
  );
};

const ProvidersDisclosure = ({
  providers,
}: {
  providers?: readonly { id: string; name: string; activation: string }[];
}) => (
  <Disclosure title={`Providers (${providers?.length ?? 0})`}>
    {providers?.map((item) => (
      <View key={item.id} style={{ gap: 4 }}>
        <BodyText>{item.name}</BodyText>
        <BodyText muted>
          {item.id} · {item.activation}
        </BodyText>
      </View>
    ))}
  </Disclosure>
);

const ModelDetails = ({
  client,
  selected,
}: {
  client: boolean;
  selected: ModelInfo;
}) => {
  const details = client
    ? selected
    : {
        contextWindow: selected.limit.context,
        id: selected.id,
        name: selected.name,
        providerID: selected.providerID,
        thinkingLevels: selected.variants.map((item) => item.id),
      };
  return (
    <>
      <BodyText muted>
        {selected.providerID}/{selected.id}
      </BodyText>
      <BodyText>
        Context: {selected.limit.context.toLocaleString()} tokens
        {client
          ? ` · Output: ${selected.limit.output.toLocaleString()} tokens`
          : ""}
      </BodyText>
      <BodyText>
        Variants:{" "}
        {selected.variants.map((item) => item.id).join(", ") ||
          (client ? "Default" : "Unavailable")}
      </BodyText>
      {client ? (
        <>
          <Disclosure title="Capabilities">
            <JsonView value={selected.capabilities} />
          </Disclosure>
          <Disclosure title="Prices">
            <JsonView value={selected.cost} />
          </Disclosure>
        </>
      ) : (
        <BodyText muted>
          Output limits and prices are unavailable from this server.
        </BodyText>
      )}
      <Disclosure title="Details">
        <JsonView value={details} />
      </Disclosure>
    </>
  );
};

const Models = ({
  catalog,
  client,
  directory,
}: {
  catalog: ModelCatalog;
  client?: Client;
  directory: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client ?? catalog,
    directory,
    async (signal) => {
      const [models, providers] = await Promise.all([
        catalog.list(
          { location: { directory }, types: ["chat", "image", "decision"] },
          { signal }
        ),
        client?.provider.list({ location: { directory } }, { signal }),
      ]);
      return { models: models.data, providers: providers?.data };
    }
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ModelInfo>();
  const [limit, setLimit] = useState(40);
  const changeQuery = (next: string) => {
    if (next !== query) {
      setLimit(40);
    }
    setQuery(next);
  };
  const search = query.trim().toLowerCase();
  const models =
    data?.models.filter((item) =>
      `${item.name} ${item.providerID} ${item.id}`
        .toLowerCase()
        .includes(search)
    ) ?? [];
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <Row style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
        <Field
          label="Find a model"
          placeholder="Name or provider"
          value={query}
          onChangeText={changeQuery}
          containerStyle={{ flex: 1 }}
        />
        {!!query && (
          <Button
            title="Clear"
            accessibilityLabel="Clear model search"
            compact
            variant="ghost"
            onPress={() => changeQuery("")}
          />
        )}
      </Row>
      <BodyText muted>
        Select a model inside a chat to use it.
        {client
          ? " Edit configuration to change server defaults or custom providers."
          : ""}
      </BodyText>
      <BodyText style={styles.sectionLabel}>{models.length} MODELS</BodyText>
      {models.slice(0, limit).map((item) => (
        <ModelCard
          key={`${item.providerID}/${item.id}`}
          item={item}
          onSelect={setSelected}
        />
      ))}
      {models.length > limit && (
        <>
          <BodyText muted>
            Showing {limit} of {models.length} models.
          </BodyText>
          <Button
            title="Load more models"
            onPress={() => setLimit((value) => value + 40)}
          />
        </>
      )}
      <ModelsStatus
        hasModels={!!data?.models.length}
        loaded={!!data && !loading}
        matches={models.length}
        search={search}
        onClear={() => changeQuery("")}
      />
      {client && <ProvidersDisclosure providers={data?.providers} />}
      <Sheet
        visible={!!selected}
        title={selected?.name || "Model"}
        onClose={() => setSelected(undefined)}
      >
        {selected && <ModelDetails selected={selected} client={!!client} />}
      </Sheet>
    </Page>
  );
};

const Mcp = ({ client, directory }: { client: Client; directory: string }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client,
    directory,
    async (signal) => {
      const response = await client.mcp.list(
        { location: { directory } },
        { signal }
      );
      return response.data;
    }
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"remote" | "local">("remote");
  const [url, setUrl] = useState("");
  const [command, setCommand] = useState("");
  const [resources, setResources] = useState<unknown>();
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    setErrorAction(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await withSettingsRequest(async (signal) => {
        await action(signal);
        await refresh(signal);
      });
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <GlobalForms client={client} directory={directory} />
      <Row>
        <Button
          title="Add MCP server"
          variant="primary"
          disabled={busy}
          onPress={() => {
            setAdding(true);
            setErrorAction(null);
          }}
        />
        <Button
          title="Resources"
          disabled={busy}
          onPress={() => {
            void run(async (signal) => {
              const result = await client.mcp.resource.catalog(
                { location: { directory } },
                { signal }
              );
              signal.throwIfAborted();
              setResources(result.data);
            });
          }}
        />
      </Row>
      <ErrorNotice error={errorAction} />
      {data?.map((item) => (
        <Card key={item.name}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.name}>{item.title || item.name}</BodyText>
              <BodyText muted>
                {item.name} · {item.status.status.replace("_", " ")}
              </BodyText>
            </View>
            <Button
              title={
                item.status.status === "connected" ? "Disconnect" : "Connect"
              }
              busy={busy}
              compact
              onPress={() => {
                void run(async (signal) => {
                  const input = { location: { directory }, server: item.name };
                  await (item.status.status === "connected"
                    ? client.experimental.mcp.disconnect(input, { signal })
                    : client.experimental.mcp.connect(input, { signal }));
                });
              }}
            />
          </Row>
          {"error" in item.status && (
            <BodyText style={{ color: colors.danger }}>
              {item.status.error}
            </BodyText>
          )}
          {item.status.status === "needs_auth" && (
            <BodyText muted>
              Connect its account in the Accounts tab. The integration name is{" "}
              {item.integrationID || item.name}.
            </BodyText>
          )}
          <Button
            title="Remove"
            variant="danger"
            compact
            busy={busy}
            onPress={() => {
              void confirmAction(
                "Remove MCP server?",
                `This removes ${item.name} from the project configuration.`
              ).then((confirmed) => {
                if (confirmed) {
                  void run(async (signal) => {
                    await client.experimental.mcp.remove(
                      { location: { directory }, server: item.name },
                      { signal }
                    );
                  });
                }
                return confirmed;
              });
            }}
          />
        </Card>
      ))}
      {data && !data.length && (
        <Empty
          title="No MCP servers"
          detail="Connect tools and resources from your own servers."
        />
      )}
      <Sheet
        visible={resources !== undefined}
        title="MCP resources"
        onClose={() => setResources(undefined)}
      >
        <JsonView value={resources} />
      </Sheet>
      <Sheet
        visible={adding}
        title="Add MCP server"
        onClose={() => {
          if (!busy) {
            setAdding(false);
          }
        }}
      >
        <ErrorNotice error={errorAction} />
        <Field
          label="Server name"
          value={name}
          editable={!busy}
          onChangeText={setName}
          placeholder="my-tools"
        />
        <Row>
          <Button
            title="Remote URL"
            disabled={busy}
            variant={kind === "remote" ? "primary" : "secondary"}
            onPress={() => setKind("remote")}
          />
          <Button
            title="Server command"
            disabled={busy}
            variant={kind === "local" ? "primary" : "secondary"}
            onPress={() => setKind("local")}
          />
        </Row>
        {kind === "remote" ? (
          <Field
            label="MCP URL"
            keyboardType="url"
            value={url}
            editable={!busy}
            onChangeText={setUrl}
            placeholder="https://example.com/mcp"
          />
        ) : (
          <>
            <Field
              label="Command arguments (JSON array)"
              multiline
              value={command}
              editable={!busy}
              onChangeText={setCommand}
              placeholder='["npx", "-y", "your-mcp-server"]'
            />
            <BodyText muted>The command runs on the OpenCode server.</BodyText>
          </>
        )}
        <Button
          title="Add server"
          variant="primary"
          busy={busy}
          disabled={!name.trim()}
          onPress={() => {
            void run(async (signal) => {
              const server = name.trim();
              if (kind === "remote") {
                await client.experimental.mcp.add(
                  {
                    config: { type: "remote", url: externalURL(url.trim()) },
                    location: { directory },
                    server,
                  },
                  { signal }
                );
              } else {
                const args: unknown = JSON.parse(command);
                if (
                  !Array.isArray(args) ||
                  !args.length ||
                  !args.every((arg) => typeof arg === "string" && arg.length)
                ) {
                  throw new Error("Enter a JSON array of command arguments");
                }
                await client.experimental.mcp.add(
                  {
                    config: { command: args, type: "local" },
                    location: { directory },
                    server,
                  },
                  { signal }
                );
              }
              signal.throwIfAborted();
              setAdding(false);
              setName("");
              setUrl("");
              setCommand("");
            });
          }}
        />
      </Sheet>
    </Page>
  );
};

const Configuration = ({
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
      const [entries, shells] = await Promise.all([
        client.config.get({ location: { directory } }, { signal }),
        client.config.shells({ signal }),
      ]);
      return { entries, shells };
    }
  );
  const [editing, setEditing] = useState<{
    path: string;
    original: string | null;
  }>();
  const [text, setText] = useState("");
  useUnsavedChanges(
    `configuration:${directory}`,
    "Configuration editor",
    Boolean(editing && text !== editing.original)
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    setErrorAction(null);
    setNotice(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await withSettingsRequest(action);
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        These files define agents, models, providers, permissions, tools, and
        other server options.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {notice && (
        <BodyText style={{ color: colors.success }}>{notice}</BodyText>
      )}
      <Button
        title="Reload server configuration"
        busy={busy}
        onPress={() => {
          void run(async (signal) => {
            await client.location.reload({ signal });
            await refresh(signal);
            signal.throwIfAborted();
            setNotice("I reloaded the server configuration.");
          });
        }}
      />
      <Button
        title="Open project configuration"
        busy={busy}
        onPress={() => {
          void run(async (signal) => {
            const path = `${directory.replace(/[\\/]+$/u, "")}/opencode.jsonc`;
            try {
              const source = new TextDecoder().decode(
                await client.file.read(
                  { location: { directory }, path },
                  { signal }
                )
              );
              signal.throwIfAborted();
              setEditing({ original: source, path });
              setText(source);
            } catch (error_) {
              if (!isFileNotFoundError(error_)) {
                throw error_;
              }
              signal.throwIfAborted();
              setEditing({ original: null, path });
              setText('{\n  "$schema": "https://opencode.ai/config.json"\n}\n');
            }
          });
        }}
      />
      {data?.entries.map((entry, index) => (
        <Card key={index}>
          <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
            {entry.path || "Runtime configuration"}
          </BodyText>
          <BodyText muted>
            {entry.type === "directory"
              ? "Configuration directory"
              : "Configuration document"}
          </BodyText>
          {entry.type === "document" && (
            <>
              <Disclosure title="Read effective values">
                <JsonView value={entry.info} />
              </Disclosure>
              {entry.path && (
                <Button
                  title="Edit source file"
                  compact
                  busy={busy}
                  onPress={() => {
                    void run(async (signal) => {
                      if (!entry.path) {
                        return;
                      }
                      const source = new TextDecoder().decode(
                        await client.file.read(
                          { location: { directory }, path: entry.path },
                          { signal }
                        )
                      );
                      signal.throwIfAborted();
                      setEditing({ original: source, path: entry.path });
                      setText(source);
                    });
                  }}
                />
              )}
            </>
          )}
        </Card>
      ))}
      <Disclosure title="Default shell">
        <BodyText muted>
          This sets the shell for commands on your OpenCode server.
        </BodyText>
        <Button
          title="Use system default"
          busy={busy}
          onPress={() => {
            void run(async (signal) => {
              await client.experimental.config.update(
                { shell: null },
                { signal }
              );
              await refresh(signal);
              signal.throwIfAborted();
              setNotice("I set the shell to the system default.");
            });
          }}
        />
        {data?.shells.map((shell) => (
          <Button
            key={shell.path}
            title={`${shell.name} · ${shell.path}`}
            disabled={!shell.acceptable}
            busy={busy}
            onPress={() => {
              void run(async (signal) => {
                await client.experimental.config.update(
                  { shell: shell.path },
                  { signal }
                );
                await refresh(signal);
                signal.throwIfAborted();
                setNotice(`I selected ${shell.name}.`);
              });
            }}
          />
        ))}
      </Disclosure>
      <Sheet
        visible={!!editing}
        title="Edit configuration"
        onClose={() => {
          if (busy) {
            return;
          }
          if (text === editing?.original) {
            setEditing(undefined);
          } else {
            void confirmAction(
              "Discard changes?",
              "Your unsaved changes will be lost."
            ).then((ok) => {
              if (ok) {
                setEditing(undefined);
              }
              return ok;
            });
          }
        }}
      >
        <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
          {editing?.path}
        </BodyText>
        <ErrorNotice error={errorAction} />
        <Field
          label="JSON or JSONC"
          multiline
          editable={!busy}
          value={text}
          onChangeText={setText}
          style={{
            fontFamily: mono,
            fontSize: 13,
            lineHeight: 21,
            minHeight: 360,
          }}
        />
        <Button
          title="Save and reload"
          busy={busy}
          variant="primary"
          disabled={text === editing?.original}
          onPress={() => {
            void run(async (signal) => {
              if (!editing) {
                return;
              }
              await saveConfigFile(
                client,
                directory,
                editing.path,
                editing.original,
                text,
                signal
              );
              setEditing({ ...editing, original: text });
              await client.location.reload({ signal });
              await refresh(signal);
              signal.throwIfAborted();
              setEditing(undefined);
              setNotice("I saved and reloaded the configuration.");
            });
          }}
        />
      </Sheet>
    </Page>
  );
};

const Skills = ({
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

const Plugins = ({
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
      const response = await client.plugin.list(
        { location: { directory } },
        { signal }
      );
      return response.data;
    }
  );
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setErrorAction(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await action();
      await refresh();
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        Edit the plugins list in your configuration to add or disable a plugin.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {notice && (
        <BodyText style={{ color: colors.success }}>{notice}</BodyText>
      )}
      <Button
        title="Check package updates"
        busy={busy}
        onPress={() => {
          void run(async () => {
            const result = await client.plugin.check({
              location: { directory },
            });
            setNotice(
              `${result.data.filter((item) => item.source.type === "package" && item.source.outdated).length} package updates available.`
            );
          });
        }}
      />
      {data?.map((item, index) => (
        <Card key={`${item.id}:${index}`}>
          <BodyText style={styles.name}>
            {item.id ||
              (item.source.type === "package" ? item.source.target : "Plugin")}
          </BodyText>
          <BodyText muted>
            {item.source.type} · {item.state.status}
          </BodyText>
          {item.state.status === "failed" && (
            <BodyText style={{ color: colors.danger }}>
              {item.state.error}
            </BodyText>
          )}
          {item.source.type === "package" && (
            <>
              <BodyText muted>
                {item.source.target}
                {item.source.version ? ` · ${item.source.version}` : ""}
              </BodyText>
              <Button
                title={
                  item.source.outdated
                    ? "Update package"
                    : "Reinstall latest package"
                }
                compact
                busy={busy}
                onPress={() => {
                  void run(async () => {
                    if (
                      item.source.type === "package" &&
                      (await confirmAction(
                        "Update plugin?",
                        "This installs the latest package version on your server."
                      ))
                    ) {
                      await client.plugin.update({
                        location: { directory },
                        targets: [item.source.target],
                      });
                    }
                  });
                }}
              />
            </>
          )}
          <BodyText muted>
            {Object.entries(item.features)
              .filter(([, enabled]) => enabled)
              .map(([feature]) => feature)
              .join(" · ")}
          </BodyText>
          {item.features.gui && (
            <BodyText muted>
              This plugin includes a desktop web interface. Its tools and
              commands remain available through the server.
            </BodyText>
          )}
        </Card>
      ))}
    </Page>
  );
};

const Permissions = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client,
    directory,
    async (signal) => {
      const location = await client.location.get(
        { location: { directory } },
        { signal }
      );
      return client.permission.saved.list(
        { projectID: location.project.id },
        { signal }
      );
    }
  );
  const [selected, setSelected] = useState<PermissionSavedInfo>();
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const run = async (task: (signal: AbortSignal) => Promise<void>) => {
    setErrorAction(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await withSettingsRequest(async (signal) => {
        await task(signal);
        await refresh(signal);
      });
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        These are the approvals that you saved with “Always allow” in this
        project.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {data?.map((item) => (
        <Card key={item.id}>
          <BodyText style={styles.name}>{item.action}</BodyText>
          <BodyText style={{ fontFamily: mono }}>{item.resource}</BodyText>
          <Row>
            <Button
              title="Edit"
              compact
              disabled={busy}
              onPress={() => {
                setSelected(item);
                setAction(item.action);
                setResource(item.resource);
                setErrorAction(null);
              }}
            />
            <Button
              title="Revoke"
              variant="danger"
              compact
              busy={busy}
              onPress={() => {
                void confirmAction(
                  "Revoke saved approval?",
                  "OpenCode will ask again when this action requires permission."
                ).then((confirmed) => {
                  if (confirmed) {
                    void run(async (signal) => {
                      await client.permission.saved.remove(
                        { id: item.id },
                        { signal }
                      );
                    });
                  }
                  return confirmed;
                });
              }}
            />
          </Row>
        </Card>
      ))}
      {data && !data.length && (
        <Empty
          title="No saved approvals"
          detail="OpenCode will ask you before protected actions."
        />
      )}
      <Sheet
        visible={!!selected}
        title="Edit saved approval"
        onClose={() => {
          if (!busy) {
            setSelected(undefined);
          }
        }}
      >
        <ErrorNotice error={errorAction} />
        <Field
          label="Action"
          value={action}
          editable={!busy}
          onChangeText={setAction}
        />
        <Field
          label="Resource pattern"
          value={resource}
          editable={!busy}
          onChangeText={setResource}
        />
        <Button
          title="Save approval"
          variant="primary"
          busy={busy}
          disabled={!action.trim() || !resource.trim()}
          onPress={() => {
            void run(async (signal) => {
              if (!selected) {
                return;
              }
              await client.permission.saved.update(
                {
                  action: action.trim(),
                  id: selected.id,
                  resource: resource.trim(),
                },
                { signal }
              );
              signal.throwIfAborted();
              setSelected(undefined);
            });
          }}
        />
      </Sheet>
    </Page>
  );
};

const SettingsSection = ({
  client,
  modelCatalog,
  directory,
  section,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  section: Section;
}) => {
  if (section === "Appearance") {
    return (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <AppearanceSettings />
      </View>
    );
  }
  if (section === "Models") {
    return modelCatalog ? (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <Models catalog={modelCatalog} client={client} directory={directory} />
      </View>
    ) : null;
  }
  if (!client) {
    return null;
  }
  return (
    <View key={`${directory}:${section}`} style={{ flex: 1 }}>
      {section === "Accounts" && (
        <Accounts client={client} directory={directory} />
      )}
      {section === "MCP" && <Mcp client={client} directory={directory} />}
      {section === "Config" && (
        <Configuration client={client} directory={directory} />
      )}
      {section === "Skills" && <Skills client={client} directory={directory} />}
      {section === "Plugins" && (
        <Plugins client={client} directory={directory} />
      )}
      {section === "Permissions" && (
        <Permissions client={client} directory={directory} />
      )}
      {section === "Advanced" && (
        <AdvancedSettings client={client} directory={directory} />
      )}
    </View>
  );
};

const NativeSettingsSection = ({
  client,
  modelCatalog,
  directory,
  section,
  navigation,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  section: Section;
  navigation: NativeStackScreenProps<
    SettingsStackParams,
    "Section"
  >["navigation"];
}) => {
  const { colors } = useTheme();
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const hasUnsavedConfiguration = useHasUnsavedChanges(
    `configuration:${directory}`
  );
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null
  );
  const prompting = useRef(false);
  usePreventRemove(
    section === "Config" && hasUnsavedConfiguration && !pendingAction,
    ({ data }) => {
      if (prompting.current) {
        return;
      }
      prompting.current = true;
      void confirmNavigation().then((leave) => {
        prompting.current = false;
        if (leave) {
          setPendingAction(data.action);
        }
        return leave;
      });
    }
  );
  useEffect(() => {
    if (pendingAction) {
      navigation.dispatch(pendingAction);
    }
  }, [navigation, pendingAction]);
  useEffect(() => {
    navigation.setOptions({
      headerRight: headerRefresh?.refresh
        ? () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
              accessibilityState={{
                busy: headerRefresh.loading,
                disabled: headerRefresh.loading,
              }}
              disabled={headerRefresh.loading}
              onPress={() => headerRefresh.refresh?.()}
              style={{
                alignItems: "center",
                height: 44,
                justifyContent: "center",
                marginEnd: Platform.OS === "android" ? -16 : 0,
                width: 44,
              }}
            >
              {headerRefresh.loading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <ShellIcon name="refresh" color={colors.text} />
              )}
            </Pressable>
          )
        : undefined,
    });
  }, [colors, headerRefresh, navigation]);
  return (
    <HeaderRefreshContext.Provider value={setHeaderRefresh}>
      <SettingsSection
        client={client}
        modelCatalog={modelCatalog}
        directory={directory}
        section={section}
      />
    </HeaderRefreshContext.Provider>
  );
};

const SettingsBackImage = ({ tintColor }: { tintColor: string }) => (
  <ShellIcon name="back" color={tintColor} size={22} />
);

const SettingsBackButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  // The stock iOS image reserves label space even in icon-only mode.
  return (
    <HeaderBackButton
      displayMode="minimal"
      accessibilityLabel={`Back to ${label}`}
      onPress={onPress}
      tintColor={colors.text}
      style={nativeBackInsets}
      backImage={Platform.OS === "ios" ? SettingsBackImage : undefined}
    />
  );
};

const SettingsIndex = ({
  onSelect,
  sections,
  selected,
  wide,
  onManageServers,
  serverLabel,
}: {
  onSelect: (section: Section) => void;
  sections: Section[];
  selected: Section | null;
  wide: boolean;
  onManageServers?: () => void;
  serverLabel?: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ScrollView
      style={wide ? styles.sidebar : undefined}
      contentContainerStyle={styles.index}
    >
      {wide && (
        <View style={styles.indexHeader}>
          <Heading>Settings</Heading>
          <BodyText muted>Preferences, connections, and tools</BodyText>
        </View>
      )}
      {sectionGroups.map((group) => {
        const items = group.items.filter((item) => sections.includes(item));
        const manageServers = group.title === "Connections" && onManageServers;
        if (!items.length && !manageServers) {
          return null;
        }
        return (
          <View key={group.title} style={styles.group}>
            {!(items.length === 1 && items[0] === group.title) && (
              <BodyText muted style={styles.groupTitle}>
                {group.title.toUpperCase()}
              </BodyText>
            )}
            <View style={styles.groupPanel}>
              {manageServers && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Servers. Scan a QR code, paste a link, or switch servers"
                  onPress={onManageServers}
                  style={({ pressed }) => [
                    styles.sectionRow,
                    pressed && { backgroundColor: colors.raised },
                  ]}
                >
                  <View style={styles.detail}>
                    <BodyText style={styles.sectionName}>Servers</BodyText>
                    <BodyText muted style={styles.sectionDescription}>
                      {serverLabel
                        ? `${serverLabel} · Scan or paste a link`
                        : "Scan, paste a link, or switch servers"}
                    </BodyText>
                  </View>
                  <ShellIcon name="chevron" size={16} color={colors.muted} />
                </Pressable>
              )}
              {items.map((item, index) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item}. ${sectionDescriptions[item]}`}
                  accessibilityState={{ selected: selected === item }}
                  aria-current={selected === item ? "page" : undefined}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.sectionRow,
                    wide && selected === item && styles.currentSection,
                    pressed && { backgroundColor: colors.raised },
                  ]}
                >
                  {(index > 0 || !!manageServers) && (
                    <View pointerEvents="none" style={styles.sectionDivider} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <BodyText style={styles.sectionName}>{item}</BodyText>
                    <BodyText
                      muted
                      numberOfLines={1}
                      style={styles.sectionDescription}
                    >
                      {sectionDescriptions[item]}
                    </BodyText>
                  </View>
                  <ShellIcon name="chevron" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

type SettingsNavigationRef =
  NavigationContainerRefWithCurrent<SettingsStackParams>;
type SectionScreenProps = NativeStackScreenProps<
  SettingsStackParams,
  "Section"
>;

const renderBackButton = (label: string, onPress: () => void) => (
  <SettingsBackButton label={label} onPress={onPress} />
);

const renderMenuButton = (color: string, onPress: () => void) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open navigation"
    onPress={onPress}
    style={{
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      marginEnd: Platform.OS === "android" ? -16 : 0,
      width: 44,
    }}
  >
    <ShellIcon name="menu" color={color} />
  </Pressable>
);

const indexScreenOptions = ({
  backLabel,
  betaLayout,
  color,
  onBack,
  onOpenNavigation,
}: {
  backLabel?: string;
  betaLayout: boolean;
  color: string;
  onBack?: () => void;
  onOpenNavigation?: () => void;
}) => ({
  headerLeft: onBack
    ? () => renderBackButton(backLabel || "Sessions", onBack)
    : undefined,
  headerRight:
    !betaLayout && onOpenNavigation
      ? () => renderMenuButton(color, onOpenNavigation)
      : undefined,
  title: "Settings",
});

const sectionScreenOptions = ({
  route,
  navigation,
}: Pick<SectionScreenProps, "navigation" | "route">) => ({
  headerBackButtonDisplayMode: "minimal" as const,
  title: route.params.section,
  ...(Platform.OS === "android"
    ? {
        headerBackVisible: false,
        headerLeft: () =>
          renderBackButton("Settings", () => navigation.goBack()),
      }
    : {}),
});

const SettingsNativeStack = ({
  availableSections,
  backLabel,
  betaLayout,
  client,
  directory,
  modelCatalog,
  navigationRef,
  onBack,
  onOpenNavigation,
  onReady,
  renderIndex,
}: {
  availableSections: Section[];
  backLabel?: string;
  betaLayout: boolean;
  client?: Client;
  directory: string;
  modelCatalog?: ModelCatalog;
  navigationRef: SettingsNavigationRef;
  onBack?: () => void;
  onOpenNavigation?: () => void;
  onReady: () => void;
  renderIndex: () => React.ReactElement;
}) => {
  const { colors, scheme } = useTheme();
  const reducedMotion = useMotionPreference();
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.bg,
        border: colors.border,
        card: colors.panel,
        notification: colors.danger,
        primary: colors.accent,
        text: colors.text,
      },
      dark: scheme === "dark",
    }),
    [colors, scheme]
  );
  return (
    <BaseNavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={onReady}
      onStateChange={onReady}
    >
      <SettingsStack.Navigator
        screenOptions={{
          animation: reducedMotion ? "fade" : "default",
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
            fontFamily: "Inter",
            fontSize: 18,
            fontWeight: "600",
          },
        }}
      >
        <SettingsStack.Screen
          name="Index"
          options={indexScreenOptions({
            backLabel,
            betaLayout,
            color: colors.text,
            onBack,
            onOpenNavigation,
          })}
        >
          {renderIndex}
        </SettingsStack.Screen>
        <SettingsStack.Screen name="Section" options={sectionScreenOptions}>
          {({ route, navigation: screenNavigation }) =>
            availableSections.includes(route.params.section) ? (
              <NativeSettingsSection
                client={client}
                modelCatalog={modelCatalog}
                directory={directory}
                section={route.params.section}
                navigation={screenNavigation}
              />
            ) : null
          }
        </SettingsStack.Screen>
      </SettingsStack.Navigator>
    </BaseNavigationContainer>
  );
};

const filterSections = (
  sections: Section[],
  hasClient: boolean,
  hasModelCatalog: boolean
) =>
  sections.filter(
    (value) =>
      hasClient ||
      value === "Appearance" ||
      (value === "Models" && hasModelCatalog)
  );

const resolveSelected = (
  section: Section | null,
  availableSections: Section[],
  wide: boolean
) => {
  if (section !== null && availableSections.includes(section)) {
    return section;
  }
  if (!wide) {
    return null;
  }
  return availableSections.includes("Accounts")
    ? "Accounts"
    : (availableSections[0] ?? null);
};

const useInlineBackHandling = ({
  changeSection,
  nativeStackEnabled,
  onBackStateChange,
  section,
  visible,
  wide,
}: {
  changeSection: (next: Section | null) => Promise<boolean>;
  nativeStackEnabled: boolean;
  onBackStateChange?: (canGoBack: boolean) => void;
  section: Section | null;
  visible: boolean;
  wide: boolean;
}) => {
  useEffect(() => {
    if (nativeStackEnabled) {
      return;
    }
    onBackStateChange?.(visible && !wide && section !== null);
    return () => onBackStateChange?.(false);
  }, [nativeStackEnabled, onBackStateChange, visible, wide, section]);
  useEffect(() => {
    if (nativeStackEnabled || !visible || wide || section === null) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        void changeSection(null);
        return true;
      }
    );
    return () => subscription.remove();
  }, [nativeStackEnabled, visible, wide, section, changeSection]);
};

const useNativeStackBackHandling = ({
  nativeStackEnabled,
  navigationRef,
  onBackStateChange,
  visible,
  wide,
}: {
  nativeStackEnabled: boolean;
  navigationRef: SettingsNavigationRef;
  onBackStateChange?: (canGoBack: boolean) => void;
  visible: boolean;
  wide: boolean;
}) => {
  const updateNativeBackState = useCallback(() => {
    if (!nativeStackEnabled) {
      return;
    }
    const canGoBack = navigationRef.current?.canGoBack() ?? false;
    onBackStateChange?.(visible && !wide && canGoBack);
  }, [nativeStackEnabled, navigationRef, onBackStateChange, visible, wide]);
  useEffect(() => {
    updateNativeBackState();
    return () => onBackStateChange?.(false);
  }, [updateNativeBackState, onBackStateChange]);
  useEffect(() => {
    if (!nativeStackEnabled || !visible) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!navigationRef.current?.canGoBack()) {
          return false;
        }
        navigationRef.current.goBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [nativeStackEnabled, navigationRef, visible]);
  return updateNativeBackState;
};

const SettingsInlineLayout = ({
  backLabel,
  changeSection,
  onBack,
  onOpenNavigation,
  renderIndex,
  renderSection,
  section,
  selected,
  wide,
}: {
  backLabel?: string;
  changeSection: (next: Section | null) => Promise<boolean>;
  onBack?: () => void;
  onOpenNavigation?: () => void;
  renderIndex: () => React.ReactElement;
  renderSection: (value: Section) => React.ReactElement;
  section: Section | null;
  selected: Section | null;
  wide: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const atIndex = section === null;
  return (
    <>
      {!wide && (
        <ScreenHeader
          title={selected ?? "Settings"}
          backLabel={atIndex ? backLabel : "Settings"}
          onBack={
            atIndex
              ? onBack
              : () => {
                  void changeSection(null);
                }
          }
          onOpenNavigation={atIndex ? onOpenNavigation : undefined}
          onRefresh={atIndex ? undefined : headerRefresh?.refresh}
          refreshing={headerRefresh?.loading}
        />
      )}
      <HeaderRefreshContext.Provider value={wide ? null : setHeaderRefresh}>
        <View style={[styles.content, !wide && styles.narrowContent]}>
          {(wide || atIndex) && renderIndex()}
          {selected && (wide || !atIndex) && (
            <View style={styles.detail}>
              {wide && (
                <Row style={styles.detailHeader}>
                  <BodyText
                    accessibilityRole="header"
                    style={styles.detailTitle}
                  >
                    {selected}
                  </BodyText>
                </Row>
              )}
              {renderSection(selected)}
            </View>
          )}
        </View>
      </HeaderRefreshContext.Provider>
    </>
  );
};

const keepState = (state: boolean) => state;
const isNativeStackWidth = (width: number) =>
  Platform.OS !== "web" && width < 920;

export const SettingsScreen = ({
  client,
  modelCatalog: modelCatalogProp,
  directory,
  sections = allSections,
  visible = true,
  onBackStateChange,
  onBack,
  backLabel,
  onOpenNavigation,
  betaLayout = false,
  onManageServers,
  serverLabel,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  sections?: Section[];
  visible?: boolean;
  onBackStateChange?: (canGoBack: boolean) => void;
  onBack?: () => void;
  backLabel?: string;
  onOpenNavigation?: () => void;
  betaLayout?: boolean;
  onManageServers?: () => void;
  serverLabel?: string;
}) => {
  const modelCatalog = modelCatalogProp ?? client?.model;
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  // A resize must not replace the navigator and discard an open editor.
  const [nativeStackEnabled] = useReducer(keepState, width, isNativeStackWidth);
  const wide = !betaLayout && !nativeStackEnabled && width >= 920;
  const [section, setSection] = useState<Section | null>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const mounted = useRef(true);
  const navigationRef = useNavigationContainerRef<SettingsStackParams>();
  const hasClient = !!client;
  const hasModelCatalog = !!modelCatalog;
  const availableSections = useMemo(
    () => filterSections(sections, hasClient, hasModelCatalog),
    [hasClient, hasModelCatalog, sections]
  );
  const selected = resolveSelected(section, availableSections, wide);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const changeSection = useCallback(
    async (next: Section | null) => {
      if (next !== null && !availableSections.includes(next)) {
        return false;
      }
      if (next === section) {
        return true;
      }
      if (section !== null && !(await confirmNavigation())) {
        return false;
      }
      if (!mounted.current) {
        return false;
      }
      setSection(next);
      return true;
    },
    [section, availableSections, confirmNavigation]
  );
  useInlineBackHandling({
    changeSection,
    nativeStackEnabled,
    onBackStateChange,
    section,
    visible,
    wide,
  });
  const updateNativeBackState = useNativeStackBackHandling({
    nativeStackEnabled,
    navigationRef,
    onBackStateChange,
    visible,
    wide,
  });

  const renderIndex = () => (
    <SettingsIndex
      onSelect={(next) => {
        if (!nativeStackEnabled) {
          void changeSection(next);
          return;
        }
        navigationRef.navigate("Section", { section: next });
      }}
      sections={availableSections}
      selected={selected}
      wide={wide}
      onManageServers={onManageServers}
      serverLabel={serverLabel}
    />
  );
  const renderSection = (value: Section) => (
    <SettingsSection
      client={client}
      modelCatalog={modelCatalog}
      directory={directory}
      section={value}
    />
  );

  return (
    <View style={[styles.screen, !wide && styles.narrowScreen]}>
      {nativeStackEnabled ? (
        <SafeAreaInsetsContext.Provider value={zeroInsets}>
          <View style={styles.nativeNavigation}>
            <SettingsNativeStack
              availableSections={availableSections}
              backLabel={backLabel}
              betaLayout={betaLayout}
              client={client}
              directory={directory}
              modelCatalog={modelCatalog}
              navigationRef={navigationRef}
              onBack={onBack}
              onOpenNavigation={onOpenNavigation}
              onReady={updateNativeBackState}
              renderIndex={renderIndex}
            />
          </View>
        </SafeAreaInsetsContext.Provider>
      ) : (
        <SettingsInlineLayout
          backLabel={backLabel}
          changeSection={changeSection}
          onBack={onBack}
          onOpenNavigation={onOpenNavigation}
          renderIndex={renderIndex}
          renderSection={renderSection}
          section={section}
          selected={selected}
          wide={wide}
        />
      )}
    </View>
  );
};
