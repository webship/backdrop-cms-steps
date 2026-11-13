'use strict';

// Session, messages and front-end step definitions: logging in and out with
// the users registry, the system messages and their "Dismiss" link, the form
// errors, the primary navigation (and its toggle on a narrow screen), the
// breadcrumb, the pager, the page heading and the page tabs, the search block
// and the search results, teasers and tags, blocks, the layout template and
// the theme of a page, and the "Access denied" and "Page not found" pages.
//
// The administration has its own step files: backdrop-admin.steps.js (the
// administration bar, named pages, listings, dialogs, accounts, roles and
// permissions, the status report, configuration), backdrop-content.steps.js
// (content forms, the editor, images, tags, menu links) and
// backdrop-layout.steps.js (the layout editor).
//
// Steps that webship-js already covers with its generic click, fill and see
// vocabulary are not duplicated here; see README.md of this folder.
//
// Every assertion waits on what it reads (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout
// stack.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  supplied,
  literal,
  exactly,
  clean,
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
  messageSelector,
  messageTexts,
  formItem,
} = require('./backdrop-helpers');

// ---------------------------------------------------------------------------
// Logging in and out
// ---------------------------------------------------------------------------

/**
 * Log in with an account of the users registry (`worldParameters.users` in
 * cucumber.js), by its handle. Any session of the browser is ended first. The
 * step fails with the message of the site when the session does not start.
 *
 * Example #1: Given I am logged in as "admin"
 * Example #2: Given I am logged in as "editor"
 * Example #3: Given we are logged in as "member"
 * Example #4: And I am logged in as "editor"
 * Example #5: Given logged in as "admin"
 *
 */
Given(/^(I am |we are )*logged in as "([^"]*)"$/, async function (pronounCase, handle) {
  const { username, password } = resolveUser(this, handle);
  await logIn(this, username, password, handle);
});

/**
 * Log in through the log in form with an account of the users registry, by its
 * handle: the same as "I am logged in as", worded as an action.
 *
 * Example #1: When I log in as "admin"
 * Example #2: When I log in as "editor"
 * Example #3: When we log in as "member"
 * Example #4: And I sign in as "editor"
 * Example #5: When we sign in as "admin"
 *
 */
When(/^(I |we )*(?:log in|sign in) as "([^"]*)"$/, async function (pronounCase, handle) {
  const { username, password } = resolveUser(this, handle);
  await logIn(this, username, password, handle);
});

/**
 * Submit the log in form with a username and a password as they are typed,
 * without judging the outcome: for wrong passwords and unknown accounts. Assert
 * the outcome with the message and session steps.
 *
 * Example #1: When I submit the log in form with the username "admin" and the password "wrong"
 * Example #2: When I submit the log in form with the username "nobody" and the password "secret"
 * Example #3: When we submit the log in form with the username "editor" and the password ""
 * Example #4: And I submit the log in form with the username "member" and the password "not-this"
 * Example #5: When submit the log in form with the username "admin@example.com" and the password "wrong"
 *
 */
When(/^(I |we )*submit the log in form with the username "([^"]*)" and the password "([^"]*)"$/, async function (pronounCase, username, password) {
  await submitLogin(this, username, password);
});

/**
 * Log out through the log out address of the site (`/user/logout`) and check
 * the session ended.
 *
 * Example #1: When I log out of the site
 * Example #2: When we log out of the site
 * Example #3: And I log out of the site
 * Example #4: When I sign out of the site
 * Example #5: And we sign out of the site
 *
 */
When(/^(I |we )*(?:log|sign) out of the site$/, async function (pronounCase) {
  await open(this, '/user/logout');
  if (await isLoggedIn(this)) {
    throw friendly({ message: 'The session is still signed in after opening /user/logout.', hint: 'Check that the log out address is not blocked or redirected by a module.' });
  }
  this.siteUser = null;
});

/**
 * Assert the session of the browser belongs (or does not belong) to an account
 * of the users registry. The username is read from the account page with the
 * cookies of the browser; the current page stays where it is.
 *
 * Example #1: Then I should be logged in as "editor"
 * Example #2: Then I should be logged in as "admin"
 * Example #3: And I should not be logged in as "admin"
 * Example #4: Then we should be logged in as "member"
 * Example #5: And should not be logged in as "editor"
 *
 */
Then(/^(I |we )*should( not)* be logged in as "([^"]*)"$/, async function (pronounCase, notCase, handle) {
  const { username } = resolveUser(this, handle);
  const found = await sessionUsername(this);
  const matches = found !== null && found.toLowerCase() === username.toLowerCase();
  if (notCase ? matches : !matches) {
    throw friendly({
      message: notCase ? `Expected the session not to belong to "${username}", but it does.` : `Expected the session to belong to "${username}", but ${found === null ? 'nobody is logged in' : 'it belongs to "' + found + '"'}.`,
      hint: 'The session is the one of the browser of this scenario; log in with "Given I am logged in as ..." first.',
    });
  }
});

/**
 * Assert nobody is logged in: the page is not a signed-in page and the browser
 * holds no session cookie.
 *
 * Example #1: Then I should be logged out
 * Example #2: Then we should be logged out
 * Example #3: And I should be logged out
 * Example #4: Then I should be signed out
 * Example #5: And we should be signed out
 *
 */
Then(/^(I |we )*should be (?:logged|signed) out$/, async function (pronounCase) {
  const cookies = (await this.page.context().cookies()).filter((cookie) => /^S?SESS[0-9a-zA-Z_-]{20,}$/.test(cookie.name));
  const found = await sessionUsername(this);
  if (found !== null || (await isLoggedIn(this))) {
    throw friendly({
      message: `Expected nobody to be logged in, but the session belongs to "${found === null ? 'a signed-in account' : found}"${cookies.length ? ' (cookie ' + cookies[0].name + ')' : ''}.`,
      hint: 'Log out with "When I log out of the site", or start the scenario with "Given I am an anonymous user".',
    });
  }
});

