'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that downstream suites can require instead of
// copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, logging in, the system messages, the named
// administration pages, the tables of the administration (rows, operations),
// the dialog, the rich text editor and the form controls.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`,
// `friendly`) so the steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds, so a slow page does not fail an assertion that would pass a moment
 * later. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/**
 * The settle time after an action: `minWaitTime.page` from cucumber.js.
 *
 * @param {object} world
 * @returns {number}
 */
function settleTime(world) {
  return (world && world.minWaitTime && world.minWaitTime.page) || 3000;
}

/**
 * Whether an optional step argument was supplied.
 *
 * @param {*} value
 * @returns {boolean}
 */
function supplied(value) {
  return value !== undefined && value !== null;
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A case-sensitive RegExp that matches the literal text anywhere.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function literal(text) {
  return new RegExp(escapeRegExp(text));
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space).
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*$');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass
 * through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Open a URL and wait for the page to settle.
 *
 * @param {object} world
 * @param {string} url - A path of the site or an absolute URL.
 */
async function open(world, url) {
  const target = siteUrl(world, url);
  try {
    await gotoUrl(world.page, target);
  } catch (err) {
    // The browser drops a navigation when a network interface of the machine
    // comes or goes while the page loads (ERR_NETWORK_CHANGED), as happens on a
    // machine that starts or stops containers. A person reloads; so does the
    // step, once. Any other failure is reported as it is.
    if (!/ERR_NETWORK_CHANGED/.test(String(err && err.message))) throw err;
    await gotoUrl(world.page, target);
  }
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await waitForPageLoad(world.page, settleTime(world));
}

/**
 * Wait for the page to be quiet after an action (a click, a form submission,
 * an AJAX request).
 *
 * @param {object} world
 */
async function settle(world) {
  await smartSettle(world.page, settleTime(world));
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number, state?: string}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout, state = 'visible' }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : state, timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reading of the page until it satisfies a check, and return the last
 * reading together with the verdict. Used by assertions that compare a value
 * (a list of names, a count) so that a page still rendering does not fail them.
 *
 * @param {object} world
 * @param {Function} read - Async function returning the current value.
 * @param {Function} check - Function (value) => boolean.
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function poll(world, read, check) {
  const deadline = Date.now() + budget(world);
  let value;
  for (;;) {
    try {
      value = await read();
      if (check(value)) return { ok: true, value };
    } catch (err) {
      // A navigation in flight destroys the execution context: read again.
      if (!/context was destroyed|navigation|Target closed/i.test(String(err && err.message))) throw err;
    }
    if (Date.now() >= deadline) return { ok: false, value };
    await world.page.waitForTimeout(200);
  }
}

