import { t } from "../i18n";
import { preference, setPreference } from "../preferences";
import { onEvent, track, type Properties } from "../stats";
import type { SavedView } from "../viewer/navigation";
import { dialogHeader, showDialog } from "./dialog";
import { icons } from "./icons";
import type { WheelChoice } from "./hold-wheel";

// The coach teaches on the real map, one task at a time, in a card above the
// bottom bar. A task is done when the person actually does it, as the app
// reports it (see `onEvent`). A hand acts out the hold gestures, which words
// alone don't show.
type Task = { text: string; on: string; when?: (properties: Properties) => boolean; hand?: WheelChoice };
export type Lesson = { id: string; title: string; icon: string; color: string; tasks: Task[] };

export const basics: Lesson = {
  id: "basics", title: t("The basics"), icon: icons.sparkle, color: "var(--neon-add)",
  tasks: [
    { text: t("Drag the map with one finger"), on: "map_panned" },
    { text: t("Pinch outward with two fingers to zoom in"), on: "map_zoomed" },
    { text: t("Tap a pin to read about that place"), on: "place_opened" },
    { text: t("Hold the map, slide up-left to Add a place, lift, then Save"), on: "place_added", hand: "place" },
  ],
};

/** More to try on the example map, from Help & ideas. */
export const practice: Lesson[] = [
  {
    id: "trail", title: t("Mark your path"), icon: icons.trail, color: "var(--neon-trail)",
    tasks: [
      { text: t("Hold the map, slide down, then lift to mark where you are"), on: "trail_marked", hand: "trail" },
      { text: t("Drag the map away, then hold and slide up-right to come back"), on: "back_to_mark", hand: "back" },
      { text: t("Tap Trail at the top, then End trip"), on: "trip_ended" },
    ],
  },
  {
    id: "route", title: t("Draw a route"), icon: icons.route, color: "var(--kind-route)",
    tasks: [{ text: t("Tap Add, choose Route, tap points along the way, then Done"), on: "route_saved", when: (p) => !p.edited }],
  },
  {
    id: "measure", title: t("Measure a distance"), icon: icons.measure, color: "var(--neon-measure)",
    tasks: [{ text: t("Tap Measure at the top, then tap two points on the map"), on: "measure_used" }],
  },
  {
    id: "search", title: t("Find a crossing"), icon: icons.search, color: "var(--neon-saved)",
    tasks: [
      { text: t("Search for Allée 25"), on: "search_found", when: (p) => !p.pair },
      { text: t("Now type Allée 25; Allée 55 to find where they meet"), on: "search_found", when: (p) => !!p.pair },
    ],
  },
  {
    id: "rotate", title: t("Rotate the map"), icon: icons.freeRotation, color: "var(--neon-lock)",
    tasks: [
      { text: t("Tap Rotation at the top, then choose Manual"), on: "rotation_changed", when: (p) => p.mode === "free" },
      { text: t("Close the panel and turn the map with two fingers"), on: "map_turned" },
    ],
  },
  {
    id: "edit", title: t("Edit a place"), icon: icons.edit, color: "var(--neon-add)",
    tasks: [
      { text: t("Tap a pin, then Edit, change something and Save"), on: "place_edited" },
      { text: t("Open it again, tap Edit, then Move to put its pin elsewhere"), on: "place_moved" },
    ],
  },
];
export const lessons = [basics, ...practice];

/** Shown once on a map of one's own, until the person first holds the map. */
const holdTip: Lesson = {
  id: "hold-tip", title: t("Tip"), icon: icons.touch, color: "var(--neon-saved)",
  tasks: [{ text: t("Hold the map to add a place or mark where you are"), on: "map_held", hand: "place" }],
};

/** A task's check stays this long before the next one shows. */
const DONE_PAUSE = 900;
/** The hold tip waits for the map to settle before showing. */
const TIP_DELAY = 2500;
/** A drag counts once the map moved this far on screen, a pinch once it zoomed this much, a twist once it turned this far. */
const PAN_PX = 48;
const ZOOM = 1.3;
const TURN = 0.35;

export const coachMarkup = `<section id="coach" class="coach" aria-labelledby="coach-title" hidden>
<div class="coach-card"><span class="coach-icon" id="coach-icon" aria-hidden="true"></span><div class="coach-body"><small id="coach-title"></small><p id="coach-text" role="status" aria-live="polite"></p></div><button type="button" class="dialog-close" id="coach-close" aria-label="${t("Close")}" title="${t("Close")}">${icons.close}</button></div>
<div class="dialog-actions coach-actions" id="coach-actions" hidden><button type="button" class="primary" id="coach-import">${icons.download}<span>${t("Import a map")}</span></button><button type="button" class="quiet" id="coach-more">${icons.learn}<span>${t("More to try")}</span></button></div>
</section><div class="coach-hand" id="coach-hand" aria-hidden="true" hidden>${icons.touch}</div>`;

export const welcomeMarkup = `<dialog id="welcome" aria-labelledby="welcome-title">${dialogHeader("welcome-title", t("Your maps, even underground"), icons.map, "welcome-close")}<p>${t("Mega Maps keeps big scans of quarry and cave plans on your phone. Once a map is in, it works with no signal.")}</p><div class="dialog-actions"><button type="button" id="welcome-import" class="primary">${icons.download}<span>${t("Import a map")}</span></button><button type="button" id="welcome-example" class="quiet">${icons.sparkle}<span>${t("Try the example first")}</span></button></div></dialog>`;

type Actions = {
  /** Whether there is, or soon will be, an example map to try. */
  hasExample(): boolean;
  /** Opens the example map and starts a lesson there. */
  practise(lesson: Lesson, from: string): void;
  importMap(): void;
  /** Shows every lesson. */
  more(): void;
};

