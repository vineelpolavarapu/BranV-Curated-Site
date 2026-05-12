/** Trigger the global Quick Add modal hosted by AdminShell. */
export function openQuickAdd() {
  window.dispatchEvent(new CustomEvent('branv:quickadd:open'));
}
