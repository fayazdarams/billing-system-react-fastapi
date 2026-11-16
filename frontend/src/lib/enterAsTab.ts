import type { KeyboardEvent } from "react";

// Enter = move to next focusable, not submit.
// Used by ALL forms: Login, Register, Forgot Password.
export function handleEnterAsTab(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") return;
  const target = event.target as HTMLElement;
  if (target.tagName === "BUTTON") return;

  event.preventDefault();
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("input, select, textarea, button[type='submit']"),
  ).filter((el) => !el.hasAttribute("disabled"));

  const index = focusable.indexOf(target);
  const next = focusable[index + 1] ?? focusable[0];
  next?.focus();
}