// ---------------------------------------------------------------------------
// Users and the session
// ---------------------------------------------------------------------------

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '...', password: process.env.SITE_${String(handle).toUpperCase()}_PASSWORD } }. The account itself is created once when the site is built, never by a feature.`,
    });
  }
  const username = entry.username || handle;
  const password = typeof entry === 'string' ? entry : entry.password;
  if (!password) {
    throw friendly({
      message: `The user "${handle}" has no password in the users registry.`,
      hint: `Set worldParameters.users.${handle}.password in cucumber.js, from an environment variable.`,
    });
  }
  return { username, password };
}

/**
 * Whether the page in the browser belongs to a signed-in session: the `body`
 * carries the `logged-in` class on every page a signed-in user sees.
 *
 * @param {object} world
 * @returns {Promise<boolean>}
 */
async function isLoggedIn(world) {
  return world.page.evaluate(() => document.body.classList.contains('logged-in'));
}

/**
 * Fill the log in form (`/user/login`) and submit it. Does not judge the
 * outcome: the caller asserts it.
 *
 * @param {object} world
 * @param {string} username
 * @param {string} password
 */
async function submitLogin(world, username, password) {
  const page = world.page;
  // A signed-in session is sent away from the log in form: start clean.
  await page.context().clearCookies();
  await open(world, '/user/login');
  const form = page.locator('form#user-login, form.user-login').first();
  await actOrExplain('find the log in form at', '/user/login', () => form.waitFor({ state: 'visible', timeout: budget(world) }),
    'The log in form is served at /user/login; check LAUNCH_URL and that the site is installed.');
  const name = form.getByLabel(/^(Username or email address|Username|Email address)/).or(form.locator('input[name="name"]')).first();
  const pass = form.locator('input[name="pass"]').first();
  await name.fill(username);
  await pass.fill(password);
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    form.locator('input[type="submit"], button[type="submit"]').first().click(),
  ]);
  await settle(world);
}

/**
 * Log in with a username and a password and fail, with the message of the
 * site, when the session did not start.
 *
 * @param {object} world
 * @param {string} username
 * @param {string} password
 * @param {string} [handle] - The registry handle, for the error message.
 */
async function logIn(world, username, password, handle) {
  await submitLogin(world, username, password);
  const result = await poll(world, () => isLoggedIn(world), (value) => value === true);
  if (!result.ok) {
    const errors = await messageTexts(world, 'error');
    throw friendly({
      message: `Could not log in as "${handle || username}": ${errors.length ? 'the site answered "' + errors.join(' / ') + '"' : 'the page after the log in form does not belong to a signed-in session'}.`,
      hint: 'Check the username and password in worldParameters.users (cucumber.js) and that the site build script created the account. Five failed attempts block an account for a while.',
    });
  }
  world.siteUser = { handle: handle || username, username };
}

/**
 * The username of the session, read from the account page (`/user`) with the
 * cookies of the browser and without leaving the current page. Null when
 * nobody is logged in.
 *
 * @param {object} world
 * @returns {Promise<string|null>}
 */
async function sessionUsername(world) {
  const response = await world.page.context().request.get(siteUrl(world, '/user'), { failOnStatusCode: false });
  const html = await response.text();
  if (!/<body[^>]*class="[^"]*\blogged-in\b/.test(html)) return null;
  const heading = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
  return heading ? clean(heading[1].replace(/<[^>]+>/g, '')) : '';
}

/**
 * The HTTP status of a path of the site for the session of the browser.
 *
 * @param {object} world
 * @param {string} url
 * @returns {Promise<number>}
 */
async function statusOf(world, url) {
  const response = await world.page.context().request.get(siteUrl(world, url), { failOnStatusCode: false, maxRedirects: 5 });
  return response.status();
}

// ---------------------------------------------------------------------------
// System messages
// ---------------------------------------------------------------------------

// The messages are `<div class="messages status|info|warning|error">`, in the
// "Page messages" block (`.l-messages`) of a layout or in
// `.user-simplified-page-messages` on the log in pages. Each one starts with a
// hidden heading ("Status message") and ends with a "Dismiss" link.
const MESSAGE_TYPES = { status: 'status', success: 'status', info: 'info', warning: 'warning', error: 'error' };

/**
 * The CSS selector of the messages of one type (or of every type).
 *
 * @param {string} [type]
 * @returns {string}
 */
function messageSelector(type) {
  if (!type) return 'div.messages';
  const key = MESSAGE_TYPES[String(type).toLowerCase()];
  if (!key) throw friendly({ message: `"${type}" is not a message type.`, hint: 'Use status, info, warning or error.' });
  return `div.messages.${key}`;
}

/**
 * The texts of the visible messages of one type, without the hidden heading
 * and the "Dismiss" link. A message that lists several items gives one text
 * per item as well as the whole text.
 *
 * @param {object} world
 * @param {string} [type]
 * @returns {Promise<string[]>}
 */
async function messageTexts(world, type) {
  return world.page.locator(messageSelector(type)).evaluateAll((els) => els
    .filter((el) => el.offsetParent !== null)
    .map((el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('h2.element-invisible, a.dismiss').forEach((node) => node.remove());
      return (copy.textContent || '').replace(/\s+/g, ' ').trim();
    }));
}

// ---------------------------------------------------------------------------
// Administration pages
// ---------------------------------------------------------------------------

// The administration pages a tester opens by name. The value is the path.
const ADMIN_PAGES = {
  'dashboard': 'admin/dashboard',
  'content': 'admin/content',
  'manage content': 'admin/content',
  'comments': 'admin/content/comment',
  'manage comments': 'admin/content/comment',
  'files': 'admin/content/files',
  'manage files': 'admin/content/files',
  'add content': 'node/add',
  'user accounts': 'admin/people',
  'manage user accounts': 'admin/people',
  'roles': 'admin/config/people/roles',
  'permissions': 'admin/config/people/permissions',
  'account settings': 'admin/config/people/settings',
  'appearance': 'admin/appearance',
  'themes': 'admin/appearance',
  'functionality': 'admin/modules',
  'modules': 'admin/modules',
  'structure': 'admin/structure',
  'layouts': 'admin/structure/layouts',
  'custom blocks': 'admin/structure/block',
  'menus': 'admin/structure/menu',
  'taxonomy': 'admin/structure/taxonomy',
  'content types': 'admin/structure/types',
  'views': 'admin/structure/views',
  'configuration': 'admin/config',
  'site information': 'admin/config/system/site-information',
  'text editors and formats': 'admin/config/content/formats',
  'url aliases': 'admin/config/urls/path',
  'configuration manager': 'admin/config/development/configuration',
  'configuration synchronize': 'admin/config/development/configuration',
  'single configuration import': 'admin/config/development/configuration/single',
  'single configuration export': 'admin/config/development/configuration/single/export',
  'full configuration export': 'admin/config/development/configuration/full',
  'reports': 'admin/reports',
  'status report': 'admin/reports/status',
  'recent log messages': 'admin/reports/dblog',
  'available updates': 'admin/reports/updates',
};

/**
 * The path of a named administration page. A name that is not in the table but
 * looks like a path (`admin/structure/menu/settings`) is used as it is.
 *
 * @param {string} name
 * @returns {string}
 */
function adminPath(name) {
  const key = clean(name).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ADMIN_PAGES, key)) return ADMIN_PAGES[key];
  if (/^\/?(admin|node|user|file)(\/|$)/.test(clean(name))) return clean(name).replace(/^\//, '');
  throw friendly({
    message: `"${name}" is not a known administration page.`,
    hint: `Use one of: ${Object.keys(ADMIN_PAGES).join(', ')}; or a path such as "admin/structure/menu/settings".`,
  });
}

/**
 * Fail with a clear reason when the page that opened is "Access denied" or
 * "Page not found" instead of the page a step asked for.
 *
 * @param {object} world
 * @param {string} what - The page the step wanted, for the message.
 */
async function requirePage(world, what) {
  const heading = clean(await world.page.locator('h1').first().textContent({ timeout: budget(world) }).catch(() => ''));
  if (/^Access denied$/i.test(heading)) {
    const signedIn = await isLoggedIn(world);
    throw friendly({
      message: `"${what}" answered "Access denied"${signedIn ? ' for the account of this session' : ': nobody is logged in'}.`,
      hint: signedIn ? 'Log in with an account whose role has the permission for this page.' : 'Add "Given I am logged in as "admin"" before this step.',
    });
  }
  if (/^Page not found$/i.test(heading)) {
    throw friendly({ message: `"${what}" answered "Page not found" (${world.page.url()}).`, hint: 'Check the path, and that the module that serves the page is enabled.' });
  }
}

/**
 * Open a named administration page and make sure it opened.
 *
 * @param {object} world
 * @param {string} name
 */
async function openAdminPage(world, name) {
  await open(world, '/' + adminPath(name));
  await requirePage(world, name);
}

// ---------------------------------------------------------------------------
// Tables of the administration
// ---------------------------------------------------------------------------

// Every listing of the administration is a table. A table with a sticky header
// has a clone (`table.sticky-header`) that only holds the header: it is left
// out. The page content sits in `.l-content` (the "Main page content" block).
const ROWS = 'table:not(.sticky-header) > tbody > tr';

/**
 * The rows of the tables of the page (or of a container).
 *
 * @param {object} world
 * @param {import('playwright').Locator} [scope]
 * @returns {import('playwright').Locator}
 */
function rows(world, scope) {
  // The scope can be a table itself (`table#taxonomy`) or a container of tables.
  return scope ? scope.locator(`:scope > tbody > tr, ${ROWS}`) : world.page.locator(ROWS);
}

