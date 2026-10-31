export function renderTabletShell(shell, index) {
  const marker = 'data-app-srcdoc';
  const first = shell.indexOf(marker);
  if (first < 0 || first !== shell.lastIndexOf(marker)) throw new Error('平板外壳必须且只能包含一个内页占位');
  const source = index.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return shell.replace(marker, `srcdoc="${source}"`);
}
