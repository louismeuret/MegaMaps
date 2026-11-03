import { changelog, type Release } from "../changelog";
import { dialogHeader, showDialog } from "./dialog";
import { helpLink } from "./help";
import { icons } from "./icons";
import { locale, t, type Message } from "../i18n";

export const whatsNewMarkup = `<dialog id="whats-new" aria-labelledby="whats-new-title">${dialogHeader("whats-new-title", t("What’s new"), icons.sparkle)}<div class="whats-new-body"><div id="whats-new-sections"></div><div class="whats-new-scroll" aria-hidden="true" hidden><span></span></div></div><div class="share-summary whats-new-idea">${helpLink("idea", icons.idea, "var(--neon-view)", t("Have an idea for next time?"), t("Suggest it on GitHub"))}</div><div class="dialog-actions"><button type="button" id="whats-new-done" class="primary">${icons.check}<span>${t("Got it")}</span></button></div></dialog>`;

const SEEN = "megamaps:changelog-seen";

/** Releases this device hasn't shown yet. A device that never stored one is new,
 *  unless it already has maps: then it updated from before the changelog existed. */
export function unseenReleases(releases: Release[], seen: string | null, hasMaps: boolean) {
  if (seen === null) return hasMaps ? releases.slice(0, 1) : [];
  const index = releases.findIndex((release) => release.commit === seen);
  return index === -1 ? [] : releases.slice(0, index);
}

const sections = [
  ["added", "New features", icons.add],
  ["changed", "Changes", icons.changed],
  ["fixed", "Bug fixes", icons.fixed],
] as const satisfies [keyof Release, Message, string][];

// "Before → after" lines get their arrow drawn in the accent color.
function line(document: Document, text: string) {
  const item = document.createElement("li");
  const [before, after] = text.split(" → ");
  if (after === undefined) item.textContent = text;
  else {
    const arrow = document.createElement("span");
    arrow.className = "whats-new-arrow";
    arrow.textContent = " → ";
    item.append(before!, arrow, after);
  }
  return item;
}

// Release dates are calendar days, so they read the same in every time zone.
const day = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(date));

export function initWhatsNew(dialog: HTMLDialogElement, releases = changelog) {
  const document = dialog.ownerDocument;
  const body = dialog.querySelector<HTMLElement>("#whats-new-sections")!;
  const scroll = dialog.querySelector<HTMLElement>(".whats-new-scroll")!;
  const thumb = scroll.firstElementChild as HTMLElement;
  dialog.querySelector("#whats-new-done")!.addEventListener("click", () => dialog.close());

  // Phones fade their scrollbars out, so a drawn one stays visible to show
  // there is more to read.
  function indicate() {
    const hidden = body.scrollHeight - body.clientHeight;
    scroll.hidden = hidden < 1;
    if (scroll.hidden) return;
    const track = scroll.clientHeight;
    const height = Math.max(32, (track * body.clientHeight) / body.scrollHeight);
    thumb.style.height = `${height}px`;
    thumb.style.transform = `translateY(${(body.scrollTop / hidden) * (track - height)}px)`;
  }
  body.addEventListener("scroll", indicate, { passive: true });
  document.defaultView?.addEventListener("resize", () => dialog.open && indicate());

  const lists = (shown: Release[]) => sections.flatMap(([key, heading, icon]) => {
    const items = shown.flatMap((release) => release[key] ?? []);
    if (!items.length) return [];
    const section = document.createElement("section");
    const title = document.createElement("h3");
    const list = document.createElement("ul");
    title.innerHTML = icon;
    title.append(t(heading));
    list.append(...items.map((item) => line(document, t(item))));
    section.append(title, list);
    return [section];
  });

  function show(parts: HTMLElement[]) {
    body.replaceChildren(...parts);
    body.scrollTop = 0;
    showDialog(dialog);
    indicate();
  }

  return {
    /** Settings shows every release, newest first, each under its date. */
    openAll() {
      show(releases.map((release) => {
        const block = document.createElement("article");
        const date = document.createElement("p");
        date.className = "whats-new-date";
        date.textContent = day(release.date);
        block.append(date, ...lists([release]));
        return block;
      }));
    },
    /** Shows what's new since the last launch. When another dialog has the
     *  screen, it waits for the next launch. */
    atLaunch(hasMaps: boolean, free = true) {
      const latest = releases[0];
      if (!latest) return;
      let seen: string | null = null;
      try {
        seen = localStorage.getItem(SEEN);
      } catch {}
      const unseen = unseenReleases(releases, seen, hasMaps);
      if (unseen.length && !free) return;
      try {
        localStorage.setItem(SEEN, latest.commit);
      } catch {}
      if (unseen.length) show(lists(unseen));
    },
  };
}
