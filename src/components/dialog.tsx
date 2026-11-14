import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useModalSchemeKey } from "../lib/modal-scheme";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useMotionPreference } from "./motion";
import { elevation, radius } from "./surface";
import { Button, Field, sans } from "./ui";
import type { ButtonVariant } from "./ui";

export interface DialogField {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences";
  returnKeyType?: "done" | "go";
  isValid?: (value: string) => boolean;
}

export interface DialogAction {
  label: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: (fieldValue: string) => void;
}

export interface DialogOptions {
  title: string;
  message?: string;
  field?: DialogField;
  actions: DialogAction[];
}

interface QueuedDialog {
  id: number;
  options: DialogOptions;
}

const ENTER_MS = 150;
const REDUCED_MS = 80;
const ENTER_SCALE = 0.96;
const MAX_WIDTH = 480;
const SIDE_GUTTER = 32;
const easeOutStrong = Easing.bezier(0.23, 1, 0.32, 1);

let queue: readonly QueuedDialog[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

const publish = (next: readonly QueuedDialog[]) => {
  queue = next;
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => queue;

const dismissDialog = (id: number) => {
  publish(queue.filter((entry) => entry.id !== id));
};

export const showDialog = (options: DialogOptions) => {
  nextId += 1;
  publish([...queue, { id: nextId, options }]);
};

export const confirmAction = (
  title: string,
  message: string,
  options: {
    confirmLabel: string;
    destructive?: boolean;
    cancelLabel?: string;
  }
): Promise<boolean> => {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  showDialog({
    actions: [
      {
        label: options.cancelLabel ?? "Cancel",
        onPress: () => resolve(false),
        style: "cancel",
      },
      {
        label: options.confirmLabel,
        onPress: () => resolve(true),
        style: options.destructive === false ? "default" : "destructive",
      },
    ],
    message,
    title,
  });
  return promise;
};

export const promptText = (
  title: string,
  options: {
    message?: string;
    field: DialogField;
    confirmLabel: string;
    cancelLabel?: string;
  }
): Promise<string | null> => {
  const { promise, resolve } = Promise.withResolvers<string | null>();
  showDialog({
    actions: [
      {
        label: options.cancelLabel ?? "Cancel",
        onPress: () => resolve(null),
        style: "cancel",
      },
      {
        label: options.confirmLabel,
        onPress: (value) => resolve(value.trim()),
        style: "default",
      },
    ],
    field: options.field,
    message: options.message,
    title,
  });
  return promise;
};

const isNonEmpty = (value: string) => value.trim().length > 0;

const buttonVariant = (style: DialogAction["style"]): ButtonVariant => {
  if (style === "cancel") {
    return "secondary";
  }
  return style === "destructive" ? "danger" : "primary";
};

const useDialogMotion = () => {
  const reduced = useMotionPreference();
  const progress = useSharedValue(0);
  useLayoutEffect(() => {
    progress.value = withTiming(1, {
      duration: reduced ? REDUCED_MS : ENTER_MS,
      easing: easeOutStrong,
    });
  }, [progress, reduced]);
  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced
      ? []
      : [{ scale: ENTER_SCALE + (1 - ENTER_SCALE) * progress.value }],
  }));
  return { panel, scrim };
};

const DialogBody = ({
  options,
  onFinish,
}: {
  options: DialogOptions;
  onFinish: () => void;
}) => {
  const { scheme } = useTheme();
  const modalKey = useModalSchemeKey();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const { panel, scrim } = useDialogMotion();
  const [value, setValue] = useState(options.field?.defaultValue ?? "");
  const finished = useRef(false);
  const { field, actions } = options;
  const valid = field ? (field.isValid ?? isNonEmpty)(value) : true;
  const cancel = actions.find((action) => action.style === "cancel");
  const confirm = actions.findLast((action) => action.style !== "cancel");
  const run = useCallback(
    (action: DialogAction | undefined) => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      onFinish();
      action?.onPress?.(value);
    },
    [onFinish, value]
  );
  return (
    <Modal
      key={modalKey}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => run(cancel)}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, scrim]}>
          <Pressable
            accessibilityLabel="Dismiss dialog"
            accessibilityRole="button"
            onPress={() => run(cancel)}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.container,
            {
              boxShadow: elevation(scheme).overlay,
              width: Math.min(width - SIDE_GUTTER, MAX_WIDTH),
            },
            panel,
          ]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {options.title}
            </Text>
            {options.message ? (
              <Text style={styles.message}>{options.message}</Text>
            ) : null}
          </View>
          {field ? (
            <View style={styles.field}>
              <Field
                autoFocus
                selectTextOnFocus
                autoCapitalize={field.autoCapitalize}
                keyboardType={field.keyboardType}
                label={field.label}
                onChangeText={setValue}
                onSubmitEditing={() => {
                  if (valid) {
                    run(confirm);
                  }
                }}
                placeholder={field.placeholder}
                returnKeyType={field.returnKeyType}
                value={value}
              />
            </View>
          ) : null}
          <View style={styles.footer}>
            {actions.map((action) => (
              <Button
                key={`${action.style ?? "default"}:${action.label}`}
                disabled={action.style !== "cancel" && !valid}
                onPress={() => run(action)}
                title={action.label}
                variant={buttonVariant(action.style)}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const DialogHost = ({ entry }: { entry: QueuedDialog }) => {
  const { presentSheet, dismissSheet } = useSheetCoordinator();
  const id = useId();
  useLayoutEffect(() => {
    presentSheet(id);
    return () => {
      dismissSheet(id);
    };
  }, [id, presentSheet, dismissSheet]);
  const finish = useCallback(() => dismissDialog(entry.id), [entry.id]);
  return <DialogBody onFinish={finish} options={entry.options} />;
};

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [current] = entries;
  return (
    <>
      {children}
      {current ? <DialogHost key={current.id} entry={current} /> : null}
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.panel,
      borderRadius: radius.md,
    },
    field: { paddingBottom: 16, paddingHorizontal: 16 },
    footer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "flex-end",
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    header: { gap: 4, padding: 16 },
    message: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "400",
      letterSpacing: -0.04,
      lineHeight: 20,
    },
    root: { alignItems: "center", flex: 1, justifyContent: "center" },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
    title: {
      color: colors.text,
      fontFamily: sans,
      fontSize: 15,
      fontWeight: "500",
      letterSpacing: -0.13,
      lineHeight: 20,
    },
  });