/**
 * Assert the browser holds (or does not hold) the session cookie of the site:
 * `SESS` or, over HTTPS, `SSESS` followed by a hash.
 *
 * Example #1: Then I should have a session cookie
 * Example #2: Then I should not have a session cookie
 * Example #3: And we should have a session cookie
 * Example #4: Then we should not have a session cookie
 * Example #5: And I should have a session cookie
 *
 */
Then(/^(I |we )*should( not)* have a session cookie$/, async function (pronounCase, notCase) {
  const result = await poll(this, async () => (await this.page.context().cookies()).filter((cookie) => /^S?SESS[0-9a-zA-Z_-]{20,}$/.test(cookie.name)).map((cookie) => cookie.name),
    (names) => (notCase ? names.length === 0 : names.length > 0));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected no session cookie, but the browser holds ${result.value.join(', ')}.` : 'Expected a session cookie (SESS... or SSESS...), but the browser holds none.',
      hint: 'The session cookie is set when an account logs in and removed when it logs out.',
    });
  }
});

/**
 * Ask for a password reset through the "Reset password" form (`/user/password`)
 * for a username or an email address. The site answers with a status message
 * and sends an email; the account is not changed. An unknown name is answered
 * with an error message, which the scenario asserts. The step fails when the
 * site refuses the request because of its flood limit (too many requests for
 * one account or from one address), and says how to lift it on a test site.
 *
 * Example #1: When I ask for a password reset for "editor"
 * Example #2: When I ask for a password reset for "member@example.com"
 * Example #3: When we ask for a password reset for "member"
 * Example #4: And I ask for a password reset for "nobody"
 * Example #5: When ask for a password reset for "editor@example.com"
 *
 */
When(/^(I |we )*ask for a password reset for "([^"]*)"$/, async function (pronounCase, account) {
  await open(this, '/user/password');
  const form = this.page.locator('form#user-pass, form.user-pass').first();
  await actOrExplain('find the reset password form at', '/user/password', () => form.waitFor({ state: 'visible', timeout: budget(this) }),
    'A signed-in account does not see this form: start with "Given I am an anonymous user".');
  await form.locator('input[name="name"]').fill(account);
  await form.locator('input[type="submit"]').first().click();
  await settle(this);
  // The site counts the requests: five for one account in six hours, fifty from
  // one address in an hour. A suite that runs often on one site reaches that
  // count, and the refusal says nothing about the form under test.
  const refused = (await messageTexts(this, 'error')).find((text) => /too many password reset attempts/i.test(text));
  if (refused) {
    throw friendly({
      message: `The site refused the password reset for "${account}": "${refused}"`,
      hint: 'This is the flood limit of the site, not a fault of the form: it allows five requests for one account in six hours and fifty from one address in an hour. On a test site raise "flood_user_limit" and "flood_ip_limit" of the "user.flood" configuration (the site build script of this pack does), or wait for the window to pass.',
    });
  }
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Assert a message of a type contains (or equals) a text, or that no message
 * of that type does. The types are the ones the site renders: status, info,
 * warning and error.
 *
 * Example #1: Then the status message should contain "has been created"
 * Example #2: Then the error message should be "Title field is required."
 * Example #3: And the warning message should contain "unsaved changes"
 * Example #4: Then the error message should not contain "password"
 * Example #5: And the status message should be "The changes have been saved."
 *
 */
Then(/^the (status|info|warning|error) message should( not)* (be|contain) "([^"]*)"$/, async function (type, notCase, mode, text) {
  const matches = (texts) => texts.some((value) => (mode === 'be' ? value === clean(text) : value.includes(clean(text))));
  const result = await poll(this, () => messageTexts(this, type), (texts) => (notCase ? !matches(texts) : matches(texts)));
  if (!result.ok) {
    const all = await messageTexts(this);
    throw friendly({
      message: notCase
        ? `Expected no ${type} message ${mode === 'be' ? 'equal to' : 'containing'} "${text}", but the page shows "${result.value.join('" / "')}".`
        : `Expected ${type === 'info' || type === 'error' ? 'an' : 'a'} ${type} message ${mode === 'be' ? 'equal to' : 'containing'} "${text}", but the ${type} messages are: ${result.value.length ? '"' + result.value.join('" / "') + '"' : '(none)'}${all.length !== result.value.length ? '; all messages: "' + all.join('" / "') + '"' : ''}.`,
      hint: 'Messages show once, on the page that follows the action (`div.messages`); a message of another type is reported with its own type.',
    });
  }
});

/**
 * Assert the page shows no message, or at least one message, of a type.
 *
 * Example #1: Then there should be no error messages
 * Example #2: Then there should be a status message
 * Example #3: And there should be an error message
 * Example #4: Then there should be no warning messages
 * Example #5: And there should be a warning message
 *
 */
Then(/^there should be (no|a|an) (status|info|warning|error) messages?$/, async function (quantity, type) {
  const none = quantity === 'no';
  const result = await poll(this, () => messageTexts(this, type), (texts) => (none ? texts.length === 0 : texts.length > 0));
  if (!result.ok) {
    throw friendly({
      message: none ? `Expected no ${type} message, but the page shows "${result.value.join('" / "')}".` : `Expected ${quantity} ${type} message, but the page shows none.`,
      hint: 'Messages show once, on the page that follows the action (`div.messages`).',
    });
  }
});

/**
 * Close the messages of a type with their "Dismiss" link and wait until they
 * are gone.
 *
 * Example #1: When I dismiss the status message
 * Example #2: When I dismiss the error messages
 * Example #3: And I dismiss the warning message
 * Example #4: When we dismiss the status messages
 * Example #5: And dismiss the info message
 *
 */
When(/^(I |we )*dismiss the (status|info|warning|error) messages?$/, async function (pronounCase, type) {
  const selector = messageSelector(type);
  const links = this.page.locator(`${selector} a.dismiss:visible`);
  await actOrExplain('find the "Dismiss" link of a message of type', type, () => links.first().waitFor({ state: 'visible', timeout: budget(this) }),
    'The page must show a message of this type; a message printed by a form itself has no "Dismiss" link.');
  // A dismissed message fades out; the next link is clicked once it is the first visible one.
  for (let guard = 0; guard < 20 && (await links.count()); guard++) {
    await links.first().click({ timeout: 2000 }).catch(() => {});
  }
  const left = await poll(this, () => messageTexts(this, type), (texts) => texts.length === 0);
  if (!left.ok) {
    throw friendly({ message: `The ${type} message is still on the page after its "Dismiss" link was clicked: "${left.value.join('" / "')}".`, hint: 'The "Dismiss" link needs JavaScript; check for a JavaScript error on the page.' });
  }
});

/**
 * Assert a field of a form is (or is not) marked as an error after a failed
 * submission: the control carries the `error` class.
 *
 * Example #1: Then the "Title" field should be marked as an error
 * Example #2: Then the "Body" field should not be marked as an error
 * Example #3: And the "Name" field should be marked as an error
 * Example #4: Then the "Menu link title" field should be marked as an error
 * Example #5: And the "Path" field should not be marked as an error
 *
 */
Then(/^the "([^"]*)" field should( not)* be marked as an error$/, async function (label, notCase) {
  const item = await formItem(this, label);
  const marked = await item.locator('input.error, select.error, textarea.error').count();
  if (notCase ? marked > 0 : marked === 0) {
    const flagged = await this.page.locator('.form-item:has(> input.error, > select.error, > .form-textarea-wrapper > textarea.error) > label').allInnerTexts().catch(() => []);
    throw friendly({
      message: notCase ? `Expected the "${label}" field not to be marked as an error, but it is.` : `Expected the "${label}" field to be marked as an error, but it is not. Fields marked: ${flagged.map(clean).join(', ') || '(none)'}.`,
      hint: 'A field is marked after the form is submitted and the server refuses its value; the browser stops an empty required field before that ("Given browser validation for the form ... is disabled").',
    });
  }
});

// ---------------------------------------------------------------------------
// Primary navigation
// ---------------------------------------------------------------------------

// The "Primary navigation" block of a layout: `.block-system-main-menu` with a
// `ul.menu`. The header block also prints the account links (`.header-menu`).
const PRIMARY = '.block-system-main-menu';
const PRIMARY_HINT = 'The primary navigation is the "Primary navigation" block of the layout (`.block-system-main-menu`); check the layout of the page has it and the link is enabled in the menu.';

/**
 * The links of the primary navigation with a text: the exact text first.
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<import('playwright').Locator>}
 */
async function primaryLink(world, name) {
  const exact = world.page.locator(`${PRIMARY} ul.menu a`).filter({ hasText: exactly(name) });
  const loose = world.page.locator(`${PRIMARY} ul.menu a`, { hasText: name });
  await loose.first().waitFor({ state: 'attached', timeout: budget(world) }).catch(() => {});
  return (await exact.count()) ? exact.first() : loose.first();
}

/**
 * Assert the primary navigation lists (or does not list) a link, by its text.
 *
 * Example #1: Then the primary navigation should list "Home"
 * Example #2: Then the primary navigation should list "About"
 * Example #3: And the primary navigation should not list "Dashboard"
 * Example #4: Then the primary navigation should contain "Visit the apiary"
 * Example #5: And the primary navigation should not contain "Log out"
 *
 */
Then(/^the primary navigation should( not)* (?:list|contain) "([^"]*)"$/, async function (notCase, name) {
  const link = this.page.locator(`${PRIMARY} ul.menu a`).filter({ hasText: exactly(name) });
  const result = await poll(this, () => link.count(), (count) => (notCase ? count === 0 : count > 0));
  if (!result.ok) {
    const links = await this.page.locator(`${PRIMARY} ul.menu a`).allInnerTexts().catch(() => []);
    throw friendly({
      message: notCase ? `Expected the primary navigation not to list "${name}", but it does.` : `Expected the primary navigation to list "${name}", but it lists: ${links.map(clean).join(', ') || '(no links; is the block on this page?)'}.`,
      hint: PRIMARY_HINT,
    });
  }
});

/**
 * Click a link of the primary navigation, by its text.
 *
 * Example #1: When I click "About" in the primary navigation
 * Example #2: When I click "Home" in the primary navigation
 * Example #3: When we click "Visit the apiary" in the primary navigation
 * Example #4: And I click "About" in the primary navigation
 * Example #5: When click "Home" in the primary navigation
 *
 */
When(/^(I |we )*click "([^"]*)" in the primary navigation$/, async function (pronounCase, name) {
  await actOrExplain('click the primary navigation link', name, async () => {
    const link = await primaryLink(this, name);
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, PRIMARY_HINT + ' On a narrow screen, open the navigation with "When I toggle the primary navigation" first.');
  await settle(this);
});

/**
 * Assert the primary navigation marks (or does not mark) a link as the current
 * page (`aria-current="page"`).
 *
 * Example #1: Then the primary navigation should mark "Home" as the current page
 * Example #2: Then the primary navigation should mark "About" as the current page
 * Example #3: And the primary navigation should not mark "Home" as the current page
 * Example #4: Then the primary navigation should mark "Visit the apiary" as the current page
 * Example #5: And the primary navigation should not mark "About" as the current page
 *
 */
Then(/^the primary navigation should( not)* mark "([^"]*)" as the current page$/, async function (notCase, name) {
  const current = this.page.locator(`${PRIMARY} ul.menu a[aria-current="page"]`);
  const result = await poll(this, async () => (await current.allInnerTexts()).map(clean), (texts) => (notCase ? !texts.includes(name) : texts.includes(name)));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the primary navigation not to mark "${name}" as the current page, but it does.` : `Expected the primary navigation to mark "${name}" as the current page, but it marks: ${result.value.join(', ') || '(no link)'}.`,
      hint: PRIMARY_HINT + ' The link of the page in the browser carries aria-current="page".',
    });
  }
});