/**
 * The readings of each row that a name is compared with: the text of each
 * cell, of each link, of each `.label`, and the cell text without the
 * "(Machine name: ...)" suffix and without the "new"/"updated" marker.
 * Runs in the page.
 */
/* istanbul ignore next */
function readRowNames(els) {
  const tidy = (text) => (text || '').replace(/\s+/g, ' ').trim();
  return els.map((tr) => {
    if (tr.offsetParent === null) return { names: [], text: '' };
    // The row a table shows when it has nothing to list: one cell across the columns.
    if (tr.querySelector('td.empty, td.views-empty') || (tr.children.length === 1 && tr.children[0].colSpan > 1)) return { names: [], text: '', empty: true };
    const names = [];
    tr.querySelectorAll(':scope > td, :scope > th').forEach((cell) => {
      if (cell.querySelector('input[type="checkbox"]') && !cell.querySelector('a')) return;
      const copy = cell.cloneNode(true);
      copy.querySelectorAll('.dropbutton-wrapper, .marker, .tabledrag-handle, .machine-name, .element-invisible, .description').forEach((node) => node.remove());
      const text = tidy(copy.textContent);
      if (text) names.push(text, text.replace(/\s*\(Machine name: [^)]*\)\s*/g, '').replace(/\s*\(required\)\s*/g, '').trim());
      copy.querySelectorAll('a, .label').forEach((node) => { const value = tidy(node.textContent); if (value) names.push(value); });
    });
    return { names, text: tidy(tr.textContent) };
  });
}

