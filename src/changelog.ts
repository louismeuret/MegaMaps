import type { Message } from "./i18n";

/** What a release changed for users, in English with French in src/locales/fr.ts.
 *  `commit` is the last dev commit it covers. A value that changed, such as a
 *  limit, reads "Thing: before → after". */
export type Release = {
  date: string;
  commit: string;
  added?: Message[];
  changed?: Message[];
  fixed?: Message[];
};

/** Newest first. */
export const changelog: Release[] = [
  {
    date: "2026-11-03",
    commit: "7a030a9",
    added: [
      "Text detection and map preparation show roughly how long is left.",
      "Search finds words in any order.",
      "Settings has a What’s new row with the changes in every version.",
      "Ask a question, suggest a feature or report a problem from Settings; error messages offer to report the problem.",
    ],
    changed: [
      "Imports and text detection are faster, and search keeps up on maps with lots of text.",
      "Delete everything becomes Reset: delete all data, or also put every setting back to its default.",
      "Errors such as an unreadable file, a full device or a PDF say what to do, in the app’s language.",
      "Once you have a map of your own, the app offers to remove the example.",
      "Empty Saved lists say how to add a place or a route.",
      "The Highlight saved button is gone.",
    ],
    fixed: [
      "The page behind a dialog no longer scrolls.",
      "A part of the map that failed to load is loaded again instead of staying blank.",
      "Map previews no longer flash when you come back to the main menu.",
      "The plane icon turns lime when the app is ready offline.",
      "Photo descriptions and unfinished routes are in French too.",
    ],
  },
  {
    date: "2026-11-01",
    commit: "33409c4",
    added: [
      "An example map, Val Moulin, to try the app without importing anything.",
    ],
    changed: [
      "Map size limit: 300 → 600 megapixels.",
      "Larger images, up to 1,000 megapixels, are shrunk instead of refused.",
      "The app asks before running text detection.",
      "Route names open as balloons, like place names.",
      "Settings shows the time of each version, not just the day.",
    ],
    fixed: [
      "Map previews in the main menu are square.",
    ],
  },
];