/**
 * Open or close the primary navigation on a narrow screen with its "Menu"
 * toggle. Fails with a hint on a wide screen, where the toggle does not show.
 *
 * Example #1: When I toggle the primary navigation
 * Example #2: When we toggle the primary navigation
 * Example #3: And I toggle the primary navigation
 * Example #4: When I toggle the primary navigation menu
 * Example #5: And we toggle the primary navigation menu
 *
 */
When(/^(I |we )*toggle the primary navigation(?: menu)?$/, async function (pronounCase) {
  const toggle = this.page.locator(`${PRIMARY} label.menu-toggle-button`).first();
  await actOrExplain('toggle', 'the primary navigation', async () => {
    await toggle.waitFor({ state: 'visible', timeout: budget(this) });
    await toggle.click();
  }, 'The "Menu" toggle shows only on a narrow screen: set the viewport first ("Given I am viewing the site on a "xs" device"), and check the menu block uses the "Dropdown" style with the toggle.');
  await settle(this);
});

/**
 * Assert the links of the primary navigation are (or are not) open to the
 * visitor: visible on the screen, not folded behind the toggle.
 *
 * Example #1: Then the primary navigation should be open
 * Example #2: Then the primary navigation should not be open
 * Example #3: And the primary navigation should be open
 * Example #4: Then the primary navigation links should be open
 * Example #5: And the primary navigation links should not be open
 *
 */
