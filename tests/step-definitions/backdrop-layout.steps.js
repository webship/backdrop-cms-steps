'use strict';

// Layout step definitions: the layout editor ("Manage blocks" of a layout),
// its regions and blocks (add, configure, move, disable, remove), the block
// list and its search, visibility conditions, saving or cancelling the changes
// of a layout, and what the list of layouts says about a layout (its path, its
// template, its conditions).
//
// The editor keeps the changes of a layout aside until "Save layout": a
// scenario that only looks ends with "When I cancel the layout changes", a
// scenario that saves puts the layout back before it ends.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  supplied,
  exactly,
  escapeRegExp,
  clean,
  settle,
  actOrExplain,
  poll,
  messageTexts,
  openAdminPage,
  rowNamed,
  clickRowOperation,
  dialog,
  waitForDialog,
  pressDialogButton,
} = require('./backdrop-helpers');

const EDITOR = '#layout-edit-main';
const EDITOR_HINT = 'Open the layout editor first ("Given I am editing the "Default Layout" layout"); it needs the "Administer layouts" permission.';

/**
 * Wait for the layout editor; fail with a hint when the page has none.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function layoutEditor(world) {
  const editor = world.page.locator(EDITOR).first();
  await actOrExplain('find', 'the layout editor', () => editor.waitFor({ state: 'visible', timeout: budget(world) }), EDITOR_HINT);
  return editor;
}

/**
 * A region of the layout editor, by its label ("Sidebar") or its machine name
 * ("sidebar"); fails with the regions the template has.
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<import('playwright').Locator>}
 */
async function region(world, name) {
  const editor = await layoutEditor(world);
  const byLabel = editor.locator('.layout-editor-region').filter({ has: world.page.locator('.layout-editor-region-title h2.label').filter({ hasText: exactly(name) }) });
  const byName = editor.locator(`.layout-editor-region[data-region-name="${clean(name).toLowerCase().replace(/\s+/g, '_')}"]`);
  if (await byLabel.count()) return byLabel.first();
  if (await byName.count()) return byName.first();
  const labels = await editor.locator('.layout-editor-region-title h2.label').allTextContents();
  throw friendly({
    message: `The layout has no "${name}" region. Its regions are: ${labels.map(clean).join(', ')}.`,
    hint: 'The regions come from the layout template (the "Configure layout" tab); use the label the editor shows.',
  });
}

/**
 * The titles of the blocks of a region, in order.
 *
 * @param {import('playwright').Locator} area
 * @returns {Promise<string[]>}
 */
async function blockTitles(area) {
  // A disabled block reads "<title> (Disabled)": the title is the name without the mark.
  return (await area.locator('.layout-editor-block .layout-editor-block-title .text').allTextContents()).map((text) => clean(text).replace(/ \(Disabled\)$/, ''));
}

/**
 * A block of a region of the layout editor, by the title the editor shows;
 * waits for it and fails with the blocks of the region.
 *
 * @param {object} world
 * @param {string} title
 * @param {string} regionName
 * @returns {Promise<import('playwright').Locator>}
 */
async function block(world, title, regionName) {
  const area = await region(world, regionName);
  const found = area.locator('.layout-editor-block').filter({ has: world.page.locator('.layout-editor-block-title .text').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(title) + '( \\(Disabled\\))?\\s*$') }) });
  const result = await poll(world, () => found.count(), (count) => count > 0);
  if (!result.ok) {
    throw friendly({
      message: `The "${regionName}" region has no "${title}" block. Its blocks are: ${(await blockTitles(area)).join(', ') || '(none)'}.`,
      hint: 'Use the title the editor shows for the block (its admin label, or the name of the block).',
    });
  }
  return found.first();
}

/**
 * Click an entry of the drop button of a block or a region of the editor.
 *
 * @param {object} world
 * @param {import('playwright').Locator} holder - The block title or the region title.
 * @param {string} name
 */
async function clickEditorButton(world, holder, name) {
  const link = holder.locator('.dropbutton a').filter({ hasText: exactly(name) }).first();
  if (!(await link.count())) {
    const offered = await holder.locator('.dropbutton a').allTextContents();
    throw friendly({ message: `There is no "${name}" entry. The drop button offers: ${offered.map(clean).join(', ')}.`, hint: 'A disabled block offers "Enable" instead of "Disable".' });
  }
  if (!(await link.isVisible())) {
    await holder.locator('.dropbutton-toggle button').first().click();
    await link.waitFor({ state: 'visible', timeout: budget(world) });
  }
  await link.click();
  await settle(world);
}

/**
 * Wait until no dialog is open.
 *
 * @param {object} world
 * @param {string} after
 */
