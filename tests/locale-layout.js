const frame = document.querySelector('iframe');
const checks = [];
const locales = ['en', 'de', 'fr', 'ja', 'ko', 'zh-CN'];
const viewports = [[320, 240], [320, 568], [540, 320], [768, 1024], [1024, 720], [1440, 900]];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function render() {
  return new Promise(resolve => frame.contentWindow.requestAnimationFrame(resolve));
}

function checkControls(root, selector, minimumSize) {
  const doc = root.ownerDocument;
  let count = 0;
  for (const control of root.querySelectorAll(selector)) {
    if (!control.getClientRects().length) continue;
    const walker = doc.createTreeWalker(control, NodeFilter.SHOW_TEXT);
    const bounds = control.getBoundingClientRect();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const label = node.textContent.trim();
      if (!label || node.parentElement.closest('svg, .choice-picture, [aria-hidden="true"]')) continue;
      const range = doc.createRange();
      range.selectNodeContents(node);
      const fragments = Array.from(range.getClientRects()).filter(rect => rect.width && rect.height);
      if (!fragments.length) continue;
      count++;
      assert(parseFloat(doc.defaultView.getComputedStyle(node.parentElement).fontSize) >= minimumSize,
        `Text is too small for “${label}”`);
      assert(fragments.every(rect => rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2 &&
        rect.top >= bounds.top - 2 && rect.bottom <= bounds.bottom + 2), `Text escapes its control: “${label}”`);
    }
  }
  assert(count > 0, `No visible text found for ${selector}`);
}

function checkDialog(dialog) {
  assert(dialog.open, `${dialog.id} did not open`);
  assert(dialog.scrollWidth <= dialog.clientWidth + 2, `${dialog.id} has horizontal overflow`);
}

async function switchLanguage(doc, language) {
  doc.querySelector('#more-open').click();
  const settings = doc.querySelector('#more-dialog');
  checkDialog(settings);
  checkControls(settings, '.more-action, #ui-language-choose', 14);
  doc.querySelector('#ui-language-choose').click();
  await render();
  const chooser = doc.querySelector('#choice-dialog');
  checkDialog(chooser);
  checkControls(chooser, '.choice-card', 14);
  chooser.querySelector(`[data-value="${language}"]`).click();
  await render();
  assert(doc.documentElement.lang === language, `Language did not switch to ${language}`);
  checkControls(settings, '.more-action, #ui-language-choose', 14);
  doc.querySelector('#more-done').click();
  checkControls(doc.body, '.header-actions > button', 14);
}

async function checkPalette(doc) {
  doc.querySelector('#foreground-palette').click();
  const dialog = doc.querySelector('#palette-dialog');
  const rgb = dialog.querySelector('.color-numbers');
  rgb.open = true;
  await render();
  checkDialog(dialog);
  checkControls(dialog, '.preset-color, .palette-editor label', 14);
  doc.querySelector('#palette-cancel').click();
}

async function checkAssist(doc) {
  doc.querySelector('#assist-open').click();
  const dialog = doc.querySelector('#assist-dialog');
  if (!doc.querySelector('#assist-enabled').checked) doc.querySelector('#assist-enabled').click();
  dialog.querySelector('[data-assist-mode="radial"]').click();
  await render();
  checkDialog(dialog);
  checkControls(dialog, '.assist-mode-button, .assist-check, .assist-switch', 14);
  dialog.querySelector('.assist-close').click();
}

async function checkDrawingDialogs(doc) {
  for (const [id, trigger, buttons, minimumSize] of [
    ['theme-dialog', '#theme-open', '.theme-card', 13],
    ['animation-editor-dialog', '[data-tool="animation"]', '.animation-tool-row button, .animation-actions button', 14],
    ['pixel-art-dialog', '[data-tool="pixel"]', '.pixel-art-tool-row button, .pixel-art-actions button', 14],
  ]) {
    doc.querySelector(trigger).click();
    await render();
    const dialog = doc.getElementById(id);
    assert(dialog, `${id} was not created`);
    checkDialog(dialog);
    checkControls(dialog, buttons, minimumSize);
    dialog.close();
  }
}

async function checkWorkspace(doc) {
  const narrow = doc.defaultView.matchMedia('(max-width: 860px), (max-height: 600px)').matches;
  doc.querySelector('.tool-button[data-tool="pen"]').click();
  if (narrow && doc.body.dataset.mobilePanel !== 'brushes') {
    doc.querySelector('.mobile-command[data-mobile-panel="brushes"]').click();
  }
  await render();
  checkControls(doc.body, '.brush-card', 14);
  doc.querySelector('.tool-button[data-tool="select"]').click();
  if (narrow && doc.body.dataset.mobilePanel !== 'options') {
    doc.querySelector('.mobile-command[data-mobile-panel="options"]').click();
  }
  await render();
  checkControls(doc.body, '#selection-combination button, #selection-actions button', 14);
  if (narrow) doc.querySelector('.mobile-focus-command').click();
}

try {
  await new Promise(resolve => {
    frame.addEventListener('load', resolve, { once: true });
    frame.src = '/';
  });
  const doc = frame.contentDocument;
  for (const [width, height] of viewports) {
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    await render();
    for (const language of locales) {
      const name = `${language} · ${width} × ${height}`;
      try {
        await switchLanguage(doc, language);
        await checkWorkspace(doc);
        await checkPalette(doc);
        await checkAssist(doc);
        await checkDrawingDialogs(doc);
        checks.push({ name, passed: true });
      } catch (error) {
        checks.push({ name, passed: false, error: error.message });
        for (const dialog of Array.from(doc.querySelectorAll('dialog[open]')).reverse()) dialog.close();
        await render();
      }
    }
  }
  const title = doc.querySelector('#title');
  title.value = 'My Wonderful World';
  title.dispatchEvent(new Event('input', { bubbles: true }));
  await switchLanguage(doc, 'en');
  await switchLanguage(doc, 'de');
  assert(title.value === 'My Wonderful World', 'Language switching replaced a custom drawing title');
  checks.push({ name: 'Custom drawing title survives switching languages', passed: true });
} catch (error) {
  checks.push({ name: 'Load artboard', passed: false, error: error.message });
}
document.body.dataset.results = JSON.stringify(checks);