/**
 * The row of a table named by a text: the row with a cell, a link or a label
 * that equals the text wins; a row that only contains the text is the fallback.
 * Waits for the row; fails with the names of the rows that are there.
 *
 * @param {object} world
 * @param {string} name
 * @param {{scope?: import('playwright').Locator, what?: string}} [options]
 * @returns {Promise<import('playwright').Locator>}
 */
async function rowNamed(world, name, options = {}) {
  const list = rows(world, options.scope);
  const wanted = clean(name);
  const find = async () => {
    const read = await list.evaluateAll(readRowNames);
    let index = read.findIndex((row) => row.names.includes(wanted));
    if (index === -1) index = read.findIndex((row) => row.names.some((value) => value.includes(wanted)));
    return { index, read };
  };
  const result = await poll(world, find, (value) => value.index !== -1);
  if (!result.ok) {
    const names = ((result.value && result.value.read) || []).map((row) => row.names[0]).filter(Boolean);
    throw friendly({
      message: `There is no ${options.what || 'row'} "${name}" in the tables of the page. The rows are: ${names.slice(0, 25).join(' | ') || '(none)'}${names.length > 25 ? ' ...' : ''}.`,
      hint: 'Use the text of the first column as the listing shows it; open the listing first, and remove a filter that hides the row.',
    });
  }
  return list.nth(result.value.index);
}

/**
 * Whether a row named by a text is in the tables of the page, without waiting
 * for it. Exact names only.
 *
 * @param {object} world
 * @param {string} name
 * @param {import('playwright').Locator} [scope]
 * @returns {Promise<boolean>}
 */
async function hasRow(world, name, scope) {
  const read = await rows(world, scope).evaluateAll(readRowNames);
  return read.some((row) => row.names.includes(clean(name)));
}

/**
 * The names (first reading) of the visible rows of the tables of the page.
 *
 * @param {object} world
 * @param {import('playwright').Locator} [scope]
 * @returns {Promise<string[]>}
 */
async function rowNames(world, scope) {
  const read = await rows(world, scope).evaluateAll(readRowNames);
  return read.map((row) => row.names[0]).filter(Boolean);
}

/**
 * The operations a row offers: the links of its drop button (the first one
 * shows, the others open with the arrow), or the plain links of its last cell.
 *
 * @param {import('playwright').Locator} row
 * @returns {Promise<string[]>}
 */