async function dialogGone(world, after) {
  const result = await poll(world, () => world.page.locator('.ui-dialog:visible').count(), (count) => count === 0);
  if (!result.ok) {
    const errors = await dialog(world).locator('.messages.error').allInnerTexts().catch(() => []);
    throw friendly({ message: `The dialog stayed open after ${after}${errors.length ? ': it shows "' + errors.map(clean).join('" / "') + '"' : ''}.`, hint: 'A dialog stays open when a required field of its form is empty.' });
  }
  await settle(world);
}

// ---------------------------------------------------------------------------
// Opening, saving and cancelling
// ---------------------------------------------------------------------------

/**
 * Open the layout editor of a layout, by the name the list of layouts shows
 * ("Default Layout", "Home page", "Dashboard").
 *
 * @param {object} world
 * @param {string} name
 */
async function openLayout(world, name) {
  await openAdminPage(world, 'layouts');
  const row = await rowNamed(world, name, { what: 'layout' });
  await clickRowOperation(world, row, 'Manage blocks', name);
  await layoutEditor(world);
}

/**
 * Open the layout editor ("Manage blocks") of a layout, by the name the list
 * of layouts shows.
 *
 * Example #1: Given I am editing the "Default Layout" layout
 * Example #2: Given I am editing the "Home page" layout
 * Example #3: Given we are editing the "Dashboard" layout
 * Example #4: And I am editing the "Default Administrative Layout" layout
 * Example #5: Given editing the "Home page" layout
 *
 */
Given(/^(I am |we are )*editing the "([^"]*)" layout$/, async function (pronounCase, name) {
  await openLayout(this, name);
});

/**
 * Make sure a layout has no unsaved changes left in its editor by an earlier
 * scenario: when the editor reports unsaved changes, they are cancelled. For
 * the start of a scenario that edits a layout, so it can run again after a
 * failed run.
 *
 * Example #1: Given the "Default Layout" layout has no unsaved changes
 * Example #2: Given the "Home page" layout has no unsaved changes
 * Example #3: And the "Dashboard" layout has no unsaved changes
 * Example #4: Given the "Default Administrative Layout" layout has no unsaved changes
 * Example #5: And the "Home page" layout has no unsaved changes
 *
 */
Given(/^the "([^"]*)" layout has no unsaved changes$/, async function (name) {
  await openLayout(this, name);
  if ((await messageTexts(this, 'warning')).some((text) => /unsaved changes/.test(text))) {
    await this.page.locator('form#layout-content-form .form-actions input[type="submit"][value="Cancel"]').first().click();
    await settle(this);
  }
});

/**
 * Save the changes of the layout in the editor with "Save layout" and wait for
 * the confirmation: the changes then apply to the site.
 *
 * Example #1: When I save the layout changes
 * Example #2: When we save the layout changes
 * Example #3: And I save the layout changes
 * Example #4: When I save the changes of the layout
 * Example #5: And we save the changes of the layout
 *
 */
When(/^(I |we )*save the (?:layout changes|changes of the layout)$/, async function (pronounCase) {
  await layoutEditor(this);
  await this.page.locator('form#layout-content-form .form-actions input[type="submit"][value="Save layout"]').first().click();
  await settle(this);
  const outcome = await poll(this, async () => ({ status: await messageTexts(this, 'status'), errors: await messageTexts(this, 'error') }), (value) => value.errors.length > 0 || value.status.some((text) => /Layout content saved/.test(text)));
  if (!outcome.ok || outcome.value.errors.length) {
    throw friendly({ message: `The layout was not saved: ${outcome.value && outcome.value.errors.length ? 'the site answered "' + outcome.value.errors.join('" / "') + '"' : 'the page showed no "Layout content saved." confirmation'}.`, hint: 'A layout needs its "Main page content" block; check the messages of the editor.' });
  }
});

/**
 * Drop the changes of the layout in the editor with "Cancel": the layout stays
 * as it was last saved.
 *
 * Example #1: When I cancel the layout changes
 * Example #2: When we cancel the layout changes
 * Example #3: And I cancel the layout changes
 * Example #4: When I cancel the changes of the layout
 * Example #5: And we cancel the changes of the layout
 *
 */
When(/^(I |we )*cancel the (?:layout changes|changes of the layout)$/, async function (pronounCase) {
  await layoutEditor(this);
  await this.page.locator('form#layout-content-form .form-actions input[type="submit"][value="Cancel"]').first().click();
  await settle(this);
  if (await this.page.locator(EDITOR).count()) {
    throw friendly({ message: 'The layout editor is still open after "Cancel".', hint: '"Cancel" returns to the list of layouts; check for an error message.' });
  }
});

/**
 * Assert the layout editor reports (or does not report) unsaved changes: the
 * warning it shows from the first change until "Save layout" or "Cancel".
 *
 * Example #1: Then the layout should have unsaved changes
 * Example #2: Then the layout should not have unsaved changes
 * Example #3: And the layout should have unsaved changes
 * Example #4: Then the layout editor should have unsaved changes
 * Example #5: And the layout editor should not have unsaved changes
 *
 */
