import type { ModelInfo, SessionInfo } from "@opencode/client";
import { FlatList, Pressable, ScrollView, View } from "react-native";

import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  Row,
  Sheet,
} from "../../components/ui";
import { modelPreferenceID } from "../../lib/model-preferences";
import { ChatIconButton } from "./controls";
import { emptyModelsTitle, emptyModelsDetail } from "./labels";
import type { ChatController } from "./use-chat-controller";

interface VariantsSheetProps extends Pick<
  ChatController,
  | "capabilities"
  | "chooseModel"
  | "currentModel"
  | "error"
  | "panel"
  | "pending"
  | "setPanel"
> {
  session: SessionInfo;
}

export const VariantsSheet = ({
  capabilities,
  chooseModel,
  currentModel,
  error,
  panel,
  pending,
  session,
  setPanel,
}: VariantsSheetProps) => (
  <Sheet
    visible={panel === "variants"}
    title="Choose variant"
    fitContent
    contentStyle={{ gap: 4 }}
    onClose={() => setPanel(null)}
  >
    <ErrorNotice error={error} />
    {currentModel && (
      <>
        {capabilities.defaultVariant && (
          <Button
            title="Model default"
            selected={!session.model?.variant}
            disabled={pending}
            onPress={() => {
              void chooseModel(currentModel, undefined, true);
            }}
          />
        )}
        {currentModel.variants.map((variant) => (
          <Button
            key={variant.id}
            title={variant.id}
            selected={session.model?.variant === variant.id}
            disabled={pending}
            onPress={() => {
              void chooseModel(currentModel, variant.id, true);
            }}
          />
        ))}
      </>
    )}
  </Sheet>
);

type ModelSearchBarProps = Pick<
  ChatController,
  | "catalogError"
  | "error"
  | "modelFilter"
  | "modelPreferences"
  | "modelSearch"
  | "setCatalogRevision"
  | "setModelFilter"
  | "setModelSearch"
  | "styles"
>;

export const ModelSearchBar = ({
  catalogError,
  error,
  modelFilter,
  modelPreferences,
  modelSearch,
  setCatalogRevision,
  setModelFilter,
  setModelSearch,
  styles,
}: ModelSearchBarProps) => (
  <View style={styles.modelSearch}>
    <Field
      label="Search models"
      value={modelSearch}
      onChangeText={setModelSearch}
      placeholder="Model or provider"
    />
    <Row>
      <Button
        title="All"
        compact
        selected={modelFilter === "all"}
        onPress={() => setModelFilter("all")}
      />
      <Button
        title="Favorites"
        compact
        selected={modelFilter === "favorites"}
        onPress={() => setModelFilter("favorites")}
      />
      <Button
        title="Recent"
        compact
        selected={modelFilter === "recent"}
        onPress={() => setModelFilter("recent")}
      />
    </Row>
    <ErrorNotice
      error={error || catalogError || modelPreferences.error}
      onRetry={() => {
        modelPreferences.reload();
        setCatalogRevision((value) => value + 1);
      }}
    />
  </View>
);

interface RenderModelVariantsProps extends Pick<
  ChatController,
  "capabilities" | "chooseModel" | "currentModel" | "pending" | "styles"
> {
  session: SessionInfo;
}

export const renderModelVariants = ({
  capabilities,
  chooseModel,
  currentModel,
  pending,
  session,
  styles,
}: RenderModelVariantsProps) =>
  currentModel?.variants.length ? (
    <View style={styles.variants}>
      <BodyText muted>Variant · {currentModel.name}</BodyText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {capabilities.defaultVariant && (
          <Button
            title="Model default"
            compact
            selected={!session.model?.variant}
            disabled={pending}
            onPress={() => {
              void chooseModel(currentModel);
            }}
          />
        )}
        {currentModel.variants.map((variant) => (
          <Button
            key={variant.id}
            title={variant.id}
            selected={session.model?.variant === variant.id}
            compact
            disabled={pending}
            onPress={() => {
              void chooseModel(currentModel, variant.id);
            }}
          />
        ))}
      </ScrollView>
    </View>
  ) : undefined;

interface RenderModelRowProps extends Pick<
  ChatController,
  | "chooseModel"
  | "colors"
  | "modelPreferences"
  | "pending"
  | "serverID"
  | "styles"
> {
  session: SessionInfo;
  model: ModelInfo;
}