async function rowOperations(row) {
  return row.evaluate((tr) => {
    const links = tr.querySelectorAll('.dropbutton a, td:last-child a');
    return Array.from(new Set(Array.from(links).map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)));
  });
}

/**
 * Click an operation of a row ("Edit", "Delete", "Manage blocks"), opening the
 * drop button when the operation is behind its arrow.
 *
 * @param {object} world
 * @param {import('playwright').Locator} row
 * @param {string} operation
 * @param {string} rowName
 */
async function clickRowOperation(world, row, operation, rowName) {
  const link = row.locator('.dropbutton a, td:last-child a').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(operation) + '\\s*$', 'i') }).first();
  if (!(await link.count())) {
    const offered = await rowOperations(row);
    throw friendly({
      message: `The row "${rowName}" does not offer the operation "${operation}". It offers: ${offered.join(', ') || '(none)'}.`,
      hint: 'The operations depend on the permissions of the account; use the text the drop button shows.',
    });
  }
  if (!(await link.isVisible())) {
    await row.locator('.dropbutton-toggle button').first().click();
    await link.waitFor({ state: 'visible', timeout: budget(world) });
  }
  await link.click();
  await settle(world);
}

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

// Dialogs (the block and condition forms of the layout editor, the image and
// link forms of the editor) are jQuery UI dialogs: `.ui-dialog[role="dialog"]`
// with the title in `.ui-dialog-title`, the form in `.ui-dialog-content` and
// the buttons of the form copied to `.ui-dialog-buttonpane`.

/**
 * The dialog on top.
 *
 * @param {object} world
 * @returns {import('playwright').Locator}
 */
function dialog(world) {
  return world.page.locator('.ui-dialog:visible').last();
}

/**
 * Wait for a dialog and return it; fail with a hint when none opens.
 *
 * @param {object} world
 * @param {string} what - What should have opened it, for the message.
 * @returns {Promise<import('playwright').Locator>}
 */
async function waitForDialog(world, what) {
  const box = dialog(world);
  try {
    await box.waitFor({ state: 'visible', timeout: budget(world) });
    // The content arrives by AJAX after the frame.
    await box.locator('.ui-dialog-content').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `Expected a dialog after ${what}, but none opened.`, cause: err, hint: 'Dialogs need JavaScript; check for a JavaScript error on the page and that the link was clicked.' });
  }
  await settle(world);
  return box;
}

/**
 * Press a button of the dialog on top, by its text.
 *
 * @param {object} world
 * @param {string} name
 */
