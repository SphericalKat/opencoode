import { BottomSheetSectionList } from "@gorhom/bottom-sheet";
import type { ModelInfo } from "@opencode/client";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AnchoredMenu, useContextMenu } from "../../components/anchored-menu";
import { IconButton } from "../../components/icon-button";
import {
  ListSheet,
  SheetGroupItem,
  SheetRow,
} from "../../components/list-sheet";
import type { ListSheetOption } from "../../components/list-sheet";
import { useMotionPreference } from "../../components/motion";
import { ProjectAvatar } from "../../components/project-avatar";
import { ShellIcon } from "../../components/shell-icon";
import { elevation } from "../../components/surface";
import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  Sheet,
} from "../../components/ui";
import { playHaptic } from "../../lib/haptics";
import { modelPreferenceID } from "../../lib/model-preferences";
import { useTheme } from "../../lib/theme";
import { emptyModelsTitle, emptyModelsDetail } from "./labels";
import type { ModelGroup } from "./model-groups";
import { capitalizeFirst } from "./model-label";
import type { ChatController } from "./use-chat-controller";

type VariantsSheetProps = Pick<
  ChatController,
  | "capabilities"
  | "chooseModel"
  | "currentModel"
  | "error"
  | "panel"
  | "pending"
  | "selectedVariant"
  | "setPanel"
>;

const defaultVariantValue = "default";

export const VariantsSheet = ({
  capabilities,
  chooseModel,
  currentModel,
  error,
  panel,
  pending,
  selectedVariant: stagedVariant,
  setPanel,
}: VariantsSheetProps) => {
  const selectedVariant = stagedVariant ?? defaultVariantValue;
  const options: ListSheetOption<string>[] = [];
  if (currentModel && capabilities.defaultVariant) {
    options.push({
      value: defaultVariantValue,
      label: "Default",
      disabled: pending,
    });
  }
  for (const variant of currentModel?.variants ?? []) {
    options.push({
      value: variant.id,
      label: capitalizeFirst(variant.id),
      disabled: pending,
    });
  }
  return (
    <ListSheet
      visible={panel === "variants"}
      title="Choose variant"
      variant="grouped"
      value={selectedVariant}
      options={options}
      header={<ErrorNotice error={error} />}
      onSelect={(value) => {
        if (currentModel) {
          void chooseModel(
            currentModel,
            value === defaultVariantValue ? undefined : value,
            true
          );
        }
      }}
      onClose={() => setPanel(null)}
    />
  );
};

const maxListHeight = 360;
const listHeightRatio = 0.4;
const chevronDuration = 150;
const collapsedRotation = -90;

const styles = StyleSheet.create({
  chevron: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  clear: { position: "absolute", right: 8, top: 8 },
  content: { paddingBottom: 16, paddingHorizontal: 12, paddingTop: 4 },
  empty: { gap: 12, paddingVertical: 24 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  header: { alignItems: "center", minHeight: 44 },
  headerLabel: { alignItems: "center", flexDirection: "row", gap: 8 },
  headerTrigger: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 4,
    flexDirection: "row",
    gap: 4,
    height: 28,
    paddingEnd: 8,
    paddingStart: 4,
  },
  headerWrap: { alignSelf: "stretch" },
  search: { paddingBottom: 12, paddingHorizontal: 12, paddingTop: 1 },
  searchInput: {
    borderRadius: 6,
    fontSize: 13,
    height: 40,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "500", lineHeight: 16 },
});

const ProviderChevron = ({ collapsed }: { collapsed: boolean }) => {
  const { colors } = useTheme();
  const reduced = useMotionPreference();
  const rotation = useSharedValue(collapsed ? collapsedRotation : 0);
  useEffect(() => {
    rotation.value = withTiming(collapsed ? collapsedRotation : 0, {
      duration: reduced ? 0 : chevronDuration,
    });
  }, [collapsed, reduced, rotation]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={[styles.chevron, animated]}>
      <ShellIcon name="chevron-down" size={16} color={colors.faint} />
    </Animated.View>
  );
};

interface SectionHeaderProps {
  collapsed: boolean;
  disabled: boolean;
  first: boolean;
  group: ModelGroup;
  onToggle: () => void;
}