Then(/^the layout(?: editor)? should( not)* have unsaved changes$/, async function (notCase) {
  await layoutEditor(this);
  const result = await poll(this, () => messageTexts(this, 'warning'), (texts) => (notCase ? !texts.some((text) => /unsaved changes/.test(text)) : texts.some((text) => /unsaved changes/.test(text))));
  if (!result.ok) {
    throw friendly({ message: notCase ? 'Expected the layout to have no unsaved changes, but the editor warns "This form has unsaved changes."' : 'Expected the layout to have unsaved changes, but the editor shows no such warning.', hint: 'The warning shows after a block is added, moved, configured, disabled or removed, until the layout is saved or cancelled.' });
  }
});

// ---------------------------------------------------------------------------
// Regions and blocks
// ---------------------------------------------------------------------------

/**
 * Assert the layout in the editor has (or does not have) a region, by its
 * label.
 *
 * Example #1: Then the layout should have the "Sidebar" region
 * Example #2: Then the layout should have the "Header" region
 * Example #3: And the layout should not have the "Sidebar" region
 * Example #4: Then the layout should have the "Footer" region
 * Example #5: And the layout should not have the "Drawer" region
 *
 */
Then(/^the layout should( not)* have the "([^"]*)" region$/, async function (notCase, name) {
  const editor = await layoutEditor(this);
  const labels = (await editor.locator('.layout-editor-region-title h2.label').allTextContents()).map(clean);
  const has = labels.some((label) => label.toLowerCase() === clean(name).toLowerCase());
  if (notCase ? has : !has) {
    throw friendly({ message: notCase ? `Expected the layout not to have the "${name}" region, but it has it.` : `Expected the layout to have the "${name}" region, but its regions are: ${labels.join(', ')}.`, hint: 'The regions come from the layout template (the "Configure layout" tab).' });
  }
});

/**
 * Open the list of blocks that can be added to a region of the layout: the
 * "Add block" dialog of the region.
 *
 * Example #1: When I open the block list of the "Sidebar" region
 * Example #2: When I open the block list of the "Footer" region
 * Example #3: When we open the block list of the "Header" region
 * Example #4: And I open the block list of the "Content" region
 * Example #5: When open the block list of the "Top" region
 *
 */
When(/^(I |we )*open the block list of the "([^"]*)" region$/, async function (pronounCase, regionName) {
  const area = await region(this, regionName);
  await clickEditorButton(this, area.locator('.layout-editor-region-title').first(), 'Add block');
  const box = await waitForDialog(this, `"Add block" of the "${regionName}" region`);
  await actOrExplain('find', 'the list of blocks', () => box.locator('.layout-block-list').first().waitFor({ state: 'visible', timeout: budget(this) }), 'The dialog lists the blocks of the site.');
});

/**
 * Type into the search field of the block list, to narrow the blocks it shows.
 *
 * Example #1: When I search the block list for "Search"
 * Example #2: When I search the block list for "menu"
 * Example #3: When we search the block list for "Syndicate"
 * Example #4: And I search the block list for "login"
 * Example #5: When search the block list for "content"
 *
 */
When(/^(I |we )*search the block list for "([^"]*)"$/, async function (pronounCase, text) {
  const input = dialog(this).locator('#layout-block-list-search, input.layout-block-list-search-processed').first();
  await actOrExplain('find', 'the search field of the block list', () => input.waitFor({ state: 'visible', timeout: budget(this) }), 'Open the block list first ("When I open the block list of the "Sidebar" region").');
  await input.fill('');
  await input.pressSequentially(text, { delay: 30 });
});

/**
 * Assert the block list offers (or does not offer) a block, by its name: the
 * blocks the list shows, after its search narrowed them.
 *
 * Example #1: Then the block list should offer "Search form"
 * Example #2: Then the block list should offer "Syndicate"
 * Example #3: And the block list should not offer "User login"
 * Example #4: Then the block list should offer "Primary navigation"
 * Example #5: And the block list should not offer "Syndicate"
 *
 */