export const renderModelRow = ({
  chooseModel,
  colors,
  model,
  modelPreferences,
  pending,
  serverID,
  session,
  styles,
}: RenderModelRowProps) => {
  const selected =
    session.model?.id === model.id &&
    session.model.providerID === model.providerID;
  const favorite = modelPreferences.favoriteIDs.includes(
    modelPreferenceID(model.providerID, model.id)
  );
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{
        checked: selected,
        disabled: pending,
      }}
      disabled={pending}
      onPress={() => {
        if (!selected) {
          void chooseModel(model);
        }
      }}
      style={({ pressed }) => [
        styles.modelRow,
        selected && { backgroundColor: colors.selected },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <BodyText numberOfLines={2} style={{ fontWeight: "500" }}>
          {model.name}
        </BodyText>
        <BodyText muted numberOfLines={1} style={{ fontSize: 13 }}>
          {model.providerID} · {model.limit.context.toLocaleString()} context
        </BodyText>
      </View>
      <ChatIconButton
        name="star"
        label={`${favorite ? "Remove" : "Add"} ${model.name} ${favorite ? "from" : "to"} favorites`}
        selected={favorite}
        disabled={
          !serverID || modelPreferences.loading || modelPreferences.saving
        }
        onPress={() => {
          void modelPreferences.toggleFavorite(model.providerID, model.id);
        }}
      />
      <View style={styles.radio}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
};

type RenderModelsEmptyProps = Pick<
  ChatController,
  | "enabledModels"
  | "modelFilter"
  | "modelSearch"
  | "onOpenNavigation"
  | "scopedModels"
  | "setCatalogRevision"
  | "setModelFilter"
  | "setModelSearch"
  | "setPanel"
>;

export const renderModelsEmpty = ({
  enabledModels,
  modelFilter,
  modelSearch,
  onOpenNavigation,
  scopedModels,
  setCatalogRevision,
  setModelFilter,
  setModelSearch,
  setPanel,
}: RenderModelsEmptyProps) => (
  <View style={{ gap: 12, padding: 20 }}>
    <Empty
      title={emptyModelsTitle(
        Boolean(enabledModels.length),
        modelFilter,
        Boolean(scopedModels.length)
      )}
      detail={emptyModelsDetail(
        Boolean(enabledModels.length),
        modelFilter,
        Boolean(scopedModels.length)
      )}
    />
    {enabledModels.length ? (
      <Row>
        {modelSearch && (
          <Button title="Clear search" onPress={() => setModelSearch("")} />
        )}
        {modelFilter !== "all" && (
          <Button
            title="Show all models"
            onPress={() => setModelFilter("all")}
          />
        )}
      </Row>
    ) : (
      <>
        <Button
          title="Refresh models"
          onPress={() => setCatalogRevision((value) => value + 1)}
        />
        {onOpenNavigation && (
          <Button
            title="Open navigation"
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

interface ModelListProps extends Pick<
  ChatController,
  | "capabilities"
  | "chooseModel"
  | "colors"
  | "currentModel"
  | "enabledModels"
  | "filteredModels"
  | "modelFilter"
  | "modelPreferences"
  | "modelSearch"
  | "onOpenNavigation"
  | "pending"
  | "scopedModels"
  | "serverID"
  | "setCatalogRevision"
  | "setModelFilter"
  | "setModelSearch"
  | "setPanel"
  | "styles"
> {
  session: SessionInfo;
}

export const ModelList = ({
  capabilities,
  chooseModel,
  colors,
  currentModel,
  enabledModels,
  filteredModels,
  modelFilter,
  modelPreferences,
  modelSearch,
  onOpenNavigation,
  pending,
  scopedModels,
  serverID,
  session,
  setCatalogRevision,
  setModelFilter,
  setModelSearch,
  setPanel,
  styles,
}: ModelListProps) => (
  <FlatList
    data={filteredModels}
    keyExtractor={(model) => `${model.providerID}/${model.id}`}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    automaticallyAdjustKeyboardInsets
    initialNumToRender={12}
    maxToRenderPerBatch={12}
    windowSize={5}
    contentContainerStyle={styles.modelList}
    ListHeaderComponent={renderModelVariants({
      capabilities,
      chooseModel,
      currentModel,
      pending,
      session,
      styles,
    })}
    renderItem={({ item: model }) =>
      renderModelRow({
        chooseModel,
        colors,
        model,
        modelPreferences,
        pending,
        serverID,
        session,
        styles,
      })
    }
    ListEmptyComponent={renderModelsEmpty({
      enabledModels,
      modelFilter,
      modelSearch,
      onOpenNavigation,
      scopedModels,
      setCatalogRevision,
      setModelFilter,
      setModelSearch,
      setPanel,
    })}
  />
);

interface ModelPickerProps extends Pick<
  ChatController,
  | "capabilities"
  | "catalogError"
  | "chooseModel"
  | "colors"
  | "currentModel"
  | "enabledModels"
  | "error"
  | "filteredModels"
  | "modelFilter"
  | "modelPreferences"
  | "modelSearch"
  | "onOpenNavigation"
  | "pending"
  | "scopedModels"
  | "serverID"
  | "setCatalogRevision"
  | "setModelFilter"
  | "setModelSearch"
  | "setPanel"
  | "styles"
> {
  session: SessionInfo;
}

export const ModelPicker = ({
  capabilities,
  catalogError,
  chooseModel,
  colors,
  currentModel,
  enabledModels,
  error,
  filteredModels,
  modelFilter,
  modelPreferences,
  modelSearch,
  onOpenNavigation,
  pending,
  scopedModels,
  serverID,
  session,
  setCatalogRevision,
  setModelFilter,
  setModelSearch,
  setPanel,
  styles,
}: ModelPickerProps) => (
  <View style={{ flex: 1, minHeight: 0 }}>
    <ModelSearchBar
      catalogError={catalogError}
      error={error}
      modelFilter={modelFilter}
      modelPreferences={modelPreferences}
      modelSearch={modelSearch}
      setCatalogRevision={setCatalogRevision}
      setModelFilter={setModelFilter}
      setModelSearch={setModelSearch}
      styles={styles}
    />
    <ModelList
      capabilities={capabilities}
      chooseModel={chooseModel}
      colors={colors}
      currentModel={currentModel}
      enabledModels={enabledModels}
      filteredModels={filteredModels}
      modelFilter={modelFilter}
      modelPreferences={modelPreferences}
      modelSearch={modelSearch}
      onOpenNavigation={onOpenNavigation}
      pending={pending}
      scopedModels={scopedModels}
      serverID={serverID}
      setCatalogRevision={setCatalogRevision}
      setModelFilter={setModelFilter}
      setModelSearch={setModelSearch}
      setPanel={setPanel}
      styles={styles}
      session={session}
    />
  </View>
);

interface ModelsSheetProps extends Pick<
  ChatController,
  | "capabilities"
  | "catalogError"
  | "chooseModel"
  | "colors"
  | "currentModel"
  | "enabledModels"
  | "error"
  | "filteredModels"
  | "modelFilter"
  | "modelPreferences"
  | "modelSearch"
  | "onOpenNavigation"
  | "panel"
  | "pending"
  | "scopedModels"
  | "serverID"
  | "setCatalogRevision"
  | "setModelFilter"
  | "setModelSearch"
  | "setPanel"
  | "styles"
> {
  session: SessionInfo;
}

export const ModelsSheet = ({
  capabilities,
  catalogError,
  chooseModel,
  colors,
  currentModel,
  enabledModels,
  error,
  filteredModels,
  modelFilter,
  modelPreferences,
  modelSearch,
  onOpenNavigation,
  panel,
  pending,
  scopedModels,
  serverID,
  session,
  setCatalogRevision,
  setModelFilter,
  setModelSearch,
  setPanel,
  styles,
}: ModelsSheetProps) => (
  <Sheet
    visible={panel === "models"}
    title="Choose model"
    scroll={false}
    onClose={() => setPanel(null)}
  >
    {panel === "models" && (
      <ModelPicker
        capabilities={capabilities}
        catalogError={catalogError}
        chooseModel={chooseModel}
        colors={colors}
        currentModel={currentModel}
        enabledModels={enabledModels}
        error={error}
        filteredModels={filteredModels}
        modelFilter={modelFilter}
        modelPreferences={modelPreferences}
        modelSearch={modelSearch}
        onOpenNavigation={onOpenNavigation}
        pending={pending}
        scopedModels={scopedModels}
        serverID={serverID}
        setCatalogRevision={setCatalogRevision}
        setModelFilter={setModelFilter}
        setModelSearch={setModelSearch}
        setPanel={setPanel}
        styles={styles}
        session={session}
      />
    )}
  </Sheet>
);