const SectionHeader = ({
  collapsed,
  disabled,
  first,
  group,
  onToggle,
}: SectionHeaderProps) => {
  const { colors } = useTheme();
  const title = (
    <BodyText style={[styles.sectionTitle, { color: colors.text }]}>
      {group.title}
    </BodyText>
  );
  const frame = {
    backgroundColor: colors.frame,
    paddingTop: first ? 0 : 12,
  };
  if (!group.providerID) {
    return (
      <View style={[styles.headerWrap, frame]}>
        <View accessibilityRole="header" style={styles.header}>
          <View style={[styles.headerTrigger, { paddingStart: 4 }]}>
            {title}
          </View>
        </View>
      </View>
    );
  }
  const expanded = disabled || !collapsed;
  return (
    <View style={[styles.headerWrap, frame]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={group.title}
        accessibilityState={{ disabled, expanded }}
        disabled={disabled}
        onPress={onToggle}
        style={styles.header}
      >
        <View style={styles.headerTrigger}>
          <ProviderChevron collapsed={!expanded} />
          <View style={styles.headerLabel}>
            <ProjectAvatar name={group.title} ringColor={colors.frame} />
            {title}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

interface ModelSearchFieldProps {
  modelSearch: string;
  onSubmit: () => void;
  setModelSearch: (value: string) => void;
}

const ModelSearchField = ({
  modelSearch,
  onSubmit,
  setModelSearch,
}: ModelSearchFieldProps) => {
  const { colors, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.search}>
      <Field
        value={modelSearch}
        onChangeText={setModelSearch}
        placeholder="Search models"
        accessibilityLabel="Search models"
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        returnKeyType="search"
        spellCheck={false}
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.bg,
            borderBottomColor: focused ? colors.focus : colors.bg,
            borderColor: focused ? colors.focus : colors.bg,
            borderWidth: focused ? 1 : 0,
            boxShadow: focused ? [] : elevation(scheme).input,
            paddingEnd: modelSearch ? 40 : 12,
          },
        ]}
      />
      {modelSearch !== "" && (
        <IconButton
          icon="close"
          size={24}
          iconSize={14}
          color={colors.faint}
          borderless
          accessibilityLabel="Clear"
          onPress={() => setModelSearch("")}
          style={styles.clear}
        />
      )}
    </View>
  );
};

type ModelsEmptyProps = Pick<
  ChatController,
  "enabledModels" | "onOpenNavigation" | "setCatalogRevision" | "setPanel"
>;

const ModelsEmpty = ({
  enabledModels,
  onOpenNavigation,
  setCatalogRevision,
  setPanel,
}: ModelsEmptyProps) => {
  const hasEnabled = enabledModels.length > 0;
  return (
    <View style={styles.empty}>
      <Empty
        title={emptyModelsTitle(hasEnabled)}
        detail={emptyModelsDetail(hasEnabled)}
      />
      {!hasEnabled && (
        <>
          <Button
            title="Refresh models"
            variant="ghost"
            onPress={() => setCatalogRevision((value) => value + 1)}
          />
          {onOpenNavigation && (
            <Button
              title="Open navigation"
              variant="ghost"
              onPress={() => {
                setPanel(null);
                onOpenNavigation();
              }}
            />
          )}
        </>
      )}
    </View>
  );
};

type ModelPickerProps = Pick<
  ChatController,
  | "catalogError"
  | "chooseModel"
  | "currentModel"
  | "enabledModels"
  | "error"
  | "modelGroups"
  | "modelPreferences"
  | "modelSearch"
  | "onOpenNavigation"
  | "onOpenSettings"
  | "pending"
  | "serverID"
  | "setCatalogRevision"
  | "setModelSearch"
  | "setPanel"
>;

interface MenuTarget {
  anchor: { height: number; width: number; x: number; y: number };
  model: ModelInfo;
}