Then(/^the block list should( not)* offer "([^"]*)"$/, async function (notCase, name) {
  const items = dialog(this).locator('.layout-block-add-row:visible a.block-item');
  const result = await poll(this, async () => (await items.allTextContents()).map(clean), (names) => (notCase ? !names.includes(clean(name)) : names.includes(clean(name))));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the block list not to offer "${name}", but it does.` : `Expected the block list to offer "${name}", but it offers: ${(result.value || []).slice(0, 40).join(' | ') || '(nothing; is the block list open?)'}.`, hint: 'Open the block list first; its search hides the blocks that do not match.' });
  }
});

/**
 * Choose a block from the open block list, by its name: its configuration
 * form opens in the dialog, where the block is added with "Add block".
 *
 * Example #1: When I choose "Syndicate" from the block list
 * Example #2: When I choose "Search form" from the block list
 * Example #3: When we choose "User login" from the block list
 * Example #4: And I choose "Custom block" from the block list
 * Example #5: When choose "Primary navigation" from the block list
 *
 */
When(/^(I |we )*choose "([^"]*)" from the block list$/, async function (pronounCase, name) {
  const item = dialog(this).locator('.layout-block-add-row a.block-item').filter({ hasText: exactly(name) }).first();
  if (!(await item.count())) {
    const names = await dialog(this).locator('.layout-block-add-row a.block-item').allTextContents().catch(() => []);
    throw friendly({ message: `The block list has no "${name}" block. It lists: ${names.map(clean).slice(0, 40).join(' | ') || '(nothing; is the block list open?)'}.`, hint: 'Open the block list first ("When I open the block list of the "Sidebar" region"); use the name the list shows.' });
  }
  await item.click();
  await actOrExplain('open the configuration of the block', name, () => dialog(this).locator('form.layout-block-configure-form, form#layout-block-configure-form').first().waitFor({ state: 'visible', timeout: budget(this) }), 'The configuration form of the block replaces the list in the dialog.');
  await settle(this);
});

/**
 * Add a block to a region of the layout in one step: open the block list of
 * the region, choose the block and confirm with "Add block". With a title, the
 * block gets that custom title. The layout is not saved yet.
 *
 * Example #1: When I add the "Syndicate" block to the "Sidebar" region
 * Example #2: When I add the "Search form" block to the "Footer" region
 * Example #3: When we add the "User login" block to the "Sidebar" region
 * Example #4: And I add the "Syndicate" block to the "Footer" region with the title "Feeds"
 * Example #5: When add the "Recent comments" block to the "Sidebar" region with the title "Latest replies"
 *
 */
When(/^(I |we )*add the "([^"]*)" block to the "([^"]*)" region(?: with the title "([^"]*)")?$/, async function (pronounCase, name, regionName, title) {
  const area = await region(this, regionName);
  const before = (await blockTitles(area)).length;
  await clickEditorButton(this, area.locator('.layout-editor-region-title').first(), 'Add block');
  const box = await waitForDialog(this, `"Add block" of the "${regionName}" region`);
  const item = box.locator('.layout-block-add-row a.block-item').filter({ hasText: exactly(name) }).first();
  const listed = await poll(this, () => item.count(), (count) => count > 0);
  if (!listed.ok) {
    const names = await box.locator('.layout-block-add-row a.block-item').allTextContents().catch(() => []);
    throw friendly({ message: `The block list has no "${name}" block. It lists: ${names.map(clean).slice(0, 40).join(' | ')}.`, hint: 'Use the name the "Add block" dialog shows.' });
  }
  await item.click();
  const form = dialog(this).locator('form.layout-block-configure-form, form#layout-block-configure-form').first();
  await actOrExplain('open the configuration of the block', name, () => form.waitFor({ state: 'visible', timeout: budget(this) }), 'The configuration form of the block replaces the list in the dialog.');
  await settle(this);
  if (supplied(title)) {
    await form.locator('select[name="title_display"]').selectOption('custom');
    const field = form.locator('input[name="title"]');
    await field.waitFor({ state: 'visible', timeout: budget(this) });
    await field.fill(title);
  }
  await pressDialogButton(this, 'Add block');
  await dialogGone(this, `adding the "${name}" block`);
  const added = await poll(this, async () => (await blockTitles(area)).length, (count) => count > before);
  if (!added.ok) {
    throw friendly({ message: `The "${name}" block did not show in the "${regionName}" region after "Add block".`, hint: 'Check for an error message in the editor.' });
  }
});

/**
 * Open the configuration dialog of a block of a region of the layout.
 *
 * Example #1: When I configure the "Syndicate" block of the "Sidebar" region
 * Example #2: When I configure the "Search form" block of the "Header" region
 * Example #3: When we configure the "Breadcrumb" block of the "Top" region
 * Example #4: And I configure the "Feeds" block of the "Footer" region
 * Example #5: When configure the "Header block" block of the "Header" region
 *
 */
When(/^(I |we )*configure the "([^"]*)" block of the "([^"]*)" region$/, async function (pronounCase, title, regionName) {
  const item = await block(this, title, regionName);
  await clickEditorButton(this, item.locator('.layout-editor-block-title').first(), 'Configure');
  const box = await waitForDialog(this, `"Configure" of the "${title}" block`);
  await actOrExplain('open the configuration of the block', title, () => box.locator('form.layout-block-configure-form, form#layout-block-configure-form').first().waitFor({ state: 'visible', timeout: budget(this) }), 'The configuration form of the block opens in a dialog.');
});

/**
 * Remove a block from a region of the layout, with the "Remove" entry of its
 * drop button. The layout is not saved yet.
 *
 * Example #1: When I remove the "Syndicate" block from the "Sidebar" region
 * Example #2: When I remove the "Feeds" block from the "Footer" region
 * Example #3: When we remove the "User login" block from the "Sidebar" region
 * Example #4: And I remove the "Search form" block from the "Footer" region
 * Example #5: When remove the "Latest replies" block from the "Sidebar" region
 *
 */
When(/^(I |we )*remove the "([^"]*)" block from the "([^"]*)" region$/, async function (pronounCase, title, regionName) {
  const area = await region(this, regionName);
  const item = await block(this, title, regionName);
  const before = (await blockTitles(area)).filter((value) => value === clean(title)).length;
  await clickEditorButton(this, item.locator('.layout-editor-block-title').first(), 'Remove');
  const removed = await poll(this, async () => (await blockTitles(area)).filter((value) => value === clean(title)).length, (count) => count < before);
  if (!removed.ok) {
    throw friendly({ message: `The "${title}" block is still in the "${regionName}" region after "Remove".`, hint: 'The entry works by AJAX; check for a JavaScript error on the page.' });
  }
});

/**
 * Disable or enable a block of a region of the layout, with the entry of its
 * drop button. A disabled block stays in the layout but is not shown.
 *
 * Example #1: When I disable the "Syndicate" block of the "Sidebar" region
 * Example #2: When I enable the "Syndicate" block of the "Sidebar" region
 * Example #3: When we disable the "Breadcrumb" block of the "Top" region
 * Example #4: And I enable the "Breadcrumb" block of the "Top" region
 * Example #5: When disable the "Feeds" block of the "Footer" region
 *
 */
When(/^(I |we )*(disable|enable) the "([^"]*)" block of the "([^"]*)" region$/, async function (pronounCase, action, title, regionName) {
  const item = await block(this, title, regionName);
  const id = await item.getAttribute('data-block-id');
  await clickEditorButton(this, item.locator('.layout-editor-block-title').first(), action === 'disable' ? 'Disable' : 'Enable');
  const fresh = this.page.locator(`.layout-editor-block[data-block-id="${id}"]`).first();
  const result = await poll(this, () => fresh.evaluate((el) => el.classList.contains('layout-editor-block-disabled')), (disabled) => disabled === (action === 'disable'));
  if (!result.ok) {
    throw friendly({ message: `The "${title}" block was not ${action}d.`, hint: 'The entry works by AJAX; check for a JavaScript error on the page.' });
  }
});

/**
 * Assert a block of a region of the layout is enabled or disabled in the
 * editor.
 *
 * Example #1: Then the "Syndicate" block of the "Sidebar" region should be disabled
 * Example #2: Then the "Syndicate" block of the "Sidebar" region should be enabled
 * Example #3: And the "Breadcrumb" block of the "Top" region should be enabled
 * Example #4: Then the "Feeds" block of the "Footer" region should be disabled
 * Example #5: And the "Search form" block of the "Header" region should be enabled
 *
 */
Then(/^the "([^"]*)" block of the "([^"]*)" region should be (enabled|disabled)$/, async function (title, regionName, state) {
  const item = await block(this, title, regionName);
  const disabled = await item.evaluate((el) => el.classList.contains('layout-editor-block-disabled'));
  if (disabled !== (state === 'disabled')) {
    throw friendly({ message: `Expected the "${title}" block of the "${regionName}" region to be ${state}, but it is ${disabled ? 'disabled' : 'enabled'}.`, hint: 'A block is disabled and enabled from its drop button in the editor.' });
  }
});

/**
 * Move a block to another region of the layout with the keyboard, the way the
 * editor supports it: the block is focused and the right or left arrow key
 * moves it one region at a time. The layout is not saved yet.
 *
 * Example #1: When I move the "Syndicate" block of the "Sidebar" region to the "Footer" region
 * Example #2: When I move the "Feeds" block of the "Footer" region to the "Sidebar" region
 * Example #3: When we move the "Search form" block of the "Header" region to the "Sidebar" region
 * Example #4: And I move the "User login" block of the "Sidebar" region to the "Bottom" region
 * Example #5: When move the "Syndicate" block of the "Footer" region to the "Top" region
 *
 */
When(/^(I |we )*move the "([^"]*)" block of the "([^"]*)" region to the "([^"]*)" region$/, async function (pronounCase, title, fromName, toName) {
  const editor = await layoutEditor(this);
  const item = await block(this, title, fromName);
  const target = await region(this, toName);
  const id = await item.getAttribute('data-block-id');
  const targetId = await target.getAttribute('id');
  const order = await editor.locator('.layout-editor-region').evaluateAll((els) => els.map((el) => el.id));
  const moving = this.page.locator(`.layout-editor-block[data-block-id="${id}"]`).first();
  const where = () => moving.evaluate((el) => el.closest('.layout-editor-region').id);
  for (let guard = 0; guard < order.length + 1; guard++) {
    const current = await where();
    if (current === targetId) break;
    await moving.focus();
    await this.page.keyboard.press(order.indexOf(targetId) > order.indexOf(current) ? 'ArrowRight' : 'ArrowLeft');
    await poll(this, where, (value) => value !== current);
  }
  if ((await where()) !== targetId) {
    throw friendly({ message: `The "${title}" block did not reach the "${toName}" region.`, hint: 'The editor moves a focused block with the arrow keys; check for a JavaScript error on the page.' });
  }
  await settle(this);
});

/**
 * Move a block up or down among the blocks of its region with the keyboard
 * (the up and down arrow keys of the editor). The layout is not saved yet.
 *
 * Example #1: When I move the "Syndicate" block of the "Sidebar" region up
 * Example #2: When I move the "Syndicate" block of the "Sidebar" region down
 * Example #3: When we move the "Search form" block of the "Header" region up
 * Example #4: And I move the "Breadcrumb" block of the "Top" region down
 * Example #5: When move the "Feeds" block of the "Footer" region up
 *
 */
When(/^(I |we )*move the "([^"]*)" block of the "([^"]*)" region (up|down)$/, async function (pronounCase, title, regionName, direction) {
  const area = await region(this, regionName);
  const item = await block(this, title, regionName);
  const before = await blockTitles(area);
  await item.focus();
  await this.page.keyboard.press(direction === 'up' ? 'ArrowUp' : 'ArrowDown');
  const result = await poll(this, () => blockTitles(area), (titles) => titles.join('|') !== before.join('|'));
  if (!result.ok) {
    throw friendly({ message: `The "${title}" block did not move ${direction} in the "${regionName}" region. The blocks are: ${before.join(', ')}.`, hint: `The ${direction === 'up' ? 'first' : 'last'} block of a region cannot move ${direction}.` });
  }
  await settle(this);
});

/**
 * Assert a region of the layout in the editor has (or does not have) a block,
 * by the title the editor shows.
 *
 * Example #1: Then the "Sidebar" region should have the "Syndicate" block
 * Example #2: Then the "Sidebar" region should not have the "Syndicate" block
 * Example #3: And the "Header" region should have the "Search form" block
 * Example #4: Then the "Footer" region should have the "Feeds" block
 * Example #5: And the "Content" region should have the "Main page content" block
 *
 */
Then(/^the "([^"]*)" region should( not)* have the "([^"]*)" block$/, async function (regionName, notCase, title) {
  const area = await region(this, regionName);
  const result = await poll(this, () => blockTitles(area), (titles) => (notCase ? !titles.includes(clean(title)) : titles.includes(clean(title))));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the "${regionName}" region not to have the "${title}" block, but it has it.` : `Expected the "${regionName}" region to have the "${title}" block, but its blocks are: ${result.value.join(', ') || '(none)'}.`, hint: 'The title is the one the editor shows for the block.' });
  }
});

