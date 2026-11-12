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

export const VariantsSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    capabilities,
    chooseModel,
    currentModel,
    error,
    panel,
    pending,
    setPanel,
  } = chat;
  return (
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
};

export const ModelSearchBar = ({ chat }: { chat: ChatController }) => {
  const {
    catalogError,
    error,
    modelFilter,
    modelPreferences,
    modelSearch,
    setCatalogRevision,
    setModelFilter,
    setModelSearch,
    styles,
  } = chat;
  return (
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
};

export const renderModelVariants = (
  chat: ChatController,
  session: SessionInfo
) => {
  const { capabilities, chooseModel, currentModel, pending, styles } = chat;
  return currentModel?.variants.length ? (
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
};

export const renderModelRow = (
  chat: ChatController,
  session: SessionInfo,
  model: ModelInfo
) => {
  const { chooseModel, colors, modelPreferences, pending, serverID, styles } =
    chat;
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

export const renderModelsEmpty = (chat: ChatController) => {
  const {
    enabledModels,
    modelFilter,
    modelSearch,
    onOpenNavigation,
    scopedModels,
    setCatalogRevision,
    setModelFilter,
    setModelSearch,
    setPanel,
  } = chat;
  return (
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
};

export const ModelList = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { filteredModels, styles } = chat;
  return (
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
      ListHeaderComponent={renderModelVariants(chat, session)}
      renderItem={({ item: model }) => renderModelRow(chat, session, model)}
      ListEmptyComponent={renderModelsEmpty(chat)}
    />
  );
};

export const ModelPicker = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => (
  <View style={{ flex: 1, minHeight: 0 }}>
    <ModelSearchBar chat={chat} />
    <ModelList chat={chat} session={session} />
  </View>
);

export const ModelsSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const { panel, setPanel } = chat;
  return (
    <Sheet
      visible={panel === "models"}
      title="Choose model"
      scroll={false}
      onClose={() => setPanel(null)}
    >
      {panel === "models" && <ModelPicker chat={chat} session={session} />}
    </Sheet>
  );
};