export const ModelPicker = ({
  catalogError,
  chooseModel,
  currentModel,
  enabledModels,
  error,
  modelGroups,
  modelPreferences,
  modelSearch,
  onOpenNavigation,
  onOpenSettings,
  pending,
  serverID,
  setCatalogRevision,
  setModelSearch,
  setPanel,
}: ModelPickerProps) => {
  const { height } = useWindowDimensions();
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const pressedModel = useRef<ModelInfo | null>(null);
  const contextMenu = useContextMenu({
    onOpen: (anchor) => {
      if (pressedModel.current) {
        setMenuTarget({ anchor, model: pressedModel.current });
      }
    },
  });
  // Upstream resets the search each time the picker opens.
  useEffect(() => {
    setModelSearch("");
  }, [setModelSearch]);
  const searching = modelSearch.length > 0;
  const isCurrent = (model: ModelInfo) =>
    currentModel?.id === model.id &&
    currentModel.providerID === model.providerID;
  const pick = (model: ModelInfo) => {
    setPanel(null);
    if (isCurrent(model)) {
      return;
    }
    playHaptic("select");
    void chooseModel(model, undefined, true);
  };
  const openSettings = (section: "Models" | "Accounts") => {
    setPanel(null);
    onOpenSettings?.(section);
  };
  const sections = modelGroups.map((group, index) => ({
    ...group,
    data: collapsed[group.key] && !searching ? [] : group.items,
    first: index === 0,
  }));
  const menuModel = menuTarget?.model;
  const menuFavorite =
    menuModel !== undefined &&
    modelPreferences.favoriteIDs.includes(
      modelPreferenceID(menuModel.providerID, menuModel.id)
    );
  return (
    <View>
      <ModelSearchField
        modelSearch={modelSearch}
        setModelSearch={setModelSearch}
        onSubmit={() => {
          const first = modelGroups[0]?.items[0];
          if (first) {
            pick(first);
          }
        }}
      />
      <ErrorNotice
        error={error || catalogError || modelPreferences.error}
        onRetry={() => {
          modelPreferences.reload();
          setCatalogRevision((value) => value + 1);
        }}
      />
      <BottomSheetSectionList
        sections={sections}
        keyExtractor={(model) => `${model.providerID}/${model.id}`}
        style={{ maxHeight: Math.min(maxListHeight, listHeightRatio * height) }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <ModelsEmpty
            enabledModels={enabledModels}
            onOpenNavigation={onOpenNavigation}
            setCatalogRevision={setCatalogRevision}
            setPanel={setPanel}
          />
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader
            collapsed={Boolean(collapsed[section.key])}
            disabled={searching}
            first={section.first}
            group={section}
            onToggle={() =>
              setCollapsed((value) => ({
                ...value,
                [section.key]: !value[section.key],
              }))
            }
          />
        )}
        renderItem={({ item: model, index, section }) => (
          <SheetGroupItem
            variant="grouped"
            first={index === 0}
            last={index === section.data.length - 1}
          >
            <SheetRow
              label={model.name}
              checked={isCurrent(model)}
              disabled={pending}
              accessibilityRole="radio"
              onPress={() => pick(model)}
              onLongPress={(event) => {
                pressedModel.current = model;
                contextMenu.onLongPress(event);
              }}
            />
          </SheetGroupItem>
        )}
      />
      {onOpenSettings && (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <SheetRow
            icon="sliders"
            label="Manage models"
            onPress={() => openSettings("Models")}
          />
          <SheetRow
            icon="plus"
            label="Connect an integration"
            onPress={() => openSettings("Accounts")}
          />
        </View>
      )}
      <AnchoredMenu
        visible={menuTarget !== null}
        anchor={menuTarget?.anchor ?? null}
        accessibilityLabel={menuModel ? `${menuModel.name} actions` : "Actions"}
        onClose={() => setMenuTarget(null)}
        items={[
          {
            disabled:
              !serverID || modelPreferences.loading || modelPreferences.saving,
            key: "favorite",
            label: menuFavorite ? "Remove from favorites" : "Add to favorites",
            onSelect: () => {
              if (menuModel) {
                void modelPreferences.toggleFavorite(
                  menuModel.providerID,
                  menuModel.id
                );
              }
            },
          },
        ]}
      />
    </View>
  );
};

interface ModelsSheetProps extends ModelPickerProps {
  panel: ChatController["panel"];
}

export const ModelsSheet = ({
  panel,
  setPanel,
  ...picker
}: ModelsSheetProps) => (
  <Sheet
    visible={panel === "models"}
    title="Choose model"
    fitContent
    scroll={false}
    onClose={() => setPanel(null)}
  >
    {panel === "models" && <ModelPicker {...picker} setPanel={setPanel} />}
  </Sheet>
);
