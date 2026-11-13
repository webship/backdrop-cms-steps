'use strict';

// Administration step definitions: the administration bar (its menus, its
// search, its account links), the administration pages by name, the listings
// (filters, sorting, rows, operations, bulk actions), the dialog, confirmation
// forms, accounts, roles and permissions, the status report, the configuration
// manager and cron.
//
// Every assertion waits on what it reads, and every failure is a friendly error
// with a hint instead of a raw Playwright timeout stack.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  supplied,
  exactly,
  escapeRegExp,
  clean,
  open,
  settle,
  actOrExplain,
  assertPresence,
  poll,
  messageTexts,
  requirePage,
  openAdminPage,
  rows,
  rowNamed,
  rowNames,
  rowOperations,
  clickRowOperation,
  dialog,
  pressDialogButton,
  labelPattern,
} = require('./backdrop-helpers');

// ---------------------------------------------------------------------------
// The administration bar
// ---------------------------------------------------------------------------

// The administration bar is `#admin-bar`, added to the page by JavaScript for
// accounts with the "Access administration bar" permission. It holds the home
// icon menu (`#admin-bar-icon`: flush caches, run cron), the administration
// menu (`#admin-bar-menu`) and the extras (`#admin-bar-extra`: the menu search,
// the account link, "Log out").
const BAR = '#admin-bar';
const BAR_HINT = 'The administration bar (`#admin-bar`) shows for accounts with the "Access administration bar" permission and needs JavaScript.';

/**
 * Wait for the administration bar; fail with a hint when it does not show.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function adminBar(world) {
  const bar = world.page.locator(BAR).first();
  await actOrExplain('find', 'the administration bar', () => bar.waitFor({ state: 'visible', timeout: budget(world) }), BAR_HINT + ' Log in with an account that has it first.');
  return bar;
}

/**
 * Unfold a part of the administration bar that is folded. The bar measures
 * itself: when its items do not fit the width of the window, the list of the
 * search, the account link and "Log out" (`#admin-bar-extra`) folds behind
 * "More tasks", and on a narrower window the administration menu
 * (`#admin-bar-menu`) folds behind "Menu". A folded list carries the class
 * `dropdown` instead of `top-level` and opens while its item is hovered.
 *
 * @param {object} world
 * @param {string} id - `admin-bar-menu` or `admin-bar-extra`.
 */
async function unfoldBar(world, id) {
  const list = world.page.locator(`${BAR} #${id}`).first();
  const folded = await list.evaluate((el) => el.classList.contains('dropdown')).catch(() => false);
  if (!folded) return;
  const inner = list.locator(':scope > li > ul.dropdown').first();
  if (await inner.isVisible().catch(() => false)) return;
  await list.locator(':scope > li > span, :scope > li > a').first().hover();
  await inner.waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
}

/**
 * The link of a list of the administration bar with a text.
 *
 * @param {import('playwright').Locator} list - A `ul` of the bar.
 * @param {string} name
 * @returns {import('playwright').Locator}
 */
function barLink(list, name) {
  return list.locator(':scope > li > a, :scope > li > span').filter({ has: list.page().locator('.admin-bar-link-text').filter({ hasText: exactly(name) }) }).first();
}

/**
 * Assert the page shows (or does not show) the administration bar.
 *
 * Example #1: Then I should see the administration bar
 * Example #2: Then I should not see the administration bar
 * Example #3: And we should see the administration bar
 * Example #4: Then we should not see the administration bar
 * Example #5: And I should see the administration bar
 *
 */
Then(/^(I |we )*should( not)* see the administration bar$/, async function (pronounCase, notCase) {
  if (notCase) {
    // The bar is added after the page loads: give it the time it would need.
    await settle(this);
  }
  await assertPresence(this.page.locator(BAR), notCase, { label: 'the administration bar', hint: BAR_HINT, timeout: notCase ? 3000 : budget(this) });
});

/**
 * Assert the administration menu of the bar lists (or does not list) a
 * top-level item, such as "Content" or "Structure".
 *
 * Example #1: Then the administration bar should list "Content"
 * Example #2: Then the administration bar should list "Structure"
 * Example #3: And the administration bar should not list "Configuration"
 * Example #4: Then the administration bar should not list "User accounts"
 * Example #5: And the administration bar should list "Dashboard"
 *
 */
