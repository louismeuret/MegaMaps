import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { parseHTML } from "linkedom";
import { initFieldLift, initKeyboardInset, initTapAway, isTextEntry, keyboardInset } from "../src/ui/keyboard-inset";

test("keyboard inset is the layout height hidden below the visible area", () => {
  assert.equal(keyboardInset(800, { height: 800, offsetTop: 0 }), 0);
  assert.equal(keyboardInset(800, { height: 460, offsetTop: 0 }), 340);
  // The browser may pan the visible area up to reveal the field.
  assert.equal(keyboardInset(800, { height: 460, offsetTop: 120 }), 220);
  assert.equal(keyboardInset(800, { height: 460, offsetTop: 340 }), 0);
  assert.equal(keyboardInset(800, { height: 820, offsetTop: 0 }), 0);
});

test("only fields that bring up a keyboard count as text entry", () => {
  const { document } = parseHTML(
    `<input id="search" type="search"><input id="plain"><input id="day" type="date"><input id="switch" type="checkbox"><input id="slider" type="range"><textarea id="note"></textarea><button id="save"></button>`,
  );
  const entry = (id: string) => isTextEntry(document.getElementById(id));
  assert.equal(entry("search"), true);
  assert.equal(entry("plain"), true);
  assert.equal(entry("note"), true);
  assert.equal(entry("day"), false, "a date opens a picker");
  assert.equal(entry("switch"), false);
  assert.equal(entry("slider"), false);
  assert.equal(entry("save"), false);
  assert.equal(isTextEntry(null), false);
});

test("a tap on empty space in a form puts the keyboard away; controls, drags and the page don't", (t) => {
  const { window, document } = parseHTML(
    `<html><body><dialog><p id="blank">Notes</p><label id="caption">Name<input id="name"></label><button id="save"></button></dialog><p id="outside"></p></body></html>`,
  );
  const name = document.getElementById("name")!;
  Object.defineProperty(document, "activeElement", { get: () => name });
  const blur = t.mock.method(name, "blur");
  initTapAway("dialog", document as unknown as Document);
  const pointer = (type: string, id: string, x: number) => {
    const event = new window.Event(type, { bubbles: true });
    Object.defineProperties(event, { clientX: { value: x }, clientY: { value: 0 } });
    document.getElementById(id)!.dispatchEvent(event);
  };
  const tap = (id: string, drag = 0) => {
    pointer("pointerdown", id, 0);
    pointer("pointerup", id, drag);
  };
  for (const id of ["name", "caption", "save", "outside"]) tap(id);
  tap("blank", 40);
  assert.equal(blur.mock.callCount(), 0, "the field, its label, a button, outside the form or a drag");
  tap("blank");
  assert.equal(blur.mock.callCount(), 1, "a tap on empty space");
});

function form() {
  const window = new Window(), { document } = window;
  Object.assign(globalThis, { getComputedStyle: window.getComputedStyle.bind(window) });
  document.body.innerHTML = `<dialog><form><label id="name-label">Name<input id="name"></label><label id="note-label">Note<textarea id="note"></textarea></label>
    <label id="day-label">Date<input id="day" type="date"></label></form></dialog><input id="bare"><label id="outside-label"><input id="outside"></label>`;
  const page = document as unknown as Document;
  const element = (id: string) => page.getElementById(id)!;
  const focus = (id: string) => element(id).dispatchEvent(new window.Event("focusin", { bubbles: true }) as unknown as Event);
  const blur = (id: string) => element(id).dispatchEvent(new window.Event("focusout", { bubbles: true }) as unknown as Event);
  const typing = () => [...page.querySelectorAll("[data-typing]")].map((label) => label.id);
  return { page, element, focus, blur, typing };
}

test("the field being typed in goes above the keyboard and its form keeps its shape", () => {
  const { page, element, focus, blur, typing } = form();
  initFieldLift("dialog", page, () => true);
  const label = element("name-label"), inForm = () => page.querySelector("form")!.children.length;
  Object.defineProperty(label, "offsetHeight", { value: 90 });
  focus("name");
  assert.deepEqual(typing(), ["name-label"]);
  assert.equal(inForm(), 4, "a blank copy stays in the form");
  const slot = label.nextElementSibling as HTMLElement;
  assert.equal(slot.style.height, "90px");
  assert.equal(slot.id, "", "the copy doesn't take the label's id");
  assert.equal(slot.textContent, "");

  // Next: the name goes back as the description comes up.
  blur("name");
  focus("note");
  assert.deepEqual(typing(), ["note-label"]);
  assert.equal(inForm(), 4);
  blur("note");
  assert.deepEqual(typing(), []);
  assert.equal(inForm(), 3, "closing the keyboard puts the field back");
});

test("only text fields in a form on a touch screen go above the keyboard", () => {
  const touch = form();
  initFieldLift("dialog", touch.page, () => true);
  for (const id of ["day", "bare", "outside"]) touch.focus(id);
  assert.deepEqual(touch.typing(), [], "a date's picker, a field with no label and one outside the form");

  const mouse = form();
  initFieldLift("dialog", mouse.page, () => false);
  mouse.focus("name");
  assert.deepEqual(mouse.typing(), []);
});

test("the keyboard's height is kept for next time, and putting it away ends typing", (t) => {
  const { document } = new Window();
  document.body.innerHTML = `<input id="name"><button id="save"></button>`;
  const page = document as unknown as Document, root = page.documentElement;
  const field = page.getElementById("name")!, button = page.getElementById("save")!;
  let active: Element = field;
  Object.defineProperty(page, "activeElement", { get: () => active });
  Object.defineProperty(root, "clientHeight", { value: 800 });
  const viewport = Object.assign(new EventTarget(), { height: 460, offsetTop: 0 });
  const blur = t.mock.method(field, "blur");
  const globals = globalThis as unknown as Record<string, unknown>;
  const before = { window: globals.window, document: globals.document, frame: globals.requestAnimationFrame, cancel: globals.cancelAnimationFrame };
  t.after(() => {
    globals.window = before.window;
    globals.document = before.document;
    globals.requestAnimationFrame = before.frame;
    globals.cancelAnimationFrame = before.cancel;
  });
  Object.assign(globals, {
    window: { visualViewport: viewport },
    document: page,
    requestAnimationFrame: (run: () => void) => (run(), 0),
    cancelAnimationFrame: () => {},
  });
  initKeyboardInset(root);
  const keyboard = (height: number) => {
    viewport.height = height;
    viewport.dispatchEvent(new Event("resize"));
  };
  const inset = () => root.style.getPropertyValue("--keyboard-inset");

  keyboard(460);
  assert.equal(inset(), "340px");
  keyboard(420);
  assert.equal(inset(), "380px", "another keyboard, or its suggestions row");

  // Tapping Save puts it away from the app's side: nothing left to do.
  active = button;
  keyboard(800);
  assert.equal(inset(), "380px", "the next field goes straight to its place");
  assert.equal(blur.mock.callCount(), 0);

  // Android's Back puts it away and leaves the field focused.
  active = field;
  keyboard(460);
  keyboard(800);
  assert.equal(blur.mock.callCount(), 1);
});