Then(/^the primary navigation(?: links)? should( not)* be open$/, async function (notCase) {
  await assertPresence(this.page.locator(`${PRIMARY} ul.menu a`), notCase, {
    label: 'the links of the primary navigation', hint: PRIMARY_HINT + ' On a narrow screen the links fold behind the "Menu" toggle.', timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Breadcrumb, heading, tabs, action links
// ---------------------------------------------------------------------------

/**
 * Assert the breadcrumb trail equals (or does not equal) a "Home > Section"
 * path. The breadcrumb is the `nav.breadcrumb` of the "Breadcrumb" block.
 *
 * Example #1: Then the breadcrumb trail should be "Home"
 * Example #2: Then the breadcrumb trail should be "Home > Administration > Structure"
 * Example #3: And the breadcrumb trail should not be "Home > Administration"
 * Example #4: Then the breadcrumb trail should be "Home > Administration > Structure > Menus"
 * Example #5: And the breadcrumb trail should be "Home > Administration > Content"
 *
 */
Then(/^the breadcrumb trail should( not)* be "([^"]*)"$/, async function (notCase, expectedPath) {
  const expected = expectedPath.split('>').map((part) => part.trim()).join(' > ');
  const items = this.page.locator('nav.breadcrumb li');
  const result = await poll(this, async () => (await items.allInnerTexts()).map(clean).filter(Boolean).join(' > '), (trail) => (notCase ? trail !== expected : trail === expected));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the breadcrumb trail not to be "${expected}", but it is.` : `Expected the breadcrumb trail "${expected}", but the page shows "${result.value || '(no breadcrumb)'}".`,
      hint: 'The breadcrumb is the "Breadcrumb" block of the layout (`nav.breadcrumb`); the home page has none.',
    });
  }
});

/**
 * Assert the heading of the page (the `h1.page-title` of the "Page title"
 * block) equals (or does not equal) a text.
 *
 * Example #1: Then the page heading should be "Field note 12"
 * Example #2: Then the page heading should be "Access denied"
 * Example #3: And the page heading should not be "Page not found"
 * Example #4: Then the page heading should be "Layouts"
 * Example #5: And the page heading should be "Create Post"
 *
 */
Then(/^the page heading should( not)* be "([^"]*)"$/, async function (notCase, text) {
  const headings = this.page.locator('h1.page-title, h1.user-simplified-page-title, h1');
  const result = await poll(this, async () => (await headings.allInnerTexts()).map(clean).filter(Boolean), (texts) => (notCase ? !texts.includes(clean(text)) : texts.includes(clean(text))));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the page heading not to be "${text}", but it is.` : `Expected the page heading "${text}", but the page shows "${result.value.join('" / "') || '(no heading)'}" at ${this.page.url()}.`,
      hint: 'The heading is the `h1.page-title` of the "Page title" block; the home page layout has none.',
    });
  }
});