async function pressDialogButton(world, name) {
  const box = dialog(world);
  const button = box.locator('.ui-dialog-buttonpane button').filter({ hasText: exactly(name) }).first();
  if (!(await box.count()) || !(await button.count())) {
    const offered = (await box.count()) ? await box.locator('.ui-dialog-buttonpane button').allTextContents() : [];
    throw friendly({
      message: (await box.count()) ? `The dialog has no "${name}" button. It has: ${offered.map(clean).join(', ') || '(no buttons)'}.` : `There is no dialog on the page to press "${name}" in.`,
      hint: 'Open the dialog first; use the text of the button as the dialog shows it.',
    });
  }
  await button.click();
  await settle(world);
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/**
 * A RegExp for a field label: the text, with the star of a required field and
 * the "(Edit summary)" link of a body field allowed after it.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function labelPattern(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*(\\*|\\(Edit summary\\)|\\(Hide summary\\))?\\s*$', 'i');
}

/**
 * The form item (`.form-item`) of a field, found by its label. The search can
 * be limited to a container (a dialog, a fieldset).
 *
 * @param {object} world
 * @param {string} label
 * @param {import('playwright').Locator} [scope]
 * @returns {Promise<import('playwright').Locator>}
 */
async function formItem(world, label, scope) {
  const root = scope || world.page;
  const item = root.locator('.form-item').filter({ has: world.page.locator(':scope > label, :scope > .fieldset-legend').filter({ hasText: labelPattern(label) }) }).first();
  const result = await poll(world, () => item.count(), (count) => count > 0);
  if (!result.ok) {
    const labels = await root.locator('.form-item > label').evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    throw friendly({
      message: `There is no field labelled "${label}" on the page. The visible fields are: ${Array.from(new Set(labels)).slice(0, 30).join(' | ') || '(none)'}.`,
      hint: 'Use the label the form shows; open the form (and the vertical tab or fieldset that holds the field) first.',
    });
  }
  return item;
}

/**
 * The vertical tab links of the form (`.vertical-tabs-list`).
 *
 * @param {object} world
 * @returns {import('playwright').Locator}
 */
function verticalTabs(world) {
  return world.page.locator('.vertical-tabs-list .vertical-tab-item');
}

/**
 * The vertical tab with a title; fails with the titles that are there.
 *
 * @param {object} world
 * @param {string} title
 * @returns {Promise<import('playwright').Locator>}
 */
async function verticalTab(world, title) {
  const tab = verticalTabs(world).filter({ has: world.page.locator('strong').filter({ hasText: exactly(title) }) }).first();
  const result = await poll(world, () => tab.count(), (count) => count > 0);
  if (!result.ok) {
    const titles = await verticalTabs(world).locator('strong').allTextContents().catch(() => []);
    throw friendly({
      message: `There is no "${title}" vertical tab on the page. The vertical tabs are: ${titles.map(clean).join(', ') || '(none)'}.`,
      hint: 'Vertical tabs are on the content, term and account forms; the tabs offered depend on the permissions of the account.',
    });
  }
  return tab;
}

// ---------------------------------------------------------------------------
// The rich text editor
// ---------------------------------------------------------------------------

// A formatted text field is a `<textarea>` that the editor (CKEditor 5) hides
// and replaces with `.ck-editor`; the editing area `.ck-editor__editable`
// carries the editor instance (`ckeditorInstance`). When the text format has no
// editor, the textarea itself is the field.

/**
 * The form item of an editor field, by its label ("Body").
 *
 * @param {object} world
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function editorItem(world, label) {
  const item = await formItem(world, label);
  if (!(await item.locator('textarea').count())) {
    throw friendly({ message: `The field "${label}" is not a text area, so it has no editor.`, hint: 'Use the label of a formatted text field, for example "Body".' });
  }
  // The editor attaches after the page loads.
  await poll(world, () => item.locator('.ck-editor__editable, textarea:visible').count(), (count) => count > 0);
  return item;
}

/**
 * Write HTML into an editor field. Plain text becomes a paragraph.
 *
 * @param {object} world
 * @param {string} label
 * @param {string} value
 */
async function setEditor(world, label, value) {
  const item = await editorItem(world, label);
  const editable = item.locator('.ck-editor__editable').first();
  if (await editable.count()) {
    await editable.evaluate((el, html) => {
      el.ckeditorInstance.setData(html);
    }, /<[a-z][\s\S]*>/i.test(value) ? value : `<p>${value}</p>`);
    return;
  }
  await item.locator('textarea').first().fill(value);
}

/**
 * Read the HTML of an editor field.
 *
 * @param {object} world
 * @param {string} label
 * @returns {Promise<string>}
 */
async function getEditor(world, label) {
  const item = await editorItem(world, label);
  const editable = item.locator('.ck-editor__editable').first();
  if (await editable.count()) return editable.evaluate((el) => el.ckeditorInstance.getData());
  return item.locator('textarea').first().inputValue();
}

module.exports = {
  budget,
  settleTime,
  supplied,
  escapeRegExp,
  literal,
  exactly,
  clean,
  siteRoot,
  siteUrl,
  open,
  settle,
  actOrExplain,
  assertPresence,
  poll,
  resolveUser,
  isLoggedIn,
  submitLogin,
  logIn,
  sessionUsername,
  statusOf,
  MESSAGE_TYPES,
  messageSelector,
  messageTexts,
  ADMIN_PAGES,
  adminPath,
  requirePage,
  openAdminPage,
  rows,
  rowNamed,
  hasRow,
  rowNames,
  rowOperations,
  clickRowOperation,
  dialog,
  waitForDialog,
  pressDialogButton,
  labelPattern,
  formItem,
  verticalTabs,
  verticalTab,
  editorItem,
  setEditor,
  getEditor,
};
