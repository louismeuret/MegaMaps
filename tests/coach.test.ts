import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { basics, coachMarkup, initCoach, practice, welcomeMarkup, type Lesson } from "../src/ui/coach";
import { preference, setPreference } from "../src/preferences";
import { happened } from "../src/stats";
import type { SavedView } from "../src/viewer/navigation";

function setup() {
  const { window, document } = parseHTML(`<html><body><section id="viewer"><div id="map-stage"></div>${coachMarkup}</section>${welcomeMarkup}</body></html>`);
  // Linkedom omits native dialog behavior.
  const welcome = document.querySelector<HTMLDialogElement>("#welcome")!;
  Object.defineProperties(welcome, {
    open: { get: () => welcome.hasAttribute("open") },
    showModal: { value: () => welcome.setAttribute("open", "") },
    close: { value: () => welcome.removeAttribute("open") },
  });
  const part = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;
  const calls = { imported: 0, more: 0, practised: [] as Lesson[] };
  const coach = initCoach(part("viewer"), welcome, {
    hasExample: () => true,
    practise: (lesson) => calls.practised.push(lesson),
    importMap: () => calls.imported++,
    more: () => calls.more++,
  });
  const finger = (type: "pointerdown" | "pointerup", id = 1) => {
    const event = new window.Event(type, { bubbles: true });
    Object.defineProperty(event, "pointerId", { value: id });
    part("map-stage").dispatchEvent(event);
  };
  const shown = () => part("coach").hidden ? undefined : part("coach-text").textContent;
  return { coach, part, welcome, calls, finger, shown };
}

const view = (x: number, scale = 1, rotation = 0): SavedView => ({ center: { x, y: 0 }, scale, rotation });

test("the basics move on only when the map is really dragged, zoomed, read and added to", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { coach, part, calls, finger, shown } = setup();
  coach.opened(true, true);
  coach.viewed(view(0));
  coach.start(basics, "test");
  assert.equal(part("coach-title").textContent, "The basics · 1 of 4");
  assert.equal(shown(), "Drag the map with one finger");

  coach.viewed(view(500));
  assert.equal(shown(), "Drag the map with one finger", "the app moving the map doesn't count");

  finger("pointerdown");
  coach.viewed(view(560));
  assert.equal(part("coach").dataset.state, "done", "the drag shows its check");
  finger("pointerup");
  t.mock.timers.tick(900);
  assert.equal(shown(), "Pinch outward with two fingers to zoom in");

  happened("place_opened");
  assert.equal(shown(), "Pinch outward with two fingers to zoom in", "only the task asked for counts");
  finger("pointerdown", 1);
  finger("pointerdown", 2);
  coach.viewed(view(560, 1.5));
  finger("pointerup", 1);
  finger("pointerup", 2);
  t.mock.timers.tick(900);

  happened("place_opened", { kind: "room", from: "map" });
  t.mock.timers.tick(900);
  assert.equal(shown(), "Hold the map, slide up-left to Add a place, lift, then Save");
  assert.ok(!part("coach-hand").hidden, "a hand shows the hold");
  assert.equal(part("coach-hand").dataset.hand, "place");
  finger("pointerdown");
  assert.ok(part("coach-hand").hidden, "and steps aside while a finger is down");
  finger("pointerup");

  happened("place_added", { kind: "landmark" });
  assert.equal(shown(), "That’s the basics. Import your own map when you’re ready.");
  assert.ok(part("coach-hand").hidden);
  assert.ok(!part("coach-actions").hidden && !part("coach-import").hidden);
  part("coach-import").click();
  assert.equal(calls.imported, 1);
  assert.equal(shown(), undefined);
});

test("a practice step waits for exactly what it asks, and closing ends the lesson", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { coach, part, calls, shown } = setup();
  coach.start(practice.find((lesson) => lesson.id === "search")!, "test");
  happened("search_found", { pair: false });
  t.mock.timers.tick(900);
  happened("search_found", { pair: false });
  assert.equal(shown(), "Now type Allée 25; Allée 55 to find where they meet");
  happened("search_found", { pair: true });
  assert.equal(shown(), "Done! Try something else, or import your own map.");
  assert.ok(part("coach-import").hidden, "only the basics lead on to importing");
  part("coach-more").click();
  assert.equal(calls.more, 1);

  coach.start(practice.find((lesson) => lesson.id === "trail")!, "test");
  part("coach-close").click();
  happened("trail_marked");
  assert.equal(shown(), undefined);
});

test("a new device is welcomed once, and can go straight to importing or the example", () => {
  const first = setup();
  setPreference("tour", "new");
  assert.ok(first.coach.atLaunch(false));
  assert.ok(first.welcome.open);
  first.part("welcome-example").click();
  assert.ok(!first.welcome.open);
  assert.deepEqual(first.calls.practised, [basics]);
  assert.ok(!first.coach.atLaunch(false), "only once");

  const importing = setup();
  setPreference("tour", "new");
  importing.coach.atLaunch(false);
  importing.part("welcome-import").click();
  assert.equal(importing.calls.imported, 1);

  const existing = setup();
  setPreference("tour", "new");
  assert.ok(!existing.coach.atLaunch(true), "a device with maps isn't welcomed");
  assert.ok(!existing.welcome.open);
});

test("a map of one's own, still empty, gets the hold tip once, until the map is held", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  setPreference("hold-tip", "new");
  const { coach, shown } = setup();
  coach.opened(true, false);
  t.mock.timers.tick(5000);
  assert.equal(shown(), undefined, "not on the example map");
  coach.opened(false, true);
  t.mock.timers.tick(5000);
  assert.equal(shown(), undefined, "not on a map that has places already");

  coach.opened(false, false);
  t.mock.timers.tick(2500);
  assert.equal(shown(), "Hold the map to add a place or mark where you are");
  happened("map_held", { choice: "trail" });
  assert.equal(shown(), undefined, "holding the map ends it");
  assert.equal(preference("hold-tip"), "seen");
  coach.opened(false, false);
  t.mock.timers.tick(5000);
  assert.equal(shown(), undefined);
});