/**
 * Assert the page offers (or does not offer) a page tab: the local tasks of the
 * page, such as "View" and "Edit" on a content page.
 *
 * Example #1: Then I should see the "Edit" page tab
 * Example #2: Then I should not see the "Edit" page tab
 * Example #3: And I should see the "View" page tab
 * Example #4: Then we should see the "Manage blocks" page tab
 * Example #5: And should not see the "Configure layout" page tab
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" page tab$/, async function (pronounCase, notCase, name) {
  const tab = this.page.locator('ul.tabs a').filter({ hasText: new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\(active tab\\))?\\s*$', 'i') });
  const result = await poll(this, () => tab.count(), (count) => (notCase ? count === 0 : count > 0));
  if (!result.ok) {
    const tabs = await this.page.locator('ul.tabs a').evaluateAll((els) => els.map((el) => (el.textContent || '').replace(/\(active tab\)/, '').replace(/\s+/g, ' ').trim()));
    throw friendly({
      message: notCase ? `Expected no "${name}" page tab, but the page offers it.` : `Expected a "${name}" page tab, but the page offers: ${tabs.join(', ') || '(no tabs)'}.`,
      hint: 'Page tabs are the local tasks of the page (`ul.tabs`); they depend on the permissions of the account.',
    });
  }
});

/**
 * Open a page tab (a local task such as "Edit"), by its text.
 *
 * Example #1: When I open the "Edit" page tab
 * Example #2: When I open the "View" page tab
 * Example #3: When we open the "Configure layout" page tab
 * Example #4: And I open the "Export" page tab
 * Example #5: When open the "Single import/export" page tab
 *
 */
When(/^(I |we )*open the "([^"]*)" page tab$/, async function (pronounCase, name) {
  const tab = this.page.locator('ul.tabs a').filter({ hasText: new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\(active tab\\))?\\s*$', 'i') }).first();
  await actOrExplain('open the page tab', name, async () => {
    await tab.waitFor({ state: 'visible', timeout: budget(this) });
    await tab.click();
  }, 'Page tabs are the local tasks of the page (`ul.tabs`); they depend on the permissions of the account.');
  await settle(this);
});

/**
 * Follow an action link of the page: the links above a listing, such as
 * "Add content", "Add term" or "Add link".
 *
 * Example #1: When I follow the "Add content" action link
 * Example #2: When I follow the "Add term" action link
 * Example #3: When we follow the "Add link" action link
 * Example #4: And I follow the "Add layout" action link
 * Example #5: When follow the "Add role" action link
 *
 */
When(/^(I |we )*follow the "([^"]*)" action link$/, async function (pronounCase, name) {
  const link = this.page.locator('ul.action-links a').filter({ hasText: exactly(name) }).first();
  const result = await poll(this, () => link.count(), (count) => count > 0);
  if (!result.ok) {
    const links = await this.page.locator('ul.action-links a').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The page has no "${name}" action link. It has: ${links.map(clean).join(', ') || '(none)'}.`,
      hint: 'Action links sit above a listing (`ul.action-links`); they depend on the permissions of the account.',
    });
  }
  await link.click();
  await settle(this);
});

// ---------------------------------------------------------------------------
// Pager
// ---------------------------------------------------------------------------

const PAGER_HINT = 'The pager (`ul.pager`) shows under a listing with more items than one page holds.';

/**
 * Assert the page shows (or does not show) a pager.
 *
 * Example #1: Then I should see a pager
 * Example #2: Then I should not see a pager
 * Example #3: And we should see a pager
 * Example #4: Then we should not see a pager
 * Example #5: And I should see the pager
 *
 */
Then(/^(I |we )*should( not)* see (?:a|the) pager$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('ul.pager'), notCase, { label: 'a pager', hint: PAGER_HINT, timeout: budget(this) });
});

/**
 * Follow a link of the pager: the next, previous, first or last page, or a
 * page by its number.
 *
 * Example #1: When I go to the next page of the pager
 * Example #2: When I go to the previous page of the pager
 * Example #3: When we go to the last page of the pager
 * Example #4: And I go to the first page of the pager
 * Example #5: When I go to page 2 of the pager
 *
 */
When(/^(I |we )*go to (?:the (next|previous|first|last) page|page (\d+)) of the pager$/, async function (pronounCase, named, number) {
  const pager = this.page.locator('ul.pager').first();
  await actOrExplain('find', 'the pager', () => pager.waitFor({ state: 'visible', timeout: budget(this) }), PAGER_HINT);
  const link = supplied(named)
    ? pager.locator(`li.pager-${named} a`).first()
    : pager.locator('li.pager-item a').filter({ hasText: exactly(number) }).first();
  if (!(await link.count())) {
    const offered = (await pager.locator('li').allInnerTexts()).map(clean);
    throw friendly({
      message: `The pager has no ${supplied(named) ? '"' + named + '"' : 'page ' + number} link. It shows: ${offered.join(' ')}.`,
      hint: 'The first page has no "previous" and "first" links, the last page no "next" and "last" links; the current page is not a link.',
    });
  }
  await link.click();
  await settle(this);
});

/**
 * Assert the pager is (or is not) on a page, by its number.
 *
 * Example #1: Then the pager should be on page 1
 * Example #2: Then the pager should be on page 2
 * Example #3: And the pager should not be on page 1
 * Example #4: Then the pager should be on page 3
 * Example #5: And the pager should not be on page 2
 *
 */
Then(/^the pager should( not)* be on page (\d+)$/, async function (notCase, number) {
  const current = this.page.locator('ul.pager li.pager-current').first();
  const result = await poll(this, async () => ((await current.count()) ? clean(await current.innerText()) : null), (value) => (notCase ? value !== String(number) : value === String(number)));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the pager not to be on page ${number}, but it is.` : `Expected the pager on page ${number}, but ${result.value === null ? 'the page has no pager' : 'it is on page ' + result.value}.`,
      hint: PAGER_HINT,
    });
  }
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search the site: with the "Search form" block of the page when the page has
 * one, otherwise with the form of the search page (`/search`).
 *
 * Example #1: When I search the site for "apiary"
 * Example #2: When I search the site for "queen cells"
 * Example #3: When we search the site for "veil"
 * Example #4: And I search the site for "no-such-word"
 * Example #5: When search the site for "weekends"
 *
 */