Then(/^the administration bar should( not)* list "([^"]*)"$/, async function (notCase, name) {
  const bar = await adminBar(this);
  const items = bar.locator('#admin-bar-menu > li > ul.dropdown > li > a .admin-bar-link-text');
  const result = await poll(this, async () => (await items.allTextContents()).map(clean), (texts) => (notCase ? !texts.includes(name) : texts.includes(name)));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the administration bar not to list "${name}", but it does.` : `Expected the administration bar to list "${name}", but it lists: ${result.value.join(', ') || '(nothing)'}.`,
      hint: 'The bar lists the sections the account may open; they follow its permissions.',
    });
  }
});

/**
 * Open a page from the administration menu of the bar, by the path of its
 * items ("Structure > Layouts"): each item is hovered to open its menu, the
 * last one is clicked.
 *
 * Example #1: When I open "Structure > Layouts" from the administration bar
 * Example #2: When I open "Content" from the administration bar
 * Example #3: When we open "Structure > Taxonomy" from the administration bar
 * Example #4: And I open "Reports > Status report" from the administration bar
 * Example #5: When open "Configuration > Development > Configuration manager" from the administration bar
 *
 */
When(/^(I |we )*open "([^"]*)" from the administration bar$/, async function (pronounCase, path) {
  const bar = await adminBar(this);
  const parts = path.split('>').map((part) => part.trim()).filter(Boolean);
  await unfoldBar(this, 'admin-bar-menu');
  let list = bar.locator('#admin-bar-menu > li > ul.dropdown').first();
  for (let index = 0; index < parts.length; index++) {
    const link = barLink(list, parts[index]);
    if (!(await link.count())) {
      const offered = await list.locator(':scope > li > a .admin-bar-link-text, :scope > li > span .admin-bar-link-text').allTextContents();
      throw friendly({
        message: `The administration bar has no "${parts[index]}" item${index ? ' under "' + parts.slice(0, index).join(' > ') + '"' : ''}. It offers: ${offered.map(clean).join(', ') || '(nothing)'}.`,
        hint: 'Use the texts of the menu items, separated by ">"; the items follow the permissions of the account.',
      });
    }
    if (index === parts.length - 1) {
      await actOrExplain('click the administration bar item', path, async () => {
        await link.waitFor({ state: 'visible', timeout: budget(this) });
        await link.click();
      }, 'The item opens when its parent is hovered; check the path of items.');
    } else {
      await actOrExplain('hover the administration bar item', parts.slice(0, index + 1).join(' > '), () => link.hover({ timeout: budget(this) }),
        'The item must be visible to open its menu; on a narrow window the menu of the bar folds behind "Menu", which the step opens first.');
      list = link.locator('xpath=..').locator(':scope > ul.dropdown').first();
      await actOrExplain('open the administration bar menu', parts.slice(0, index + 1).join(' > '), () => list.waitFor({ state: 'visible', timeout: budget(this) }),
        'The menu of an item opens when the item is hovered; the item may have no menu of its own.');
    }
  }
  await settle(this);
});

/**
 * Assert the administration bar folds (or does not fold) a part of itself. The
 * bar measures the window: when its items do not fit, the search, the account
 * link and "Log out" fold behind "More tasks"; on a narrower window the
 * administration menu folds behind "Menu". The steps of the bar open a folded
 * part themselves; this step states which case a scenario covers.
 *
 * Example #1: Then the administration bar should fold its tasks
 * Example #2: Then the administration bar should not fold its tasks
 * Example #3: And the administration bar should fold its menu
 * Example #4: Then the administration bar should not fold its menu
 * Example #5: And the administration bar should fold the tasks
 *
 */
Then(/^the administration bar should( not)* fold (?:its|the) (menu|tasks)$/, async function (notCase, part) {
  const bar = await adminBar(this);
  const list = bar.locator(part === 'menu' ? '#admin-bar-menu' : '#admin-bar-extra').first();
  const result = await poll(this, () => list.evaluate((el) => el.classList.contains('dropdown')), (folded) => (notCase ? !folded : folded));
  if (!result.ok) {
    const width = await this.page.evaluate(() => window.innerWidth);
    throw friendly({
      message: notCase ? `Expected the administration bar not to fold its ${part}, but it does at a window ${width} pixels wide.` : `Expected the administration bar to fold its ${part}, but it shows ${part === 'menu' ? 'the menu' : 'them'} in full at a window ${width} pixels wide.`,
      hint: `The bar folds by the room it has, which depends on the sections and the username of the account: ${part === 'menu' ? 'the menu folds behind "Menu"' : 'the search, the account link and "Log out" fold behind "More tasks"'}. Set the width first ("When I set the viewport size to 1000x800").`,
    });
  }
});

/**
 * Type into the menu search of the administration bar. The bar suggests the
 * administration pages whose title contains the text.
 *
 * Example #1: When I search the administration bar for "Layouts"
 * Example #2: When I search the administration bar for "Status report"
 * Example #3: When we search the administration bar for "Taxonomy"
 * Example #4: And I search the administration bar for "Permissions"
 * Example #5: When search the administration bar for "Menus"
 *
 */
When(/^(I |we )*search the administration bar for "([^"]*)"$/, async function (pronounCase, text) {
  const bar = await adminBar(this);
  const input = bar.locator('#admin-bar-search-items, .admin-bar-search input[type="search"]').first();
  await unfoldBar(this, 'admin-bar-extra');
  await actOrExplain('find', 'the menu search of the administration bar', () => input.waitFor({ state: 'visible', timeout: budget(this) }),
    'The search is the "Menu search" field of the bar ("Admin search" for a screen reader); the step opens "More tasks" when the bar folds it away.');
  await input.click();
  await input.fill('');
  // The search listens to the keys as they are typed.
  await input.pressSequentially(text, { delay: 40 });
});

/**
 * Assert the menu search of the administration bar suggests (or does not
 * suggest) a page. Suggestions read "Parent: Page" ("Structure: Layouts").
 *
 * Example #1: Then the administration bar search should suggest "Structure: Layouts"
 * Example #2: Then the administration bar search should suggest "Reports: Status report"
 * Example #3: And the administration bar search should not suggest "Structure: Menus"
 * Example #4: Then the administration bar search should suggest "Structure: Taxonomy"
 * Example #5: And the administration bar search should not suggest "User accounts: Permissions"
 *
 */
Then(/^the administration bar search should( not)* suggest "([^"]*)"$/, async function (notCase, name) {
  const links = this.page.locator(`${BAR} .admin-bar-search-results a`);
  const result = await poll(this, async () => (await links.allTextContents()).map(clean), (texts) => (notCase ? !texts.includes(name) : texts.includes(name)));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the administration bar search not to suggest "${name}", but it does.` : `Expected the administration bar search to suggest "${name}", but it suggests: ${result.value.slice(0, 20).join(' | ') || '(nothing)'}.`,
      hint: 'Search first ("When I search the administration bar for ..."); a suggestion reads "Parent: Page" and only pages the account may open are suggested.',
    });
  }
});

/**
 * Open a suggestion of the menu search of the administration bar.
 *
 * Example #1: When I choose "Structure: Layouts" from the administration bar search
 * Example #2: When I choose "Reports: Status report" from the administration bar search
 * Example #3: When we choose "Structure: Taxonomy" from the administration bar search
 * Example #4: And I choose "Structure: Menus" from the administration bar search
 * Example #5: When choose "Content: Manage files" from the administration bar search
 *
 */
When(/^(I |we )*choose "([^"]*)" from the administration bar search$/, async function (pronounCase, name) {
  const link = this.page.locator(`${BAR} .admin-bar-search-results a`).filter({ hasText: exactly(name) }).first();
  await actOrExplain('choose the administration bar search suggestion', name, async () => {
    if ((await link.count()) && !(await link.isVisible())) await unfoldBar(this, 'admin-bar-extra');
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, 'Search first ("When I search the administration bar for ..."); use the suggestion as it reads ("Structure: Layouts").');
  await settle(this);
});

/**
 * Assert the administration bar shows (or does not show) the account link of a
 * username.
 *
 * Example #1: Then the administration bar should show the account "editor"
 * Example #2: Then the administration bar should show the account "admin"
 * Example #3: And the administration bar should not show the account "admin"
 * Example #4: Then the administration bar should not show the account "member"
 * Example #5: And the administration bar should show the account "editor"
 *
 */
