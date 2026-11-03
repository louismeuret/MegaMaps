import { motion, reducedMotion } from "./motion";

type VisibleArea = Pick<VisualViewport, "height" | "offsetTop">;

// A date opens a picker, not a keyboard.
const nonTextInputs = new Set([
  "button", "checkbox", "color", "date", "file", "hidden", "image", "radio", "range", "reset", "submit",
]);

// How much of the layout viewport's bottom edge is hidden below the visible area.
export function keyboardInset(layoutHeight: number, visible: VisibleArea) {
  return Math.max(0, Math.round(layoutHeight - visible.offsetTop - visible.height));
}

export function isTextEntry(element: Element | null) {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName === "INPUT")
    return !nonTextInputs.has((element as HTMLInputElement).type);
  return (element as HTMLElement).isContentEditable === true;
}

// Phone keyboards cover the page instead of resizing it, and the page stays as
// it is: only the field being typed in moves, just above the keyboard. Publish
// where that is as --keyboard-inset. Between keyboards it holds the keyboard's
// height, so the next field goes straight to its place as the keyboard rises.
export function initKeyboardInset(root = document.documentElement) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  let frame = 0, shown: number | undefined, height = 0, open = false;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const field = document.activeElement as HTMLElement | null;
      const typing = isTextEntry(field);
      const covered = keyboardInset(root.clientHeight, { height: viewport.height, offsetTop: 0 });
      // Android's Back puts the keyboard away but leaves the field focused.
      if (typing && open && !covered) field!.blur();
      open = typing && covered > 0;
      if (open) height = Math.max(height, covered);
      // iOS may still pan the page to reveal a field. Off the scrolling pages, nothing
      // else moves it, so undo that. Until it's undone the field rides along: a
      // panned page has that much less left to rise.
      if (open && viewport.offsetTop > 0 && !field!.closest("#settings")) window.scrollBy(0, -viewport.offsetTop);
      const inset = open ? keyboardInset(root.clientHeight, viewport) : height;
      // Set on the root, it can restyle the whole page; scrolling sends the same value over and over.
      if (!height || inset === shown) return;
      shown = inset;
      root.style.setProperty("--keyboard-inset", `${inset}px`);
    });
  };
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", update);
}

// Within `scope`, a field's label, or the [data-bar] it's in, moves above the
// keyboard as it takes focus. That has to happen at once, with no transition: a
// field still low on the screen makes iOS pan the whole page to reveal it. A blank
// copy holds its place in the form, and it glides back when typing ends.
export function initFieldLift(scope: string, doc = document, touch = () => matchMedia("(pointer: coarse)").matches) {
  let lifted: { label: HTMLElement; slot: HTMLElement } | undefined;
  const drop = () => {
    if (!lifted) return;
    const { label, slot } = lifted;
    lifted = undefined;
    const from = label.getBoundingClientRect().top;
    label.removeAttribute("data-typing");
    slot.remove();
    if (reducedMotion()) return;
    const distance = from - label.getBoundingClientRect().top;
    const easing = getComputedStyle(label).getPropertyValue("--ease-in");
    label.animate({ transform: [`translateY(${distance}px)`, "none"] }, { duration: motion.fast, easing });
  };
  doc.addEventListener("focusout", drop);
  doc.addEventListener("focusin", (event) => {
    drop();
    const field = event.target as HTMLElement;
    const label = field.closest<HTMLElement>("label, [data-bar]");
    if (!isTextEntry(field) || !label || !field.closest(scope) || !touch()) return;
    // A dialog still rising would carry a fixed field along with it.
    for (const rise of label.closest("dialog")?.getAnimations() ?? [])
      if ((rise as CSSTransition).transitionProperty === "transform") rise.finish();
    const slot = label.cloneNode() as HTMLElement;
    slot.removeAttribute("id");
    slot.style.height = `${label.offsetHeight}px`;
    slot.style.visibility = "hidden";
    label.after(slot);
    label.setAttribute("data-typing", "");
    lifted = { label, slot };
  });
}

const controls = "input, textarea, select, button, label, a";

// iOS keeps the keyboard up when empty space is tapped. Within `scope`, a tap
// on anything but a control puts it away. Only a tap: a drag that scrolls
// leaves it up, so the page never jumps under the finger.
export function initTapAway(scope: string, doc = document) {
  let start: { x: number; y: number } | undefined;
  doc.addEventListener("pointerdown", (event) => {
    start = { x: event.clientX, y: event.clientY };
  });
  doc.addEventListener("pointerup", (event) => {
    const active = doc.activeElement as HTMLElement | null;
    const target = event.target as Element;
    const moved = !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10;
    if (moved || !isTextEntry(active) || target.closest(controls) || !target.closest(scope)) return;
    active!.blur();
  });
}
