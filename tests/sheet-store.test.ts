import assert from "node:assert/strict";
import test from "node:test";

import { createSheetStore } from "../src/stores/sheet-store";

test("a recovered connection closes the Servers sheet that recovery opened", () => {
  const { actions, store } = createSheetStore();
  actions.beginServerRequest(true);
  actions.showServers();
  assert.equal(store.getState().serversOpen, true);

  assert.equal(actions.cancelAutomaticServerRequest(), true);
  assert.equal(store.getState().serversOpen, false);
});

test("a recovered connection keeps a Servers sheet that the user opened", () => {
  const { actions, store } = createSheetStore();
  actions.beginServerRequest(false);
  actions.showServers();

  assert.equal(actions.cancelAutomaticServerRequest(), false);
  assert.equal(store.getState().serversOpen, true);
});

test("a recovered connection keeps a Servers sheet that the user took over", () => {
  const { actions, store } = createSheetStore();
  actions.beginServerRequest(true);
  actions.showServers();
  actions.closeServers();
  actions.beginServerRequest(false);
  actions.showServers();

  assert.equal(actions.cancelAutomaticServerRequest(), false);
  assert.equal(store.getState().serversOpen, true);
});