/**
 * Assert how many blocks a region of the layout has in the editor.
 *
 * Example #1: Then the "Sidebar" region should have 0 blocks
 * Example #2: Then the "Sidebar" region should have 1 block
 * Example #3: And the "Header" region should have 3 blocks
 * Example #4: Then the "Top" region should have 2 blocks
 * Example #5: And the "Footer" region should have 1 block
 *
 */
Then(/^the "([^"]*)" region should have (\d+) blocks?$/, async function (regionName, number) {
  const area = await region(this, regionName);
  const result = await poll(this, () => blockTitles(area), (titles) => titles.length === parseInt(number, 10));
  if (!result.ok) {
    throw friendly({ message: `Expected the "${regionName}" region to have ${number} block(s), but it has ${result.value.length}: ${result.value.join(', ') || '(none)'}.`, hint: 'The count is the one of the editor, saved or not.' });
  }
});

/**
 * Assert a block of a region of the layout shows (or does not show) a
 * visibility condition in the editor: the "Conditions" list under the block
 * ("User has the role Editor"). The condition only needs to contain the text.
 *
 * Example #1: Then the "Syndicate" block of the "Sidebar" region should have a condition containing "Editor"
 * Example #2: Then the "Syndicate" block of the "Sidebar" region should not have a condition containing "Administrator"
 * Example #3: And the "Search form" block of the "Header" region should not have a condition containing "role"
 * Example #4: Then the "Syndicate" block of the "Footer" region should have a condition containing "User has the role Editor"
 * Example #5: And the "Primary navigation" block of the "Header" region should not have a condition containing "Home page"
 *
 */