When(/^(I |we )*search the site for "([^"]*)"$/, async function (pronounCase, keywords) {
  let form = this.page.locator('form.search-block-form:visible, form#search-block-form:visible').first();
  if (!(await form.count())) {
    await open(this, '/search');
    form = this.page.locator('form.search-form, form#search-form').first();
    await actOrExplain('find', 'the search form', () => form.waitFor({ state: 'visible', timeout: budget(this) }),
      'The search page needs the Search module and the "Use search" permission for the account of the session.');
  }
  await form.locator('input[type="search"], input[type="text"]').first().fill(keywords);
  await form.locator('input[type="submit"], button[type="submit"]').first().click();
  await settle(this);
});

/**
 * Assert the search results list (or do not list) a title.
 *
 * Example #1: Then the search results should list "Visit the apiary"
 * Example #2: Then the search results should list "Editor field note"
 * Example #3: And the search results should not list "Unpublished field note"
 * Example #4: Then the search results should list "Field note 12"
 * Example #5: And the search results should not list "Opening hours"
 *
 */
Then(/^the search results should( not)* list "([^"]*)"$/, async function (notCase, title) {
  const titles = this.page.locator('ol.search-results > li .title a');
  const result = await poll(this, async () => (await titles.allInnerTexts()).map(clean), (texts) => (notCase ? !texts.includes(clean(title)) : texts.includes(clean(title))));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the search results not to list "${title}", but they do.` : `Expected the search results to list "${title}", but they list: ${result.value.join(' | ') || '(no results)'}.`,
      hint: 'Search first ("When I search the site for ..."). New content is found after cron has indexed it; unpublished content is never listed.',
    });
  }
});

/**
 * Assert how many results the search page lists: an exact number, at least a
 * number, or none (the "Your search yielded no results" page).
 *
 * Example #1: Then the search should find 2 results
 * Example #2: Then the search should find at least 3 results
 * Example #3: And the search should find no results
 * Example #4: Then the search should find 1 result
 * Example #5: And the search should find at least 1 result
 *
 */
Then(/^the search should find (no|at least \d+|\d+) results?$/, async function (quantity) {
  const items = this.page.locator('ol.search-results > li');
  const wanted = quantity === 'no' ? 0 : parseInt(quantity.replace(/\D+/g, ''), 10);
  const atLeast = /^at least/.test(quantity);
  const result = await poll(this, () => items.count(), (count) => (atLeast ? count >= wanted : count === wanted));
  if (!result.ok) {
    throw friendly({
      message: `Expected the search to find ${quantity} result${wanted === 1 ? '' : 's'}, but the page lists ${result.value}.`,
      hint: 'The results are the items of `ol.search-results`; one page holds ten. Search first ("When I search the site for ...").',
    });
  }
  if (quantity === 'no') {
    await assertPresence(this.page.getByRole('heading', { name: 'Your search yielded no results' }), null, {
      label: 'the "Your search yielded no results" heading', hint: 'Search first ("When I search the site for ...").', timeout: budget(this),
    });
  }
});

// ---------------------------------------------------------------------------
// Content on the front end
// ---------------------------------------------------------------------------

/**
 * Assert a listing of the page shows (or does not show) the teaser of a piece
 * of content, by its title.
 *
 * Example #1: Then I should see the teaser "Field note 12"
 * Example #2: Then I should not see the teaser "Field note 01"
 * Example #3: And I should see the teaser "Editor field note"
 * Example #4: Then we should not see the teaser "Unpublished field note"
 * Example #5: And should see the teaser "Field note 03"
 *
 */
Then(/^(I |we )*should( not)* see the teaser "([^"]*)"$/, async function (pronounCase, notCase, title) {
  const teaser = this.page.locator('article.view-mode-teaser').filter({ has: this.page.locator('h2 a').filter({ hasText: exactly(title) }) });
  const result = await poll(this, () => teaser.count(), (count) => (notCase ? count === 0 : count > 0));
  if (!result.ok) {
    const titles = await this.page.locator('article.view-mode-teaser h2 a').allInnerTexts().catch(() => []);
    throw friendly({
      message: notCase ? `Expected no teaser "${title}", but the page shows it.` : `Expected the teaser "${title}", but the page shows the teasers: ${titles.map(clean).join(' | ') || '(none)'}.`,
      hint: 'A teaser is an `article.view-mode-teaser` with the title as a link; another page of the pager may hold it.',
    });
  }
});

/**
 * Open a piece of content from its teaser, through the "Read more" link when
 * the teaser has one and through its title otherwise.
 *
 * Example #1: When I open the teaser "Field note 12"
 * Example #2: When I open the teaser "Editor field note"
 * Example #3: When we open the teaser "Field note 03"
 * Example #4: And I open the teaser "Field note 11"
 * Example #5: When open the teaser "Field note 05"
 *
 */
When(/^(I |we )*open the teaser "([^"]*)"$/, async function (pronounCase, title) {
  const teaser = this.page.locator('article.view-mode-teaser').filter({ has: this.page.locator('h2 a').filter({ hasText: exactly(title) }) }).first();
  await actOrExplain('open the teaser', title, async () => {
    await teaser.waitFor({ state: 'visible', timeout: budget(this) });
    const readMore = teaser.locator('li.node-readmore a').first();
    await ((await readMore.count()) ? readMore : teaser.locator('h2 a').first()).click();
  }, 'The teaser must be on the current page (`article.view-mode-teaser`); another page of the pager may hold it.');
  await settle(this);
});

/**
 * Assert the content on the page is (or is not) published. Unpublished content
 * carries the `unpublished` class and an "is unpublished" notice.
 *
 * Example #1: Then the content on the page should be published
 * Example #2: Then the content on the page should be unpublished
 * Example #3: And the content on the page should not be published
 * Example #4: Then the content on the page should not be unpublished
 * Example #5: And the content on the page should be published
 *
 */
Then(/^the content on the page should( not)* be (published|unpublished)$/, async function (notCase, state) {
  const article = this.page.locator('article.node.view-mode-full').first();
  await actOrExplain('find', 'the content on the page', () => article.waitFor({ state: 'visible', timeout: budget(this) }),
    'Open the page of a piece of content first (`article.node.view-mode-full`).');
  const unpublished = await article.evaluate((el) => el.classList.contains('unpublished'));
  const wantUnpublished = (state === 'unpublished') !== Boolean(notCase);
  if (unpublished !== wantUnpublished) {
    throw friendly({
      message: `Expected the content on the page to be ${wantUnpublished ? 'unpublished' : 'published'}, but it is ${unpublished ? 'unpublished' : 'published'}.`,
      hint: 'The published state is set on the content form ("Publishing options"); scheduled content stays unpublished until cron publishes it.',
    });
  }
});

/**
 * Assert the content on the page is (or is not) tagged with a term: the tag
 * shows as a link in a term reference field.
 *
 * Example #1: Then the content on the page should be tagged "Hives"
 * Example #2: Then the content on the page should be tagged "Bees"
 * Example #3: And the content on the page should not be tagged "Honey"
 * Example #4: Then the content on the page should be tagged "Wax"
 * Example #5: And the content on the page should not be tagged "Hives"
 *
 */
Then(/^the content on the page should( not)* be tagged "([^"]*)"$/, async function (notCase, term) {
  const tags = this.page.locator('article.node .field-type-taxonomy-term-reference a');
  const result = await poll(this, async () => (await tags.allInnerTexts()).map(clean), (texts) => (notCase ? !texts.includes(clean(term)) : texts.includes(clean(term))));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the content not to be tagged "${term}", but it is.` : `Expected the content to be tagged "${term}", but its tags are: ${result.value.join(', ') || '(none)'}.`,
      hint: 'Tags show on the page of the content as links of the term reference field (`.field-type-taxonomy-term-reference`).',
    });
  }
});

