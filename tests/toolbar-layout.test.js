import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const classic = readFileSync(new URL('src/classic-ui.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');
const shelfStyles = readFileSync(new URL('public/tool-shelf.css', root), 'utf8');

test('compact header folds infrequent actions into the existing settings sheet', () => {
  assert.match(classic, /const foldedToolbarIds = \['reset-settings','open','export','gallery','animation-open','pixel-art-open','collage-open','drawing-games-open','shape-snap-open'\]/);
  assert.match(classic, /matchMedia\('\(max-width: 1080px\), \(max-height: 600px\)'\)/);
  assert.match(classic, /toolbarObserver\.observe\(header, \{ childList: true \}\)/);
  assert.match(classic, /toolbarResize\.observe\(header\)/);
  assert.match(classic, /button\.dataset\.toolbarFolded = 'true'/);
  assert.match(classic, /const about = el\('about-open'\);[\s\S]*settingsActions\.append\(about\)/, '关于按钮没有固定在设置末尾');
  assert.match(classic, /more-tools-actions/, '工具组没有独立容器');
  assert.match(classic, /more-settings-actions/, '设置组没有独立容器');
  assert.match(classic, /const target = \['reset-settings','open','export','gallery'\]\.includes\(button\.id\)/, '折叠操作没有按组归位');
  assert.match(classic, /'theme-open','music-open'/, '音乐入口没有保留在顶部快捷区');
});

test('folded header keeps compact touch targets and removes horizontal scroll affordance', () => {
  assert.match(styles, /@media \(max-width: 380px\) \{[\s\S]*?\.playroom \.header-actions button,[\s\S]*?width: 40px;[\s\S]*?height: 42px;/);
  assert.match(styles, /\.playroom \.header-actions\[data-folded="true"\] \{ overflow-x: hidden; \}/);
});

test('gallery pagination stays beside the cards on the wide shelf', () => {
  assert.match(classic, /document\.body\.classList\.toggle\('library-open',open\);[\s\S]*?syncMobileShelfControls\(open\?'library':'focus'\)/);
  assert.match(classic, /if\(pager&&library&&pager\.parentElement!==library\)library\.append\(pager\)/);
  assert.match(`${styles}\n${shelfStyles}`, /\.playroom\.library-open #library-pagination/);
});

test('gallery surface hides the brush page and only moves categories into compact drawers', () => {
  assert.match(classic, /const moveGroupsToShelf=panel==='library'&&narrowWindow&&!iosDesktopShell/);
  assert.match(classic, /pens\.hidden=libraryOpen\|\|tool!=='pen';subtools\.hidden=libraryOpen/);
  assert.match(classic, /if\(open\)\{pens\.hidden=true;subtools\.hidden=true;\}else sync\(\)/);
  assert.match(classic, /left\.setAttribute\('aria-label',open\?'素材分类':'画笔盒'\)/);
  assert.match(classic, /const panel=open\?'library':'focus';if\(document\.body\.dataset\.mobilePanel!==panel\)setMobilePanel\(panel,false\)/);
  assert.match(classic, /title\.textContent=libraryOpen\?\(document\.body\.dataset\.librarySurface==='fairy'\?'魔法袋':'找一找图案'\)/);
});

// Execute the real responsive state handlers with small DOM containers. This
// catches ordering and repeated-selection regressions that source checks alone
// cannot detect, without depending on any layout dimensions in Node.
function responsiveFixture({ narrow = false, galleryOpen = false } = {}) {
  const node = () => ({
    parentElement: null,
    attributes: new Map(),
    append(child) { child.parentElement = this; },
    prepend(child) { child.parentElement = this; },
    insertBefore(child) { child.parentElement = this; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  });
  const left = node(), dock = node(), rail = node(), library = node(), parameter = node(), subtools = node();
  const groups = node(), pager = node(), instruction = node();
  (narrow && galleryOpen ? library : left).append(groups);
  for (const child of [pager, instruction]) (galleryOpen ? library : parameter).append(child);
  const classes = new Set(galleryOpen ? ['library-open'] : []);
  const body = {
    dataset: narrow ? { mobilePanel: galleryOpen ? 'library' : 'focus', mobileFocus: String(!galleryOpen) } : {},
    classList: { contains: name => classes.has(name) },
    removeAttribute(name) { delete this.dataset[name.replace(/^data-/, '').replace(/-([a-z])/g, (_, char) => char.toUpperCase())]; },
  };
  const nodes = new Map([
    ['.library', library], ['.tool-rail', rail], ['#library-groups', groups],
    ['#library-pagination', pager], ['#library-instruction', instruction],
  ]);
  const document = { body, querySelector: selector => nodes.get(selector) };
  const el = id => ({ click() { if (id === 'mode-library') classes.add('library-open'); else if (id === 'mode-board') classes.delete('library-open'); } });
  let viewportNarrow = narrow;
  const source = classic.slice(classic.indexOf('  function syncMobileShelfControls(panel)'), classic.indexOf('  mobileScrim.onclick'));
  const mount = new Function('document', 'matchMedia', 'el', 'left', 'dock', 'mobileButtons', 'iosDesktopShell', 'parameter', 'subtools', 'renderTools', 'initialNarrow',
    `let narrowWindow=initialNarrow,page=0;${source}\nreturn {syncMobileLayout,setMobilePanel};`);
  const controls = mount(document, () => ({ matches: viewportNarrow }), el, left, dock, new Map(), false, parameter, subtools, () => {}, narrow);
  return { body, classes, left, library, parameter, groups, pager, instruction, controls,
    resize(next) { viewportNarrow = next; controls.syncMobileLayout(); } };
}

test('open gallery keeps its categories and pager when crossing both layout breakpoints', () => {
  const fixture = responsiveFixture({ narrow: true, galleryOpen: true });
  fixture.resize(false);
  assert.equal(fixture.groups.parentElement, fixture.left, '宽屏分类必须归回左栏');
  assert.equal(fixture.pager.parentElement, fixture.library, '宽屏分页必须留在图库');
  assert.equal(fixture.instruction.parentElement, fixture.library);
  assert.equal(fixture.body.dataset.mobilePanel, undefined);
  assert.ok(fixture.classes.has('library-open'));
  fixture.resize(true);
  assert.equal(fixture.groups.parentElement, fixture.library, '窄屏分类必须进入素材抽屉');
  assert.equal(fixture.pager.parentElement, fixture.library);
  assert.equal(fixture.body.dataset.mobilePanel, 'library');
  assert.ok(fixture.classes.has('library-open'));
});

test('programmatic magic-bag selection stays open while another drawer-tab tap closes it', () => {
  const fixture = responsiveFixture({ narrow: true, galleryOpen: true });
  fixture.controls.setMobilePanel('library', false);
  fixture.controls.setMobilePanel('library', false);
  assert.equal(fixture.body.dataset.mobilePanel, 'library');
  assert.ok(fixture.classes.has('library-open'));
  assert.equal(fixture.groups.parentElement, fixture.library);
  fixture.controls.setMobilePanel('library');
  assert.equal(fixture.body.dataset.mobilePanel, 'focus');
  assert.ok(!fixture.classes.has('library-open'));
  assert.equal(fixture.groups.parentElement, fixture.left);
  assert.match(classic, /if\(narrowWindow\)setMobilePanel\(id==='stamp'\?'library':'brushes',false\)/);
});

test('closed gallery remains closed while the brush workspace changes size', () => {
  const fixture = responsiveFixture();
  fixture.resize(true);
  assert.equal(fixture.body.dataset.mobilePanel, 'focus');
  assert.equal(fixture.groups.parentElement, fixture.left);
  assert.equal(fixture.pager.parentElement, fixture.parameter);
  fixture.resize(false);
  assert.equal(fixture.body.dataset.mobilePanel, undefined);
  assert.ok(!fixture.classes.has('library-open'));
});