Then(/^the "([^"]*)" block of the "([^"]*)" region should( not)* have a condition containing "([^"]*)"$/, async function (title, regionName, notCase, text) {
  const item = await block(this, title, regionName);
  const read = async () => (await item.locator('ul.block-conditions li').allTextContents()).map(clean);
  const result = await poll(this, read, (conditions) => (notCase ? !conditions.some((value) => value.includes(text)) : conditions.some((value) => value.includes(text))));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the "${title}" block of the "${regionName}" region to have no condition containing "${text}", but it has: ${result.value.join(' | ')}.`
        : `Expected the "${title}" block of the "${regionName}" region to have a condition containing "${text}", but its conditions are: ${result.value.join(' | ') || '(none)'}.`,
      hint: 'The editor lists the visibility conditions of a block under it ("Conditions"); they are set in the configuration dialog of the block ("Visibility conditions").',
    });
  }
});

/**
 * Assert the order of two blocks of a region of the layout in the editor.
 *
 * Example #1: Then the "Header block" block should come before the "Primary navigation" block in the "Header" region
 * Example #2: Then the "Breadcrumb" block should come before the "Page title combo" block in the "Top" region
 * Example #3: And the "Syndicate" block should come before the "Feeds" block in the "Sidebar" region
 * Example #4: Then the "Primary navigation" block should come before the "Search form" block in the "Header" region
 * Example #5: And the "Feeds" block should come before the "Syndicate" block in the "Footer" region
 *
 */
Then(/^the "([^"]*)" block should come before the "([^"]*)" block in the "([^"]*)" region$/, async function (first, second, regionName) {
  const area = await region(this, regionName);
  const result = await poll(this, () => blockTitles(area), (titles) => titles.indexOf(clean(first)) !== -1 && titles.indexOf(clean(second)) !== -1 && titles.indexOf(clean(first)) < titles.indexOf(clean(second)));
  if (!result.ok) {
    throw friendly({ message: `Expected "${first}" before "${second}" in the "${regionName}" region, but the blocks are: ${result.value.join(', ') || '(none)'}.`, hint: 'Blocks are moved by dragging, or with the arrow keys once a block is focused.' });
  }
});

// ---------------------------------------------------------------------------
// Visibility conditions
// ---------------------------------------------------------------------------

/**
 * Start a visibility condition for the block whose configuration dialog is
 * open: open "Visibility conditions", follow "Add condition" and choose the
 * kind of condition ("User account: Role", "URL path", "Home page"). The
 * settings of the condition then show in the dialog; fill them in and press
 * "Add condition" in the dialog.
 *
 * Example #1: When I start the visibility condition "User account: Role" in the dialog
 * Example #2: When I start the visibility condition "URL path" in the dialog
 * Example #3: When we start the visibility condition "Home page" in the dialog
 * Example #4: And I start the visibility condition "User account: Permission" in the dialog
 * Example #5: When start the visibility condition "Site language" in the dialog
 *
 */
When(/^(I |we )*start the visibility condition "([^"]*)" in the dialog$/, async function (pronounCase, kind) {
  const box = dialog(this);
  const fieldset = box.locator('fieldset#block-access, fieldset').filter({ has: this.page.locator('a.layout-access-add') }).first();
  if (!(await box.count()) || !(await fieldset.count())) {
    throw friendly({ message: 'There is no block configuration dialog with visibility conditions open.', hint: 'Open one first ("When I configure the "..." block of the "..." region", or choose a block from the block list).' });
  }
  if (await fieldset.evaluate((el) => el.classList.contains('collapsed'))) {
    await fieldset.locator(':scope > legend a.fieldset-title').first().click();
  }
  const add = fieldset.locator('a.layout-access-add').first();
  await add.waitFor({ state: 'visible', timeout: budget(this) });
  await add.click();
  const select = dialog(this).locator('form.layout-condition-add-form select[name="condition"], form#layout-condition-add-form select[name="condition"]').first();
  await actOrExplain('open', 'the "Add condition" form', () => select.waitFor({ state: 'visible', timeout: budget(this) }), 'The form replaces the block configuration in the dialog.');
  const options = (await select.locator('option').allTextContents()).map(clean);
  if (!options.includes(clean(kind))) {
    throw friendly({ message: `There is no visibility condition "${kind}". The conditions are: ${options.slice(1).join(', ')}.`, hint: 'Use the text of the condition as the select shows it.' });
  }
  await select.selectOption({ label: (await select.locator('option').allTextContents())[options.indexOf(clean(kind))] });
  await settle(this);
});

/**
 * Assert the block configuration dialog lists (or does not list) a visibility
 * condition, by a text of its summary ("Editor", "is one of").
 *
 * Example #1: Then the dialog should list a visibility condition containing "Editor"
 * Example #2: Then the dialog should list a visibility condition containing "Home page"
 * Example #3: And the dialog should not list a visibility condition containing "Administrator"
 * Example #4: Then the dialog should list a visibility condition containing "role"
 * Example #5: And the dialog should not list a visibility condition containing "URL path"
 *
 */
Then(/^the dialog should( not)* list a visibility condition containing "([^"]*)"$/, async function (notCase, text) {
  const items = dialog(this).locator('.layout-access-list li');
  const result = await poll(this, async () => (await items.allTextContents()).map(clean), (texts) => (notCase ? !texts.some((value) => value.includes(text)) : texts.some((value) => value.includes(text))));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected no visibility condition containing "${text}", but the dialog lists: ${result.value.join(' | ')}.` : `Expected a visibility condition containing "${text}", but the dialog lists: ${(result.value || []).join(' | ') || '(none)'}.`, hint: 'The conditions of a block are listed under "Visibility conditions" of its configuration dialog.' });
  }
});