Then(/^the administration bar should( not)* show the account "([^"]*)"$/, async function (notCase, username) {
  const bar = await adminBar(this);
  const account = bar.locator('.admin-bar-account a .admin-bar-link-text, .admin-bar-account a');
  const result = await poll(this, async () => (await account.allTextContents()).map(clean), (texts) => (notCase ? !texts.includes(username) : texts.includes(username)));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the administration bar not to show the account "${username}", but it does.` : `Expected the administration bar to show the account "${username}", but it shows "${result.value[0] || '(no account link)'}".`,
      hint: 'The account link sits at the end of the bar, before "Log out".',
    });
  }
});

/**
 * Flush every cache of the site with the "Flush all caches" link of the home
 * icon menu of the administration bar, and wait for the confirmation.
 *
 * Example #1: When I flush all caches from the administration bar
 * Example #2: When we flush all caches from the administration bar
 * Example #3: And I flush all caches from the administration bar
 * Example #4: When I flush every cache from the administration bar
 * Example #5: And we flush every cache from the administration bar
 *
 */
When(/^(I |we )*flush (?:all caches|every cache) from the administration bar$/, async function (pronounCase) {
  const bar = await adminBar(this);
  const icon = bar.locator('#admin-bar-icon > li > a').first();
  const link = bar.locator('#admin-bar-icon a.flush-cache').first();
  if (!(await link.count())) {
    throw friendly({ message: 'The administration bar has no "Flush all caches" link for this account.', hint: 'The link needs the "Flush caches" permission.' });
  }
  await icon.hover();
  await actOrExplain('click', 'Flush all caches', async () => {
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, 'The link is in the menu of the home icon of the bar.');
  await settle(this);
  const result = await poll(this, () => messageTexts(this, 'status'), (texts) => texts.some((text) => /cache/i.test(text)));
  if (!result.ok) {
    throw friendly({ message: `The site did not confirm the caches were flushed. Messages: ${(await messageTexts(this)).join(' / ') || '(none)'}.`, hint: 'The confirmation is a status message on the page the flush returns to.' });
  }
});

/**
 * Log out with the "Log out" link of the administration bar.
 *
 * Example #1: When I log out from the administration bar
 * Example #2: When we log out from the administration bar
 * Example #3: And I log out from the administration bar
 * Example #4: When I sign out from the administration bar
 * Example #5: And we sign out from the administration bar
 *
 */
When(/^(I |we )*(?:log|sign) out from the administration bar$/, async function (pronounCase) {
  const bar = await adminBar(this);
  const link = bar.locator('.admin-bar-logout a').first();
  await unfoldBar(this, 'admin-bar-extra');
  await actOrExplain('click', 'Log out', async () => {
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, 'The "Log out" link sits at the end of the bar; the step opens "More tasks" when the bar folds it away.');
  await settle(this);
  this.siteUser = null;
});

// ---------------------------------------------------------------------------
// Administration pages by name
// ---------------------------------------------------------------------------

/**
 * Open an administration page by its name: dashboard, content, files,
 * comments, add content, user accounts, roles, permissions, layouts, custom
 * blocks, menus, taxonomy, content types, views, site information, status
 * report, configuration manager, single configuration import, single
 * configuration export, recent log messages and more; or by its path
 * ("admin/structure/menu/settings"). Fails when the page answers "Access
 * denied" or "Page not found".
 *
 * Example #1: Given I am on the "content" administration page
 * Example #2: Given I am on the "layouts" administration page
 * Example #3: Given we are on the "status report" administration page
 * Example #4: And I am on the "admin/structure/menu/settings" administration page
 * Example #5: Given on the "taxonomy" administration page
 *
 */
Given(/^(I am |we are )*on the "([^"]*)" administration page$/, async function (pronounCase, name) {
  await openAdminPage(this, name);
});

/**
 * Go to an administration page by its name or its path: the same as "I am on
 * the ... administration page", worded as an action.
 *
 * Example #1: When I go to the "content" administration page
 * Example #2: When I go to the "permissions" administration page
 * Example #3: When we go to the "menus" administration page
 * Example #4: And I go to the "single configuration export" administration page
 * Example #5: When go to the "user accounts" administration page
 *
 */
When(/^(I |we )*go to the "([^"]*)" administration page$/, async function (pronounCase, name) {
  await openAdminPage(this, name);
});

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

// The listings of the administration (content, files, user accounts) are views
// with exposed filters (`form.views-exposed-form`), a bulk form (the checkbox
// of each row, the "action" select and "Execute") and a drop button of
// operations per row. The other listings (menus, vocabularies, roles, layouts)
// are plain tables with the same drop buttons.
const LISTING_HINT = 'Open a listing first ("Given I am on the "content" administration page").';

/**
 * Set an exposed filter of the listing, by its label, and apply it with the
 * "Filter" button. A select takes the text of an option; a text filter takes
 * the text to look for.
 *
 * Example #1: When I filter the listing by "Type" with "Post"
 * Example #2: When I filter the listing by "Published" with "No"
 * Example #3: When we filter the listing by "Title contains" with "Field note"
 * Example #4: And I filter the listing by "Type" with "Page"
 * Example #5: When filter the listing by "Role" with "Editor"
 *
 */
When(/^(I |we )*filter the listing by "([^"]*)" with "([^"]*)"$/, async function (pronounCase, label, value) {
  const form = this.page.locator('form.views-exposed-form').first();
  await actOrExplain('find', 'the filters of the listing', () => form.waitFor({ state: 'visible', timeout: budget(this) }), LISTING_HINT + ' Only the listings built with Views have filters.');
  const widget = form.locator('.views-exposed-widget').filter({ has: this.page.locator('label').filter({ hasText: labelPattern(label) }) }).first();
  if (!(await widget.count())) {
    const labels = await form.locator('.views-exposed-widget label').allTextContents();
    throw friendly({ message: `The listing has no "${label}" filter. Its filters are: ${labels.map(clean).filter(Boolean).join(', ') || '(none)'}.`, hint: 'Use the label of the filter as the listing shows it.' });
  }
  const control = widget.locator('select, input[type="text"], input[type="search"], input[type="checkbox"]').first();
  const tag = await control.evaluate((el) => (el.tagName === 'SELECT' ? 'select' : el.type));
  if (tag === 'select') {
    const options = (await control.locator('option').allTextContents()).map(clean);
    if (!options.includes(clean(value))) {
      throw friendly({ message: `The "${label}" filter has no option "${value}". It offers: ${options.join(', ')}.`, hint: 'Use the text of an option as the filter shows it.' });
    }
    await control.selectOption({ label: (await control.locator('option').allTextContents())[options.indexOf(clean(value))] });
  } else if (tag === 'checkbox') {
    await control.setChecked(/^(yes|on|true|1|checked)$/i.test(value));
  } else {
    await control.fill(value);
  }
  await form.locator('.views-submit-button input[type="submit"], input[type="submit"]').first().click();
  await settle(this);
});

/**
 * Sort the listing by a column, with the link of its header. A second click on
 * the same column reverses the order.
 *
 * Example #1: When I sort the listing by "Title"
 * Example #2: When I sort the listing by "Updated"
 * Example #3: When we sort the listing by "Content type"
 * Example #4: And I sort the listing by "Username"
 * Example #5: When sort the listing by "Size"
 *
 */
When(/^(I |we )*sort the listing by "([^"]*)"$/, async function (pronounCase, column) {
  const links = this.page.locator('table:not(.sticky-header) > thead th a');
  // The sorted column carries an arrow icon next to its text.
  const read = () => links.evaluateAll((els) => els.map((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('svg, img, .element-invisible').forEach((node) => node.remove());
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  }));
  const result = await poll(this, read, (names) => names.some((name) => name.toLowerCase() === clean(column).toLowerCase()));
  if (!result.ok) {
    throw friendly({ message: `The listing cannot be sorted by "${column}". Its sortable columns are: ${(result.value || []).join(', ') || '(none)'}.`, hint: LISTING_HINT });
  }
  const link = links.nth(result.value.findIndex((name) => name.toLowerCase() === clean(column).toLowerCase()));
  await link.click();
  await settle(this);
});

/**
 * Assert the listing lists (or does not list) a row, by the text of its name
 * column (a title, a username, a file name, a term).
 *
 * Example #1: Then the listing should list "Field note 01"
 * Example #2: Then the listing should not list "Unpublished field note"
 * Example #3: And the listing should list "editor"
 * Example #4: Then the listing should list "Primary navigation"
 * Example #5: And the listing should not list "pixel.png"
 *
 */
Then(/^the listing should( not)* list "([^"]*)"$/, async function (notCase, name) {
  const result = await poll(this, () => rowNames(this), (names) => (notCase ? !names.some((value) => value === clean(name) || value.replace(/\s*\(Machine name: [^)]*\)/, '') === clean(name)) : false));
  if (notCase) {
    if (!result.ok) throw friendly({ message: `Expected the listing not to list "${name}", but it does.`, hint: 'A filter or another page of the pager can hide a row; this step reads the rows on the page.' });
    return;
  }
  await rowNamed(this, name);
});

/**
 * Assert the first row of the listing, by the text of its name column: for the
 * order after sorting.
 *
 * Example #1: Then the listing should start with "Field note 01"
 * Example #2: Then the listing should start with "Visit the apiary"
 * Example #3: And the listing should start with "admin"
 * Example #4: Then the listing should start with "About"
 * Example #5: And the listing should start with "Editor field note"
 *
 */
Then(/^the listing should start with "([^"]*)"$/, async function (name) {
  const result = await poll(this, () => rowNames(this), (names) => names.length > 0 && names[0].replace(/\s*\(Machine name: [^)]*\)/, '') === clean(name));
  if (!result.ok) {
    throw friendly({ message: `Expected the listing to start with "${name}", but it starts with "${(result.value && result.value[0]) || '(no rows)'}".`, hint: 'Sort the listing first ("When I sort the listing by ..."); the name is the text of the first column.' });
  }
});

/**
 * Assert how many rows the listing shows on the page: an exact number, at
 * least a number, or none (the "empty" row of the table).
 *
 * Example #1: Then the listing should have 3 rows
 * Example #2: Then the listing should have at least 10 rows
 * Example #3: And the listing should have no rows
 * Example #4: Then the listing should have 1 row
 * Example #5: And the listing should have at least 1 row
 *
 */
Then(/^the listing should have (no|at least \d+|\d+) rows?$/, async function (quantity) {
  const wanted = quantity === 'no' ? 0 : parseInt(quantity.replace(/\D+/g, ''), 10);
  const atLeast = /^at least/.test(quantity);
  const result = await poll(this, async () => (await rowNames(this)).length, (count) => (atLeast ? count >= wanted : count === wanted));
  if (!result.ok) {
    throw friendly({ message: `Expected the listing to have ${quantity} row${wanted === 1 ? '' : 's'}, but it has ${result.value}.`, hint: 'The rows are the ones on the page; a listing shows fifty rows a page, and a filter changes the count.' });
  }
});

/**
 * Tick the checkbox of a row of the listing, for a bulk action.
 *
 * Example #1: When I select the row "Field note 01" of the listing
 * Example #2: When I select the row "Field note 02" of the listing
 * Example #3: When we select the row "pixel.png" of the listing
 * Example #4: And I select the row "Opening hours" of the listing
 * Example #5: When select the row "Editor field note" of the listing
 *
 */
When(/^(I |we )*select the row "([^"]*)" of the listing$/, async function (pronounCase, name) {
  const row = await rowNamed(this, name);
  const box = row.locator('input[type="checkbox"][name^="bulk_form"], td:first-child input[type="checkbox"]').first();
  if (!(await box.count())) {
    throw friendly({ message: `The row "${name}" has no checkbox to select.`, hint: 'Only the listings with bulk actions (content, files, user accounts, comments) have one.' });
  }
  await box.check();
});

/**
 * Apply a bulk action to the selected rows of the listing: choose it in the
 * action select and press "Execute". An action that asks for confirmation
 * (deleting) stops on its confirmation form.
 *
 * Example #1: When I apply the "Unpublish content" action to the selected rows
 * Example #2: When I apply the "Publish content" action to the selected rows
 * Example #3: When we apply the "Promote content" action to the selected rows
 * Example #4: And I apply the "Delete content" action to the selected rows
 * Example #5: When apply the "Make content sticky" action to the selected rows
 *
 */
When(/^(I |we )*apply the "([^"]*)" action to the selected rows$/, async function (pronounCase, action) {
  const form = this.page.locator('.views-bulk-form').first();
  await actOrExplain('find', 'the bulk actions of the listing', () => form.waitFor({ state: 'visible', timeout: budget(this) }), LISTING_HINT + ' Only the listings of content, files, comments and user accounts have bulk actions.');
  const select = form.locator('select[name="action"]').first();
  const options = (await select.locator('option').allTextContents()).map(clean);
  if (!options.includes(clean(action))) {
    throw friendly({ message: `The listing has no bulk action "${action}". It offers: ${options.slice(1).join(', ')}.`, hint: 'Use the text of the action as the select shows it.' });
  }
  if (!(await this.page.locator('table:not(.sticky-header) tbody input[type="checkbox"]:checked').count())) {
    throw friendly({ message: `No row is selected for the bulk action "${action}".`, hint: 'Select rows first ("When I select the row "..." of the listing").' });
  }
  await select.selectOption({ label: (await select.locator('option').allTextContents())[options.indexOf(clean(action))] });
  await form.locator('input[type="submit"]').first().click();
  await settle(this);
});

/**
 * Choose an operation of a row of a listing, from its drop button ("Edit",
 * "Delete", "Manage blocks", "List terms"). The arrow of the drop button is
 * opened when the operation is behind it.
 *
 * Example #1: When I choose the "Edit" operation of the "Field note 01" row
 * Example #2: When I choose the "Delete" operation of the "Opening hours" row
 * Example #3: When we choose the "Manage blocks" operation of the "Home page" row
 * Example #4: And I choose the "List terms" operation of the "Tags" row
 * Example #5: When choose the "Manage links" operation of the "Primary navigation" row
 *
 */
When(/^(I |we )*choose the "([^"]*)" operation of the "([^"]*)" row$/, async function (pronounCase, operation, name) {
  const row = await rowNamed(this, name);
  await clickRowOperation(this, row, operation, name);
});

/**
 * Assert a row of a listing offers (or does not offer) an operation in its
 * drop button.
 *
 * Example #1: Then the "Field note 01" row should offer the "Edit" operation
 * Example #2: Then the "Field note 01" row should offer the "Delete" operation
 * Example #3: And the "Tags" row should not offer the "Delete vocabulary" operation
 * Example #4: Then the "Home page" row should offer the "Configure layout" operation
 * Example #5: And the "admin" row should not offer the "Cancel account" operation
 *
 */
Then(/^the "([^"]*)" row should( not)* offer the "([^"]*)" operation$/, async function (name, notCase, operation) {
  const row = await rowNamed(this, name);
  const offered = await rowOperations(row);
  const has = offered.some((value) => value.toLowerCase() === clean(operation).toLowerCase());
  if (notCase ? has : !has) {
    throw friendly({
      message: notCase ? `Expected the row "${name}" not to offer the operation "${operation}", but it does.` : `Expected the row "${name}" to offer the operation "${operation}", but it offers: ${offered.join(', ') || '(none)'}.`,
      hint: 'The operations of a row follow the permissions of the account.',
    });
  }
});

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

/**
 * Assert a dialog with a title is (or is not) open. The title only needs to
 * contain the text ("Add block" matches the dialog of any region).
 *
 * Example #1: Then I should see the dialog "Add block"
 * Example #2: Then I should not see the dialog "Add block"
 * Example #3: And I should see the dialog "Configure block"
 * Example #4: Then we should see the dialog "Add condition"
 * Example #5: And should not see the dialog "Configure region"
 *
 */
Then(/^(I |we )*should( not)* see the dialog "([^"]*)"$/, async function (pronounCase, notCase, title) {
  const box = this.page.locator('.ui-dialog').filter({ has: this.page.locator('.ui-dialog-title', { hasText: title }) });
  const result = await poll(this, async () => (await box.count()) > 0 && (await box.first().isVisible()), (visible) => (notCase ? !visible : visible));
  if (!result.ok) {
    const titles = await this.page.locator('.ui-dialog:visible .ui-dialog-title').allTextContents().catch(() => []);
    throw friendly({
      message: notCase ? `Expected no dialog titled "${title}", but it is open.` : `Expected a dialog titled "${title}", but ${titles.length ? 'the open dialog is "' + titles.map(clean).join('" / "') + '"' : 'no dialog is open'}.`,
      hint: 'Dialogs (`.ui-dialog`) open from links such as "Add block" and "Configure" in the layout editor; they need JavaScript.',
    });
  }
});

/**
 * Press a button of the open dialog, by its text.
 *
 * Example #1: When I press "Add block" in the dialog
 * Example #2: When I press "Update block" in the dialog
 * Example #3: When we press "Cancel" in the dialog
 * Example #4: And I press "Add condition" in the dialog
 * Example #5: When press "Save configuration" in the dialog
 *
 */
When(/^(I |we )*press "([^"]*)" in the dialog$/, async function (pronounCase, name) {
  await pressDialogButton(this, name);
});

/**
 * Close the open dialog with the close button of its title bar, without
 * saving what it holds.
 *
 * Example #1: When I close the dialog
 * Example #2: When we close the dialog
 * Example #3: And I close the dialog
 * Example #4: When I close the open dialog
 * Example #5: And we close the open dialog
 *
 */
When(/^(I |we )*close the (?:open )?dialog$/, async function (pronounCase) {
  const box = dialog(this);
  if (!(await box.count())) {
    throw friendly({ message: 'There is no dialog to close.', hint: 'Open a dialog first (for example "When I open the block list of the "Sidebar" region").' });
  }
  await box.locator('.ui-dialog-titlebar-close').first().click();
  await assertPresence(this.page.locator('.ui-dialog:visible'), ' not', { label: 'the dialog after closing it', hint: 'The close button is the cross of the title bar.', timeout: budget(this) });
});

// ---------------------------------------------------------------------------
// Confirmation forms
// ---------------------------------------------------------------------------

// A destructive action stops on a confirmation form (`form.confirmation`): the
// question is the heading of the page, the form has one button and "Cancel".

/**
 * Assert the page asks for confirmation with a question (the heading of the
 * confirmation form). The heading only needs to contain the text.
 *
 * Example #1: Then I should be asked to confirm "Are you sure you want to delete"
 * Example #2: Then I should be asked to confirm "Are you sure you want to delete Opening hours?"
 * Example #3: And we should be asked to confirm "Are you sure you want to delete the term"
 * Example #4: Then I should be asked to confirm "Are you sure you want to delete these content items?"
 * Example #5: And should be asked to confirm "Are you sure"
 *
 */
Then(/^(I |we )*should be asked to confirm "([^"]*)"$/, async function (pronounCase, question) {
  const form = this.page.locator('form.confirmation').first();
  const result = await poll(this, async () => ((await form.count()) ? clean(await this.page.locator('h1').first().textContent()) : null), (heading) => heading !== null && heading.includes(clean(question)));
  if (!result.ok) {
    throw friendly({
      message: result.value === null ? `Expected a confirmation form asking "${question}", but the page (${this.page.url()}) has none.` : `Expected to be asked "${question}", but the page asks "${result.value}".`,
      hint: 'A confirmation form (`form.confirmation`) follows a delete link or a bulk delete action.',
    });
  }
});

/**
 * Answer a confirmation form with its button, by the text of the button
 * ("Delete", "Confirm", "Cancel account"), and wait for the next page.
 *
 * Example #1: When I confirm with "Delete"
 * Example #2: When I confirm with "Confirm"
 * Example #3: When we confirm with "Delete"
 * Example #4: And I confirm with "Revert"
 * Example #5: When confirm with "Delete"
 *
 */
When(/^(I |we )*confirm with "([^"]*)"$/, async function (pronounCase, name) {
  const form = this.page.locator('form.confirmation').first();
  await actOrExplain('find', 'the confirmation form', () => form.waitFor({ state: 'visible', timeout: budget(this) }),
    'A confirmation form (`form.confirmation`) follows a delete link or a bulk delete action; the action before this step did not lead to one.');
  const button = form.locator(`input[type="submit"][value="${name.replace(/"/g, '\\"')}"]`).first();
  if (!(await button.count())) {
    const offered = await form.locator('input[type="submit"]').evaluateAll((els) => els.map((el) => el.value));
    throw friendly({ message: `The confirmation form has no "${name}" button. It has: ${offered.join(', ') || '(none)'}.`, hint: 'Use the text of the button as the form shows it.' });
  }
  await button.click();
  await settle(this);
});

