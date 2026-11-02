import { dialogHeader, showDialog } from "./dialog";
import { icons } from "./icons";
import { language, t } from "../i18n";
import { track } from "../stats";
import { lessons, type Lesson } from "./coach";

const REPOSITORY = "https://github.com/nslvdr/MegaMaps";
/** GitHub turns away very long addresses; the start of an error says the most. */
const MAX_ERROR = 1500;

export type Topic = "question" | "idea" | "problem";

/** What an error dialog knows about the problem being reported. */
export interface Problem {
  title?: string;
  error?: string;
}

/** Questions and ideas go to Discussions, where others can find and vote on them.
 *  A problem opens the issue form with the app and device already filled in. */
export function helpUrl(topic: Topic, app = "", problem: Problem = {}) {
  if (topic !== "problem") return `${REPOSITORY}/discussions/new?category=${topic === "idea" ? "ideas" : "q-a"}`;
  const query = new URLSearchParams({ template: "problem.yml" });
  if (problem.title) query.set("title", problem.title);
  if (problem.error) query.set("error", problem.error.slice(0, MAX_ERROR));
  if (app) query.set("app", app);
  return `${REPOSITORY}/issues/new?${query}`;
}

/** The app's details for a problem report: nothing the person wrote, nothing about their maps. */
export const describeApp = (version: string, installed: boolean) => [
  `Version: ${version || "unknown"}`,
  `Installed: ${installed ? "yes" : "no"}`,
  `Language: ${language}`,
  `Device: ${navigator.userAgent}`,
].join("\n");

export const helpLink = (topic: Topic, icon: string, color: string, text: string, hint: string) =>
  `<a class="share-row help-link" data-help="${topic}" href="${helpUrl(topic)}" target="_blank" rel="noopener"><span class="share-row-icon" style="--k:${color}">${icon}</span><span class="share-row-label">${text}<small>${hint}</small></span>${icons.externalLink}</a>`;

/** The three ways to reach out, shared by the Help & ideas sheet and Settings. */
export const helpLinksMarkup = `<div class="share-summary">${
  helpLink("question", icons.question, "var(--neon-view)", t("Ask a question"), t("Others may have asked already"))}${
  helpLink("idea", icons.idea, "var(--neon-add)", t("Suggest a feature"), t("Vote on ideas or add yours"))}${
  helpLink("problem", icons.bug, "var(--neon-lock)", t("Report a problem"), t("Your app version is included"))}</div>`;

export const githubNote = t("Opens GitHub. Reading is free; writing needs a free account.");

// Each lesson plays on the example map, with the coach.
const practiceMarkup = `<h3 class="settings-heading">${t("Practice on the example map")}</h3><div class="share-summary">${lessons.map((lesson) =>
  `<button type="button" class="share-row" data-lesson="${lesson.id}"><span class="share-row-icon" style="--k:${lesson.color}">${lesson.icon}</span><span class="share-row-label">${lesson.title}</span>${icons.arrow}</button>`).join("")}</div>`;

export const helpDialogMarkup = `<dialog id="help-dialog" aria-labelledby="help-title">${dialogHeader("help-title", t("Help & ideas"), icons.help, "help-close")}${practiceMarkup}<h3 class="settings-heading">${t("Ask and suggest")}</h3><p>${t("Mega Maps grows from what you ask. It all happens on GitHub, in the open.")}</p>${helpLinksMarkup}<p class="dialog-note">${githubNote}</p></dialog>`;

/** Fills in the app's details on every problem link and counts which topics people open.
 *  A lesson picked from the dialog goes to `practise`. */
export function initHelp(root: HTMLElement, dialog: HTMLDialogElement, app: string, practise: (lesson: Lesson) => void = () => {}) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-help="problem"]'))
    link.href = helpUrl("problem", app);
  root.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-help]");
    if (link) track("help_opened", { topic: link.dataset.help!, from: link.closest("[id]")?.id ?? "" });
  });
  dialog.querySelector("#help-close")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const id = (event.target as Element).closest<HTMLElement>("[data-lesson]")?.dataset.lesson;
    const lesson = lessons.find((lesson) => lesson.id === id);
    if (!lesson) return;
    dialog.close();
    practise(lesson);
  });
  return {
    open: () => showDialog(dialog),
    /** An error dialog's link that reports this very problem. */
    report: (link: HTMLAnchorElement, problem: Problem) => { link.href = helpUrl("problem", app, problem); },
  };
}
