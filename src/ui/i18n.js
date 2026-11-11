import { localeFormats } from './locale-formats.js';
import { messagesEN } from './locales/en.js';
import { messagesJA } from './locales/ja.js';
import { messagesDE } from './locales/de.js';
import { messagesKO } from './locales/ko.js';
import { messagesFR } from './locales/fr.js';

const languageKey = 'luoye-language';
const localeOptions = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en', label: '英语', messages: messagesEN, format: 0 },
  { id: 'ja', label: '日语', messages: messagesJA, format: 1 },
  { id: 'de', label: '德语', messages: messagesDE, format: 2 },
  { id: 'ko', label: '韩语', messages: messagesKO, format: 3 },
  { id: 'fr', label: '法语', messages: messagesFR, format: 4 },
];
let activeLocale = localeOptions[0];

function lookupCopy(source, locale) {
  if (!locale.messages) return undefined;
  if (Object.hasOwn(locale.messages, source)) return locale.messages[source];
  for (const [pattern, formats] of localeFormats) {
    const match = pattern.exec(source);
    if (!match) continue;
    const args = match.slice(1);
    const values = args.map(value => lookupCopy(value, locale) ?? value);
    // The general label/value rule needs a known label. Otherwise punctuation
    // alone would make arbitrary user text look like a translatable message.
    if (pattern === localeFormats.at(-1)[0] && values[0] === args[0] &&
        !Object.hasOwn(locale.messages, args[0])) continue;
    return formats[locale.format].replace(/\{(\d+)\}/g, (_, i) => values[i]);
  }
}

export function localizedUICopy(source) {
  return lookupCopy(source, activeLocale) ?? source;
}

export function hasUICopy(source) {
  return activeLocale.messages ? lookupCopy(source, activeLocale) !== undefined : true;
}

const localizableAttributes = ['aria-label', 'title', 'placeholder', 'alt'];
const externalCopy = '[data-i18n-ignore], textarea, [contenteditable], script, style, svg';
const localizedNodes = new WeakMap();

export function resolveUILanguage(preference, languages = []) {
  if (localeOptions.some(locale => locale.id === preference)) return preference;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    const locale = localeOptions.find(option => option.id.toLowerCase().split('-')[0] === base);
    if (locale) return locale.id;
  }
  return 'en';
}

// Return authored copy when an existing control provides labels to another view.
export function sourceUIAttribute(node, name) {
  const value = node.getAttribute(name);
  const entry = localizedNodes.get(node)?.get(name);
  return entry?.rendered === value ? entry.source : value;
}

export function sourceUICopy(node, omit) {
  if (!node) return '';
  return [...node.childNodes].map(child => {
    if (child.nodeType === 3) {
      const entry = localizedNodes.get(child)?.get('data');
      return entry?.rendered === child.data ? entry.source : child.data;
    }
    return child.nodeType === 1 && (!omit || !child.matches(omit)) ? sourceUICopy(child, omit) : '';
  }).join('');
}

export function mountLanguageSettings(actions) {
  const root = document.documentElement;
  let preference = 'auto';
  try { preference = localStorage.getItem(languageKey) || 'auto'; } catch {}
  const row = document.createElement('label');
  row.className = 'language-setting';
  const label = document.createElement('span');
  label.textContent = '语言';
  const select = document.createElement('select');
  select.dataset.directChoice = 'true';
  select.id = 'ui-language';
  for (const { id, label: name } of [{ id: 'auto', label: '跟随系统' }, ...localeOptions]) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    select.append(option);
  }
  select.value = preference;
  if (!select.value) select.value = preference = 'auto';
  row.append(label, select);
  actions.before(row);

  // Track the source separately so a language switch can update existing UI
  // without rebuilding controls or reloading the current drawing.
  function localize(node, property, current, write) {
    let properties = localizedNodes.get(node);
    const prior = properties?.get(property);
    if (!activeLocale.messages) {
      if (prior && prior.rendered === current && prior.source !== current) write(prior.source);
      properties?.delete(property);
      return;
    }
    const source = prior?.rendered === current ? prior.source : current;
    const key = source?.trim();
    const translated = /[\u3400-\u9fff]/.test(key ?? '') && lookupCopy(key, activeLocale);
    if (!translated) {
      properties?.delete(property);
      return;
    }
    const rendered = source.replace(key, () => translated);
    if (!properties) localizedNodes.set(node, properties = new Map());
    properties.set(property, { source, rendered });
    if (rendered !== current) write(rendered);
  }

  function localizeAttribute(element, name) {
    localize(element, name, element.getAttribute(name), value => element.setAttribute(name, value));
  }

  function localizeText(node) {
    if (!node.parentElement || node.parentElement.closest(externalCopy)) return;
    const option = node.parentElement.closest('option');
    if (option && !option.hasAttribute('value')) return;
    localize(node, 'data', node.data, value => { node.data = value; });
  }

  function localizeTree(node) {
    if (node.nodeType === 3) {
      localizeText(node);
      return;
    }
    if (node.nodeType !== 1 || node.closest(externalCopy)) return;
    for (const name of localizableAttributes) localizeAttribute(node, name);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(child) {
        return child.nodeType === 1 && child.matches(externalCopy)
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let child = walker.nextNode(); child; child = walker.nextNode()) {
      if (child.nodeType === 3) localizeText(child);
      else for (const name of localizableAttributes) localizeAttribute(child, name);
    }
  }

  function applyLanguage() {
    const language = resolveUILanguage(preference, navigator.languages?.length ? navigator.languages : [navigator.language]);
    activeLocale = localeOptions.find(locale => locale.id === language);
    root.lang = language;
    localizeTree(root);
    document.dispatchEvent(new Event('uilanguagechange'));
    const host = window.webkit?.messageHandlers?.locale;
    if (host) {
      const labels = ['落叶画板', '退出落叶画板', '编辑', '复制', '剪切', '粘贴', '全选',
        '作品文件', '所有文件', '作品还没有保存成功，画室会保持打开。', '草稿未能保存',
        '创作室将保持打开。请先将作品保存为工程文件，再重试退出。', '继续画画',
        '无法打开浏览器，请稍后重试', '创作室暂时没有打开', '操作没有完成，请重试。',
        '系统没有可用的文件选择器', '画板暂时没有打开', '画板资源没有打开。', '好'];
      host.postMessage(Object.fromEntries(labels.map(label => [label, localizedUICopy(label)])));
    }
    // The Android/iPad tablet shell uses a same-origin iframe.
    const frame = window.frameElement;
    if (frame?.id === 'tablet-frame') {
      frame.ownerDocument.documentElement.lang = language;
      frame.ownerDocument.title = document.title;
      frame.title = document.title;
    }
  }

  applyLanguage();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (!record.target.closest(externalCopy)) localizeAttribute(record.target, record.attributeName);
      } else if (record.type === 'characterData') {
        localizeText(record.target);
      } else {
        for (const node of record.addedNodes) if (node.isConnected) localizeTree(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: localizableAttributes });

  select.addEventListener('change', () => {
    preference = select.value;
    try {
      if (preference === 'auto') localStorage.removeItem(languageKey);
      else localStorage.setItem(languageKey, preference);
    } catch {}
    applyLanguage();
  });
  window.addEventListener('languagechange', () => {
    if (preference === 'auto') applyLanguage();
  });
}