/**
 * Leave a confirmation form with its "Cancel" link: nothing is changed.
 *
 * Example #1: When I cancel the confirmation
 * Example #2: When we cancel the confirmation
 * Example #3: And I cancel the confirmation
 * Example #4: When I cancel the confirmation form
 * Example #5: And we cancel the confirmation form
 *
 */
When(/^(I |we )*cancel the confirmation(?: form)?$/, async function (pronounCase) {
  const cancel = this.page.locator('form.confirmation .form-actions a').filter({ hasText: exactly('Cancel') }).first();
  await actOrExplain('find', 'the "Cancel" link of the confirmation form', () => cancel.waitFor({ state: 'visible', timeout: budget(this) }),
    'A confirmation form (`form.confirmation`) follows a delete link or a bulk delete action.');
  await cancel.click();
  await settle(this);
});

// ---------------------------------------------------------------------------
// Accounts, roles and permissions
// ---------------------------------------------------------------------------

/**
 * Assert a role has (or does not have) a permission, read from the permissions
 * page: the checkbox of the permission in the column of the role. The
 * permission is named as the page shows it ("Administer content"). Needs an
 * account that may open the permissions page.
 *
 * Example #1: Then the "Editor" role should have the permission "Access the content overview page"
 * Example #2: Then the "Editor" role should not have the permission "Administer Layouts"
 * Example #3: And the "Anonymous" role should have the permission "View published content"
 * Example #4: Then the "Authenticated" role should not have the permission "Administer menus and menu items"
 * Example #5: And the "Administrator" role should have the permission "Administer user accounts"
 *
 */