export function initCoach(viewer: HTMLElement, welcome: HTMLDialogElement, actions: Actions) {
  const part = <T extends HTMLElement = HTMLElement>(id: string) => viewer.querySelector<T>(`#${id}`)!;
  const coach = part("coach"), hand = part("coach-hand"), stage = part("map-stage");
  let lesson: Lesson | undefined;
  let step = 0;
  let pausing: ReturnType<typeof setTimeout> | undefined;
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  // Fingers on the map, and the view when the first one went down.
  const fingers = new Set<number>();
  let view: SavedView | undefined, from: SavedView | undefined;

  const task = () => lesson?.tasks[step];
  const showHand = () => {
    const pending = !pausing && task()?.hand;
    hand.hidden = !pending || fingers.size > 0;
    if (pending) hand.dataset.hand = pending;
  };
  const render = (done = false) => {
    coach.hidden = !lesson;
    if (!lesson) return showHand();
    const finished = step >= lesson.tasks.length;
    coach.style.setProperty("--c", lesson.color);
    coach.dataset.state = done || finished ? "done" : "";
    part("coach-icon").innerHTML = done || finished ? icons.check : lesson.icon;
    const many = lesson.tasks.length > 1;
    part("coach-title").textContent = finished ? lesson.title
      : many ? t("{lesson} · {step} of {total}", { lesson: lesson.title, step: step + 1, total: lesson.tasks.length }) : lesson.title;
    part("coach-text").textContent = !finished ? task()!.text
      : lesson === basics ? t("That’s the basics. Import your own map when you’re ready.")
      : t("Done! Try something else, or import your own map.");
    part("coach-actions").hidden = !finished;
    part("coach-import").hidden = lesson !== basics;
    showHand();
  };
  const stop = () => {
    clearTimeout(pausing);
    clearTimeout(tipTimer);
    pausing = tipTimer = undefined;
    lesson = undefined;
    render();
  };
  const start = (next: Lesson, origin: string) => {
    stop();
    lesson = next;
    step = 0;
    track("lesson_started", { lesson: next.id, from: origin });
    render();
  };

  // A task is done by the very thing it asks; its check shows for a moment.
  const heard = (event: string, properties: Properties) => {
    if (event === "map_held") setPreference("hold-tip", "seen");
    const current = task();
    if (!lesson || pausing || !current || current.on !== event || current.when?.(properties) === false) return;
    step++;
    if (step === lesson.tasks.length) {
      track("lesson_finished", { lesson: lesson.id });
      // A tip just goes once it's followed.
      if (lesson === holdTip) return stop();
      return render();
    }
    render(true);
    pausing = setTimeout(() => {
      pausing = undefined;
      render();
    }, DONE_PAUSE);
  };
  onEvent(heard);

  // Drags, pinches and twists count only while a finger is on the map, not
  // when the app moves it.
  stage.addEventListener("pointerdown", (event) => {
    if (!fingers.size) from = view;
    fingers.add(event.pointerId);
    showHand();
  }, true);
  const lift = (event: PointerEvent) => {
    fingers.delete(event.pointerId);
    if (!fingers.size) showHand();
  };
  viewer.ownerDocument.addEventListener("pointerup", lift, true);
  viewer.ownerDocument.addEventListener("pointercancel", lift, true);

  part("coach-close").addEventListener("click", () => {
    if (lesson && step < lesson.tasks.length) track("lesson_closed", { lesson: lesson.id, step });
    stop();
  });
  part("coach-import").addEventListener("click", () => {
    stop();
    actions.importMap();
  });
  part("coach-more").addEventListener("click", () => actions.more());

  const answer = (choice: "import" | "example" | "closed") => {
    track("welcome_answered", { choice });
    welcome.close();
    if (choice === "import") actions.importMap();
    if (choice === "example") actions.practise(basics, "welcome");
  };
  welcome.querySelector("#welcome-import")!.addEventListener("click", () => answer("import"));
  welcome.querySelector("#welcome-example")!.addEventListener("click", () => answer("example"));
  welcome.querySelector("#welcome-close")!.addEventListener("click", () => answer("closed"));

  return {
    start,
    /** Leaving the map ends the lesson. */
    stop,
    /** The map moved: as `view` from the viewer, now. */
    viewed(now: SavedView) {
      view = { ...now, center: { ...now.center } };
      if (!fingers.size) return;
      if (!from) from = view;
      const moved = Math.hypot(now.center.x - from.center.x, now.center.y - from.center.y) * now.scale;
      if (moved > PAN_PX) heard("map_panned", {});
      if (now.scale / from.scale > ZOOM) heard("map_zoomed", {});
      if (Math.abs(now.rotation - from.rotation) > TURN) heard("map_turned", {});
    },
    /** A map opened. One's own, with nothing on it yet, gets the hold tip once. */
    opened(example: boolean, marked: boolean) {
      from = undefined;
      fingers.clear();
      if (lesson && !example) stop();
      clearTimeout(tipTimer);
      if (example || marked || lesson || preference("hold-tip") === "seen") return;
      tipTimer = setTimeout(() => {
        tipTimer = undefined;
        if (lesson || preference("hold-tip") === "seen") return;
        setPreference("hold-tip", "seen");
        start(holdTip, "tip");
      }, TIP_DELAY);
    },
    /** A new device is welcomed once; one that already has maps knows its way.
     *  Returns whether it showed anything. */
    atLaunch(hasMaps: boolean) {
      if (preference("tour") === "seen") return false;
      setPreference("tour", "seen");
      if (hasMaps) return false;
      (welcome.querySelector("#welcome-example") as HTMLElement).hidden = !actions.hasExample();
      showDialog(welcome);
      return true;
    },
  };
}