/**
 * Assert the content on the page shows (or does not show) an image of an image
 * field, by its file name, and that the image loaded.
 *
 * Example #1: Then the content on the page should show the image "pixel.png"
 * Example #2: Then the content on the page should not show the image "pixel.png"
 * Example #3: And the content on the page should show the image "hive.jpg"
 * Example #4: Then the content on the page should not show the image "logo.svg"
 * Example #5: And the content on the page should show the image "frame.webp"
 *
 */
Then(/^the content on the page should( not)* show the image "([^"]*)"$/, async function (notCase, fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const images = this.page.locator('article.node .field-type-image img');
  const read = () => images.evaluateAll((els) => els.map((el) => ({ src: decodeURIComponent(el.currentSrc || el.src || ''), loaded: el.complete && el.naturalWidth > 0 })));
  // An upload of a name that is taken is renamed "name_0.ext".
  const isIt = (image) => new RegExp('/' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(_\\d+)?\\.[a-z0-9]+(\\?|$)', 'i').test(image.src);
  const result = await poll(this, read, (list) => (notCase ? !list.some(isIt) : list.some((image) => isIt(image) && image.loaded)));
  if (!result.ok) {
    const found = result.value.filter(isIt);
    throw friendly({
      message: notCase ? `Expected the content not to show the image "${fileName}", but it does.`
        : found.length ? `The content shows the image "${fileName}", but the image did not load (${found[0].src}).`
          : `Expected the content to show the image "${fileName}", but its image fields show: ${result.value.map((image) => image.src.split('/').pop()).join(', ') || '(no image)'}.`,
      hint: 'Images of an image field show inside `.field-type-image`; the file is served through an image style.',
    });
  }
});

// ---------------------------------------------------------------------------
// Blocks, layout template and theme of a page
// ---------------------------------------------------------------------------

/**
 * Assert the page shows (or does not show) a block with a title.
 *
 * Example #1: Then I should see the block titled "Search"
 * Example #2: Then I should not see the block titled "User login"
 * Example #3: And I should see the block titled "Create content"
 * Example #4: Then we should see the block titled "Content overview"
 * Example #5: And should not see the block titled "Syndicate"
 *
 */
Then(/^(I |we )*should( not)* see the block titled "([^"]*)"$/, async function (pronounCase, notCase, title) {
  const block = this.page.locator('.block').filter({ has: this.page.locator('.block-title').filter({ hasText: exactly(title) }) });
  const result = await poll(this, async () => (await block.count()) && (await block.first().isVisible()), (visible) => (notCase ? !visible : Boolean(visible)));
  if (!result.ok) {
    const titles = await this.page.locator('.block .block-title').allInnerTexts().catch(() => []);
    throw friendly({
      message: notCase ? `Expected no block titled "${title}", but the page shows it.` : `Expected a block titled "${title}", but the page shows the block titles: ${titles.map(clean).filter(Boolean).join(' | ') || '(none)'}.`,
      hint: 'Blocks are placed in the layout of the page (Structure > Layouts); a block can hide its title, and its visibility conditions decide who sees it.',
    });
  }
});

/**
 * Assert the page is (or is not) rendered with a layout template, by its
 * machine name (`boxton`, `moscone_flipped`) or its name ("Moscone Flipped").
 *
 * Example #1: Then the page should use the "Boxton" layout template
 * Example #2: Then the page should use the "Moscone Flipped" layout template
 * Example #3: And the page should not use the "Boxton" layout template
 * Example #4: Then the page should use the "sutro" layout template
 * Example #5: And the page should not use the "moscone_flipped" layout template
 *
 */