Then(/^the "([^"]*)" role should( not)* have the permission "([^"]*)"$/, async function (role, notCase, permission) {
  if (!/\/admin\/config\/people\/permissions/.test(this.page.url())) await openAdminPage(this, 'permissions');
  const table = this.page.locator('table#permissions').first();
  await actOrExplain('find', 'the permissions table', () => table.waitFor({ state: 'visible', timeout: budget(this) }), 'The table is on Configuration > User accounts > Permissions.');
  const read = await table.evaluate((el, wanted) => {
    const tidy = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const roles = Array.from(el.querySelectorAll('thead th')).map((th) => tidy(th.textContent));
    const column = roles.findIndex((name, index) => index > 0 && name.toLowerCase() === wanted.role.toLowerCase());
    const names = Array.from(el.querySelectorAll('tbody tr:not(.module-row) .permission-name')).map((node) => tidy(node.textContent));
    const row = Array.from(el.querySelectorAll('tbody tr:not(.module-row)')).find((tr) => {
      const name = tr.querySelector('.permission-name');
      return name && tidy(name.textContent).toLowerCase() === wanted.permission.toLowerCase();
    });
    if (column === -1 || !row) return { roles: roles.slice(1), column, found: Boolean(row), names };
    // An "Authenticated" permission shows as a ticked, disabled stand-in for the other roles.
    const cell = row.children[column];
    const boxes = Array.from(cell.querySelectorAll('input[type="checkbox"]'));
    const shown = boxes.find((box) => box.offsetParent !== null) || boxes[0];
    return { roles: roles.slice(1), column, found: true, checked: Boolean(shown && shown.checked) };
  }, { role, permission });
  if (read.column === -1) {
    throw friendly({ message: `There is no "${role}" role on the permissions page. The roles are: ${read.roles.join(', ')}.`, hint: 'Use the name of the role as the header of the table shows it.' });
  }
  if (!read.found) {
    const close = read.names.filter((name) => name.toLowerCase().includes(clean(permission).toLowerCase().split(' ').pop()));
    throw friendly({ message: `There is no permission "${permission}" on the permissions page.${close.length ? ' Close names: ' + close.slice(0, 8).join(' | ') + '.' : ''}`, hint: 'Use the name of the permission as the page shows it; a permission exists only while its module is enabled.' });
  }
  if (notCase ? read.checked : !read.checked) {
    throw friendly({
      message: notCase ? `Expected the "${role}" role not to have the permission "${permission}", but it has it.` : `Expected the "${role}" role to have the permission "${permission}", but it does not.`,
      hint: 'A permission given to "Authenticated" is given to every role but "Anonymous".',
    });
  }
});

/**
 * Assert an account has (or does not have) a role, read from the listing of
 * user accounts. Needs an account that may manage user accounts.
 *
 * Example #1: Then the account "editor" should have the "Editor" role
 * Example #2: Then the account "admin" should have the "Administrator" role
 * Example #3: And the account "member" should not have the "Editor" role
 * Example #4: Then the account "editor" should not have the "Administrator" role
 * Example #5: And the account "member" should not have the "Administrator" role
 *
 */
Then(/^the account "([^"]*)" should( not)* have the "([^"]*)" role$/, async function (username, notCase, role) {
  if (!/\/admin\/people(\/list)?(\?|$)/.test(this.page.url())) await openAdminPage(this, 'user accounts');
  const row = await rowNamed(this, username, { what: 'account' });
  const roles = clean(await row.locator('td.views-field-role').first().innerText().catch(() => '')).split(/\s*,\s*|\n/).map(clean).filter(Boolean);
  const has = roles.some((value) => value.toLowerCase() === clean(role).toLowerCase());
  if (notCase ? has : !has) {
    throw friendly({
      message: notCase ? `Expected the account "${username}" not to have the "${role}" role, but it has it.` : `Expected the account "${username}" to have the "${role}" role, but its roles are: ${roles.join(', ') || '(none beyond Authenticated)'}.`,
      hint: 'Roles are given on the form of the account; the "Authenticated" role is not listed.',
    });
  }
});

/**
 * Assert the status of an account, read from the listing of user accounts.
 *
 * Example #1: Then the account "editor" should be active
 * Example #2: Then the account "member" should be active
 * Example #3: And the account "admin" should be active
 * Example #4: Then the account "spammer" should be blocked
 * Example #5: And the account "member" should be active
 *
 */
Then(/^the account "([^"]*)" should be (active|blocked)$/, async function (username, state) {
  if (!/\/admin\/people(\/list)?(\?|$)/.test(this.page.url())) await openAdminPage(this, 'user accounts');
  const row = await rowNamed(this, username, { what: 'account' });
  const found = clean(await row.locator('td.views-field-status').first().textContent().catch(() => ''));
  if (found.toLowerCase() !== state) {
    throw friendly({ message: `Expected the account "${username}" to be ${state}, but the listing shows "${found || '(no status)'}".`, hint: 'The status is the "Status" column of the listing of user accounts.' });
  }
});

