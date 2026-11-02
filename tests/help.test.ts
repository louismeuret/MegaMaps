import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { helpDialogMarkup, helpUrl, initHelp } from "../src/ui/help";

test("questions and ideas open their own Discussions category", () => {
  assert.equal(helpUrl("question"), "https://github.com/nslvdr/MegaMaps/discussions/new?category=q-a");
  assert.equal(helpUrl("idea"), "https://github.com/nslvdr/MegaMaps/discussions/new?category=ideas");
});

test("a problem opens the issue form with what the app knows filled in", () => {
  const url = new URL(helpUrl("problem", "Version: 2026.11.02\nInstalled: yes", { title: "Couldn’t import this map", error: "x".repeat(5000) }));
  assert.equal(url.pathname, "/nslvdr/MegaMaps/issues/new");
  assert.equal(url.searchParams.get("template"), "problem.yml");
  assert.equal(url.searchParams.get("title"), "Couldn’t import this map");
  assert.equal(url.searchParams.get("app"), "Version: 2026.11.02\nInstalled: yes");
  assert.equal(url.searchParams.get("error")!.length, 1500, "a long error is cut so GitHub accepts the address");
});

test("a lesson picked in Help & ideas closes it and starts that lesson", () => {
  const { document } = parseHTML(`<html><body>${helpDialogMarkup}</body></html>`);
  const dialog = document.querySelector<HTMLDialogElement>("#help-dialog")!;
  dialog.setAttribute("open", "");
  Object.defineProperty(dialog, "close", { value: () => dialog.removeAttribute("open") });
  const practised: string[] = [];
  initHelp(document.body, dialog, "", (lesson) => practised.push(lesson.id));
  dialog.querySelector<HTMLElement>('[data-lesson="trail"] .share-row-label')!.click();
  assert.deepEqual(practised, ["trail"]);
  assert.ok(!dialog.hasAttribute("open"));
});