// ---------------------------------------------------------------------------
// The list of layouts
// ---------------------------------------------------------------------------

/**
 * Read a column of the row of a layout in the list of layouts.
 *
 * @param {object} world
 * @param {string} name
 * @param {string} cell - The class of the header of the column.
 * @returns {Promise<{row: import('playwright').Locator, text: string}>}
 */
async function layoutCell(world, name, cell) {
  if (!/\/admin\/structure\/layouts(\?|$)/.test(world.page.url())) await openAdminPage(world, 'layouts');
  const row = await rowNamed(world, name, { what: 'layout' });
  const index = await row.locator('xpath=ancestor::table[1]').locator('thead th').evaluateAll((ths, wanted) => ths.findIndex((th) => th.classList.contains(wanted)), cell);
  return { row, text: index === -1 ? '' : clean(await row.locator('td').nth(index).innerText()) };
}

/**
 * Assert the layout template the list of layouts shows for a layout.
 *
 * Example #1: Then the "Default Layout" layout should use the "Moscone Flipped" template
 * Example #2: Then the "Home page" layout should use the "Boxton" template
 * Example #3: And the "Dashboard" layout should use the "Sutro" template
 * Example #4: Then the "Default Administrative Layout" layout should use the "Boxton" template
 * Example #5: And the "Home page" layout should use the "Boxton" template
 *
 */