/**
 * Assert the site has (or does not have) a role, read from the roles page.
 *
 * Example #1: Then the site should have the role "Editor"
 * Example #2: Then the site should have the role "Administrator"
 * Example #3: And the site should not have the role "Moderator"
 * Example #4: Then the site should have the role "Authenticated"
 * Example #5: And the site should not have the role "Publisher"
 *
 */
Then(/^the site should( not)* have the role "([^"]*)"$/, async function (notCase, role) {
  if (!/\/admin\/config\/people\/roles(\?|$)/.test(this.page.url())) await openAdminPage(this, 'roles');
  const names = (await rowNames(this, this.page.locator('table#user-roles'))).map((name) => name.replace(/\s*\(required\)/, '').replace(/\s*\(Machine name: [^)]*\)/, '').trim());
  const has = names.some((value) => value.toLowerCase() === clean(role).toLowerCase());
  if (notCase ? has : !has) {
    throw friendly({
      message: notCase ? `Expected the site not to have the role "${role}", but it has it.` : `Expected the site to have the role "${role}", but its roles are: ${names.join(', ')}.`,
      hint: 'Roles are listed on Configuration > User accounts > Roles.',
    });
  }
});

// ---------------------------------------------------------------------------
// Status report, cron, configuration
// ---------------------------------------------------------------------------

