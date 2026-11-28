export function openDialog(dialog) {
  if (dialog.open) return;
  const title = dialog.querySelector('h2, [role="heading"]');
  if (title) {
    // Focus the heading on open. Tab enters the controls in their normal order.
    title.tabIndex = -1;
    title.autofocus = true;
    if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
      title.id ||= `${dialog.id}-heading`;
      dialog.setAttribute('aria-labelledby', title.id);
    }
  }
  dialog.showModal();
}
