import { t } from "../i18n";
import { preference, setPreference } from "../preferences";
import { track } from "../stats";
import { dialogHeader, showDialog } from "./dialog";
import { icons } from "./icons";

export const welcomeMarkup = `<dialog id="welcome" aria-labelledby="welcome-title">${dialogHeader("welcome-title", t("Your maps, even underground"), icons.map, "welcome-close")}<p>${t("Mega Maps keeps big scans of quarry and cave plans on your phone. Once a map is in, it works with no signal.")}</p><div class="dialog-actions"><button type="button" id="welcome-import" class="primary">${icons.download}<span>${t("Import a map")}</span></button><button type="button" id="welcome-example" class="quiet">${icons.sparkle}<span>${t("Try the example first")}</span></button></div></dialog>`;

type Actions = {
  /** Whether there is, or soon will be, an example map to try. */
  hasExample(): boolean;
  importMap(): void;
  openExample(): void;
};

/** A new device is asked once whether to import a map or try the example. */
export function initWelcome(welcome: HTMLDialogElement, actions: Actions) {
  const answer = (choice: "import" | "example" | "closed") => {
    track("welcome_answered", { choice });
    welcome.close();
    if (choice === "import") actions.importMap();
    if (choice === "example") actions.openExample();
  };
  welcome.querySelector("#welcome-import")!.addEventListener("click", () => answer("import"));
  welcome.querySelector("#welcome-example")!.addEventListener("click", () => answer("example"));
  welcome.querySelector("#welcome-close")!.addEventListener("click", () => answer("closed"));

  return {
    /** A device that already has maps knows its way. Returns whether it showed anything. */
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