const REPORT_KINDS = { info: 'report-info', ok: 'report-status', warning: 'report-warning', error: 'report-error' };

/**
 * Read the entries of the status report. Opens the report when the page is
 * another one.
 *
 * @param {object} world
 * @returns {Promise<Array<{title: string, value: string, kind: string}>>}
 */
async function reportEntries(world) {
  if (!/\/admin\/reports\/status(\?|$)/.test(world.page.url())) await openAdminPage(world, 'status report');
  const table = world.page.locator('table.system-status-report').first();
  await actOrExplain('find', 'the status report', () => table.waitFor({ state: 'visible', timeout: budget(world) }), 'The report is on Reports > Status report.');
  return table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => {
    const tidy = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const title = tr.querySelector('.status-title');
    const copy = title ? title.cloneNode(true) : null;
    if (copy) copy.querySelectorAll('.status-summary-mobile').forEach((node) => node.remove());
    const value = tr.querySelector('.status-value');
    const valueCopy = value ? value.cloneNode(true) : null;
    if (valueCopy) valueCopy.querySelectorAll('.description-toggle').forEach((node) => node.remove());
    const kind = Array.from(tr.classList).find((name) => name.indexOf('report-') === 0) || '';
    return { title: copy ? tidy(copy.textContent) : '', value: valueCopy ? tidy(valueCopy.textContent) : '', kind };
  }).filter((entry) => entry.title));
}

/**
 * Assert the status report shows (or does not show) errors or warnings.
 *
 * Example #1: Then the status report should not show errors
 * Example #2: Then the status report should show warnings
 * Example #3: And the status report should not show warnings
 * Example #4: Then the status report should show errors
 * Example #5: And the status report should not show errors
 *
 */
Then(/^the status report should( not)* show (errors|warnings)$/, async function (notCase, kind) {
  const entries = await reportEntries(this);
  const found = entries.filter((entry) => entry.kind === (kind === 'errors' ? 'report-error' : 'report-warning'));
  if (notCase ? found.length > 0 : found.length === 0) {
    throw friendly({
      message: notCase ? `Expected the status report to show no ${kind}, but it shows ${found.length}: ${found.map((entry) => entry.title + ' (' + entry.value.slice(0, 80) + ')').join(' | ')}.` : `Expected the status report to show ${kind}, but it shows none.`,
      hint: 'The report is on Reports > Status report; each entry is a row with its kind (info, ok, warning, error).',
    });
  }
});

/**
 * Assert an entry of the status report contains (or does not contain) a text
 * in its value, by the title of the entry ("PHP", "Web server").
 *
 * Example #1: Then the status report entry "PHP" should contain "8."
 * Example #2: Then the status report entry "MySQL Database" should contain "MariaDB"
 * Example #3: And the status report entry "Cron maintenance tasks" should contain "Last run"
 * Example #4: Then the status report entry "Web server" should not contain "Apache"
 * Example #5: And the status report entry "File system" should contain "Writable"
 *
 */
Then(/^the status report entry "([^"]*)" should( not)* contain "([^"]*)"$/, async function (title, notCase, text) {
  const entries = await reportEntries(this);
  const entry = entries.find((item) => item.title.toLowerCase() === clean(title).toLowerCase());
  if (!entry) {
    throw friendly({ message: `The status report has no entry "${title}". Its entries are: ${entries.map((item) => item.title).join(' | ')}.`, hint: 'Use the title of the entry as the report shows it.' });
  }
  const has = entry.value.includes(clean(text));
  if (notCase ? has : !has) {
    throw friendly({ message: notCase ? `Expected the status report entry "${title}" not to contain "${text}", but it reads "${entry.value}".` : `Expected the status report entry "${title}" to contain "${text}", but it reads "${entry.value}".`, hint: 'The value is the second column of the entry.' });
  }
});

/**
 * Assert the kind of an entry of the status report: info, ok, a warning or an
 * error.
 *
 * Example #1: Then the status report entry "PHP" should be ok
 * Example #2: Then the status report entry "MySQL Database" should be info
 * Example #3: And the status report entry "Cron maintenance tasks" should be ok
 * Example #4: Then the status report entry "Trusted Host Setting" should be a warning
 * Example #5: And the status report entry "File system" should be an error
 *
 */
Then(/^the status report entry "([^"]*)" should be (?:an? )?(info|ok|warning|error)$/, async function (title, kind) {
  const entries = await reportEntries(this);
  const entry = entries.find((item) => item.title.toLowerCase() === clean(title).toLowerCase());
  if (!entry) {
    throw friendly({ message: `The status report has no entry "${title}". Its entries are: ${entries.map((item) => item.title).join(' | ')}.`, hint: 'Use the title of the entry as the report shows it.' });
  }
  if (entry.kind !== REPORT_KINDS[kind]) {
    const found = Object.keys(REPORT_KINDS).find((key) => REPORT_KINDS[key] === entry.kind) || entry.kind || 'unknown';
    throw friendly({ message: `Expected the status report entry "${title}" to be ${kind}, but it is ${found}: "${entry.value.slice(0, 160)}".`, hint: 'The kind is the icon of the entry: info, ok (a tick), warning or error.' });
  }
});