Then(/^the "([^"]*)" layout should use the "([^"]*)" template$/, async function (name, template) {
  const { text } = await layoutCell(this, name, 'layout-template');
  if (text.toLowerCase() !== clean(template).toLowerCase()) {
    throw friendly({ message: `Expected the "${name}" layout to use the "${template}" template, but the list of layouts shows "${text}".`, hint: 'The template is set on the "Configure layout" tab of the layout.' });
  }
});

/**
 * Assert the list of layouts shows (or does not show) a visibility condition
 * for a layout, by a text of the condition.
 *
 * Example #1: Then the "Dashboard" layout should have a condition containing "Access Dashboard"
 * Example #2: Then the "Home page" layout should not have a condition containing "role"
 * Example #3: And the "Default Layout" layout should not have a condition containing "permission"
 * Example #4: Then the "Dashboard" layout should have a condition containing "permission"
 * Example #5: And the "Home page" layout should not have a condition containing "Access Dashboard"
 *
 */
Then(/^the "([^"]*)" layout should( not)* have a condition containing "([^"]*)"$/, async function (name, notCase, text) {
  const found = (await layoutCell(this, name, 'layout-conditions')).text;
  const has = found.includes(text);
  if (notCase ? has : !has) {
    throw friendly({ message: notCase ? `Expected the "${name}" layout to have no condition containing "${text}", but the list of layouts shows "${found}".` : `Expected the "${name}" layout to have a condition containing "${text}", but the list of layouts shows "${found || '(no conditions)'}".`, hint: 'The conditions of a layout are set on its "Configure layout" tab.' });
  }
});

/**
 * Assert the list of layouts groups (or does not group) a layout under a
 * path: the path the layout applies to ("home", "admin/dashboard").
 *
 * Example #1: Then the "Home page" layout should apply to the path "home"
 * Example #2: Then the "Dashboard" layout should apply to the path "admin/dashboard"
 * Example #3: And the "Home page" layout should not apply to the path "node/%"
 * Example #4: Then the "Dashboard" layout should not apply to the path "home"
 * Example #5: And the "Home page" layout should apply to the path "home"
 *
 */
Then(/^the "([^"]*)" layout should( not)* apply to the path "([^"]*)"$/, async function (name, notCase, path) {
  if (!/\/admin\/structure\/layouts(\?|$)/.test(this.page.url())) await openAdminPage(this, 'layouts');
  const row = await rowNamed(this, name, { what: 'layout' });
  const group = clean(await row.evaluate((tr) => {
    let node = tr.previousElementSibling;
    while (node && !node.classList.contains('layout-group')) node = node.previousElementSibling;
    return node ? node.children[0].textContent : '';
  })).replace(/^Path:\s*/, '');
  const applies = group === clean(path);
  if (notCase ? applies : !applies) {
    throw friendly({ message: notCase ? `Expected the "${name}" layout not to apply to the path "${path}", but it does.` : `Expected the "${name}" layout to apply to the path "${path}", but the list of layouts groups it under "${group || '(no path: a default layout)'}".`, hint: 'The path of a layout is set on its "Configure layout" tab; the default layouts have no path.' });
  }
});