Then(/^the page should( not)* use the "([^"]*)" layout template$/, async function (notCase, template) {
  const wanted = clean(template).toLowerCase().replace(/[\s_]+/g, '-');
  const result = await poll(this, () => this.page.evaluate(() => {
    const el = document.querySelector('[class*="layout--"]');
    const name = el ? Array.from(el.classList).find((value) => value.indexOf('layout--') === 0) : null;
    return name ? name.replace('layout--', '') : null;
  }), (found) => (notCase ? found !== wanted : found === wanted));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the page not to use the "${template}" layout template, but it does.` : `Expected the page to use the "${template}" layout template, but it uses ${result.value ? '"' + result.value + '"' : 'no layout template (a page outside the layouts, such as the log in page)'}.`,
      hint: 'The template is chosen on the "Configure layout" tab of the layout that applies to the path; the wrapper of the page carries `layout--<template>`.',
    });
  }
});

/**
 * Assert the page is (or is not) rendered with a theme, by its machine name:
 * the theme the page itself reports in its JavaScript settings.
 *
 * Example #1: Then the page should use the "basis" theme
 * Example #2: Then the page should use the "seven" theme
 * Example #3: And the page should not use the "seven" theme
 * Example #4: Then the page should not use the "basis" theme
 * Example #5: And the page should use the "bartik" theme
 *
 */
Then(/^the page should( not)* use the "([^"]*)" theme$/, async function (notCase, theme) {
  const result = await poll(this, () => this.page.evaluate(() => {
    const settings = window.Backdrop && window.Backdrop.settings;
    return (settings && settings.ajaxPageState && settings.ajaxPageState.theme) || null;
  }), (found) => (notCase ? found !== theme : found === theme));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the page not to use the "${theme}" theme, but it does.` : `Expected the page to use the "${theme}" theme, but it uses ${result.value ? '"' + result.value + '"' : 'a theme the page does not report'}.`,
      hint: 'Use the machine name of the theme (Appearance lists the themes); administration pages use the administration theme when the account has the permission to view it.',
    });
  }
});

// ---------------------------------------------------------------------------
// Access denied, page not found
// ---------------------------------------------------------------------------

const ERROR_PAGES = { 'access denied': { heading: 'Access denied', status: 403 }, 'page not found': { heading: 'Page not found', status: 404 } };

/**
 * Assert the page is (or is not) the "Access denied" or the "Page not found"
 * page of the site: its heading and the HTTP status of its address for the
 * session of the browser (403 or 404).
 *
 * Example #1: Then the page should be an access denied page
 * Example #2: Then the page should be a page not found page
 * Example #3: And the page should not be an access denied page
 * Example #4: Then the page should not be a page not found page
 * Example #5: And the page should be an access denied page
 *
 */
Then(/^the page should( not)* be an? (access denied|page not found) page$/, async function (notCase, kind) {
  const { heading, status } = ERROR_PAGES[kind];
  const found = clean(await this.page.locator('h1').first().innerText({ timeout: budget(this) }).catch(() => ''));
  const code = await statusOf(this, this.page.url());
  const is = found === heading && code === status;
  if (notCase ? is : !is) {
    throw friendly({
      message: notCase ? `Expected ${this.page.url()} not to be the "${heading}" page, but it is (HTTP ${code}).` : `Expected the "${heading}" page (HTTP ${status}), but ${this.page.url()} has the heading "${found || '(none)'}" and answers HTTP ${code}.`,
      hint: 'The site can serve a custom page for 403 and 404 (Configuration > System > Site information): the heading then differs.',
    });
  }
});

/**
 * Assert the account of the session has (or does not have) access to a path:
 * the path is asked for with the cookies of the browser and must not (or must)
 * answer "Access denied" (HTTP 403). The current page stays where it is.
 *
 * Example #1: Then I should have access to "admin/content"
 * Example #2: Then I should not have access to "admin/structure/layouts"
 * Example #3: And I should not have access to "admin/people"
 * Example #4: Then we should have access to "node/add/post"
 * Example #5: And should not have access to "admin/config"
 *
 */
Then(/^(I |we )*should( not)* have access to "([^"]*)"$/, async function (pronounCase, notCase, path) {
  const code = await statusOf(this, path);
  if (code === 404) {
    throw friendly({ message: `"${path}" answers HTTP 404: the path does not exist, so it says nothing about access.`, hint: 'Check the path; use it without the site address ("admin/content").' });
  }
  const denied = code === 403;
  if (notCase ? !denied : denied) {
    throw friendly({
      message: notCase ? `Expected "${path}" to be denied (HTTP 403), but it answers HTTP ${code}.` : `Expected access to "${path}", but it answers HTTP 403 (Access denied).`,
      hint: 'Access follows the permissions of the roles of the account (Configuration > User accounts > Permissions); the session is the one of "Given I am logged in as ...".',
    });
  }
});

/**
 * Open the account page of the session (`/user`).
 *
 * Example #1: When I open my account page
 * Example #2: When we open our account page
 * Example #3: And I open my account page
 * Example #4: When I open my account
 * Example #5: And we open our account
 *
 */
When(/^(I |we )*open (?:my|our) account(?: page)?$/, async function (pronounCase) {
  await open(this, '/user');
  if (!(await isLoggedIn(this))) {
    throw friendly({ message: 'There is no account page to open: nobody is logged in.', hint: 'Add "Given I am logged in as "member"" before this step.' });
  }
});