/**
 * Run cron from the administration ("Run cron" of the status report) and wait
 * for the confirmation. Cron publishes scheduled content and indexes new
 * content for the search.
 *
 * Example #1: When I run cron
 * Example #2: When we run cron
 * Example #3: And I run cron
 * Example #4: When I run the cron tasks
 * Example #5: And we run the cron tasks
 *
 */
When(/^(I |we )*run (?:cron|the cron tasks)$/, async function (pronounCase) {
  await open(this, '/admin/reports/status/run-cron');
  await requirePage(this, 'Run cron');
  const result = await poll(this, () => messageTexts(this), (texts) => texts.some((text) => /Cron ran successfully/i.test(text)));
  if (!result.ok) {
    throw friendly({ message: `Cron did not confirm it ran. Messages: ${result.value.join(' / ') || '(none)'}.`, hint: 'Running cron needs the "Administer site configuration" permission; a cron run already in progress answers with a warning.' });
  }
});

/**
 * Export one configuration file with the "Single import/export" form of the
 * configuration manager: choose its group, then its name, and wait for the
 * exported text. The name is the label of the option or the name of the file
 * ("system.core"). Nothing is changed on the site.
 *
 * Example #1: When I export the configuration "system.core" of the group "System configuration"
 * Example #2: When I export the configuration "Tags" of the group "Vocabularies"
 * Example #3: When we export the configuration "Post" of the group "Content types"
 * Example #4: And I export the configuration "Primary navigation" of the group "Menus"
 * Example #5: When export the configuration "Default Layout" of the group "Layouts"
 *
 */
When(/^(I |we )*export the configuration "([^"]*)" of the group "([^"]*)"$/, async function (pronounCase, name, group) {
  if (!/configuration\/single\/export/.test(this.page.url())) await openAdminPage(this, 'single configuration export');
  const form = this.page.locator('form#config-export-single-form, form.config-export-single-form').first();
  const groups = form.locator('select[name="config_group"]');
  const groupOptions = (await groups.locator('option').allTextContents()).map(clean);
  if (!groupOptions.includes(clean(group))) {
    throw friendly({ message: `There is no configuration group "${group}". The groups are: ${groupOptions.slice(1).join(', ')}.`, hint: 'Use the text of the group as the select shows it.' });
  }
  await groups.selectOption({ label: group });
  await settle(this);
  const names = form.locator('select[name="config_name"]');
  const read = async () => names.locator('option').evaluateAll((els) => els.map((el) => ({ value: el.value, label: (el.textContent || '').replace(/\s+/g, ' ').trim() })));
  const wanted = clean(name).toLowerCase();
  const pick = (options) => options.find((option) => option.value.toLowerCase() === wanted || option.label.toLowerCase() === wanted)
    || options.find((option) => option.label.toLowerCase().includes('(' + wanted + ')') || option.label.toLowerCase().startsWith(wanted + ' '));
  const result = await poll(this, read, (options) => Boolean(pick(options)));
  if (!result.ok) {
    throw friendly({ message: `The group "${group}" has no configuration "${name}". It offers: ${result.value.filter((option) => option.value).map((option) => option.label).slice(0, 30).join(' | ')}.`, hint: 'Use the label of the option or the name of the configuration file.' });
  }
  await names.selectOption({ value: pick(result.value).value });
  await settle(this);
  const filled = await poll(this, () => form.locator('textarea[name="export"]').first().inputValue().catch(() => ''), (value) => value.trim().length > 0);
  if (!filled.ok) {
    throw friendly({ message: `The export of "${name}" stayed empty.`, hint: 'The exported text arrives by AJAX after the name is chosen; check for a JavaScript error on the page.' });
  }
});

/**
 * Assert the text of the single configuration export contains (or does not
 * contain) a text.
 *
 * Example #1: Then the exported configuration should contain "site_name"
 * Example #2: Then the exported configuration should contain "\"_config_name\": \"system.core\""
 * Example #3: And the exported configuration should not contain "password"
 * Example #4: Then the exported configuration should contain "main-menu"
 * Example #5: And the exported configuration should not contain "no-such-key"
 *
 */
Then(/^the exported configuration should( not)* contain "(.*)"$/, async function (notCase, text) {
  const area = this.page.locator('form.config-export-single-form textarea[name="export"], form#config-export-single-form textarea[name="export"]').first();
  const wanted = text.replace(/\\"/g, '"');
  const result = await poll(this, () => area.inputValue().catch(() => null), (value) => value !== null && (notCase ? !value.includes(wanted) : value.includes(wanted)));
  if (!result.ok) {
    throw friendly({
      message: result.value === null ? 'There is no exported configuration on the page.' : notCase ? `Expected the exported configuration not to contain "${wanted}", but it does.` : `Expected the exported configuration to contain "${wanted}", but it reads: ${clean(result.value).slice(0, 300)}...`,
      hint: 'Export first ("When I export the configuration "..." of the group "...""); the export is JSON.',
    });
  }
});

/**
 * Assert the configuration manager has (or does not have) staged changes
 * waiting to be imported, read from its "Synchronize" page.
 *
 * Example #1: Then the configuration should not have staged changes
 * Example #2: Then the configuration should have staged changes
 * Example #3: And the configuration should not have staged changes
 * Example #4: Then the site configuration should not have staged changes
 * Example #5: And the site configuration should have staged changes
 *
 */
Then(/^the (?:site )?configuration should( not)* have staged changes$/, async function (notCase) {
  if (!/\/admin\/config\/development\/configuration(\?|$)/.test(this.page.url())) await openAdminPage(this, 'configuration manager');
  const form = this.page.locator('form#config-sync-form, form.config-sync-form').first();
  await actOrExplain('find', 'the configuration synchronize form', () => form.waitFor({ state: 'attached', timeout: budget(this) }), 'The form is on Configuration > Development > Configuration manager.');
  const none = (await form.getByText('There are no configuration changes currently staged').count()) > 0;
  const staged = await rowNames(this, form);
  if (notCase ? !none : none) {
    throw friendly({
      message: notCase ? `Expected no staged configuration changes, but the configuration manager lists: ${staged.slice(0, 20).join(' | ') || '(changes)'}.` : 'Expected staged configuration changes, but the configuration manager says there are none.',
      hint: 'Staged changes are the files of the staging directory that differ from the active configuration.',
    });
  }
});
