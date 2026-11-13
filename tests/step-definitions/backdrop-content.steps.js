'use strict';

// Content step definitions: starting a piece of content of a type, the rich
// text editor of a formatted text field, the publishing options (publish,
// draft, schedule), vertical tabs and collapsible fieldsets, saving the content
// form, finding content by its title to view, edit or delete it, files in
// image and file fields and in the file listing, terms and vocabularies, and
// menu links.
//
// Content, terms, links and files a scenario creates are removed by the
// scenario: the "... does not exist" steps make a scenario rerunnable after a
// failed run.

const { Given, When, Then } = require('@cucumber/cucumber');
const path = require('path');
const fs = require('fs');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  exactly,
  escapeRegExp,
  clean,
  open,
  settle,
  actOrExplain,
  poll,
  messageTexts,
  requirePage,
  openAdminPage,
  rows,
  rowNamed,
  hasRow,
  rowNames,
  clickRowOperation,
  formItem,
  verticalTabs,
  verticalTab,
  editorItem,
  setEditor,
  getEditor,
} = require('./backdrop-helpers');

const FORM = 'form.node-form';
const FORM_HINT = 'Open a content form first ("When I start a new "Post"" or "When I edit the content "..."").';

/**
 * Wait for the content form; fail with a hint when the page has none.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function contentForm(world) {
  const form = world.page.locator(FORM).first();
  await actOrExplain('find', 'the content form', () => form.waitFor({ state: 'visible', timeout: budget(world) }), FORM_HINT);
  return form;
}

// ---------------------------------------------------------------------------
// Creating and saving
// ---------------------------------------------------------------------------

/**
 * Start a piece of content of a type, by the name of the type as the "Add
 * content" page lists it ("Post", "Page", "Card"): opens the page and follows
 * the type. Fails when the account may not create that type.
 *
 * Example #1: When I start a new "Post"
 * Example #2: When I start a new "Page"
 * Example #3: When we start a new "Card"
 * Example #4: And I start a new "Post"
 * Example #5: When start a new "Page"
 *
 */
When(/^(I |we )*start a new "([^"]*)"$/, async function (pronounCase, type) {
  await open(this, '/node/add');
  await requirePage(this, 'Add content');
  // An account that may create one type only is sent straight to its form.
  if (!(await this.page.locator(FORM).count())) {
    const link = this.page.locator('ul.admin-list .label a, ul.admin-list a').filter({ hasText: exactly(type) }).first();
    if (!(await link.count())) {
      const types = await this.page.locator('ul.admin-list .label a').allTextContents().catch(() => []);
      throw friendly({
        message: `The "Add content" page does not offer the type "${type}". It offers: ${types.map(clean).join(', ') || '(no types)'}.`,
        hint: 'Use the name of the content type; the types offered follow the "create" permissions of the account.',
      });
    }
    await link.click();
    await settle(this);
    // The administration bar arrives after the page and moves it down: a click
    // that fell beside the link is made again.
    const opened = await poll(this, () => this.page.locator(FORM).count(), (count) => count > 0);
    if (!opened.ok && (await link.count())) {
      await link.click();
      await settle(this);
    }
  }
  await contentForm(this);
});

/**
 * Save the content form with its "Save" button and wait for the confirmation.
 * Fails with the error messages of the site when the content is refused, so a
 * scenario does not go on with content that was not saved.
 *
 * Example #1: When I save the content form
 * Example #2: When we save the content form
 * Example #3: And I save the content form
 * Example #4: When I save the form of the content
 * Example #5: And we save the form of the content
 *
 */
When(/^(I |we )*save the (?:content form|form of the content)$/, async function (pronounCase) {
  const form = await contentForm(this);
  const title = await form.locator('input[name="title"]').first().inputValue().catch(() => '');
  await form.locator('.form-actions input[type="submit"][value="Save"], .form-actions input#edit-submit').first().click();
  await settle(this);
  const outcome = await poll(this, async () => ({ status: await messageTexts(this, 'status'), errors: await messageTexts(this, 'error') }),
    (value) => value.errors.length > 0 || value.status.some((text) => /has been (created|updated)|will be published on/.test(text)));
  if (!outcome.ok || outcome.value.errors.length) {
    const errors = (outcome.value && outcome.value.errors) || [];
    const invalid = await this.page.locator(`${FORM} :invalid`).evaluateAll((els) => els.map((el) => el.name || el.id)).catch(() => []);
    throw friendly({
      message: `The content "${title}" was not saved: ${errors.length ? 'the site answered "' + errors.join('" / "') + '"' : invalid.length ? 'the browser stopped the form on the required field(s) ' + invalid.join(', ') : 'the page showed no confirmation'}.`,
      hint: 'Fill in the required fields of the form; the confirmation reads "... has been created.", "... has been updated." or, for scheduled content, "... will be published on ...".',
    });
  }
  this.lastContent = { title, url: this.page.url() };
});

// ---------------------------------------------------------------------------
// Fields by their label
// ---------------------------------------------------------------------------

// A required field prints a star inside its label ("Title *"), so the label a
// person reads is not the exact accessible name of the control. These steps
// find the control by the label as it reads, with or without the star.

/**
 * The control (input, textarea or select) of a field, by its label.
 *
 * @param {object} world
 * @param {string} label
 * @param {string} selector
 * @param {string} kind - What the step needs, for the error.
 * @returns {Promise<import('playwright').Locator>}
 */
async function fieldControl(world, label, selector, kind) {
  const item = await formItem(world, label);
  const control = item.locator(selector).first();
  if (!(await control.count())) {
    throw friendly({ message: `The "${label}" field is not ${kind}.`, hint: 'Checkboxes and radio buttons are ticked with "I check ..." and "I select radio button ..."; an editor field is written with "I write ... in the "..." editor".' });
  }
  if (!(await control.isVisible())) {
    throw friendly({ message: `The "${label}" field is not visible.`, hint: 'Open the vertical tab or the fieldset that holds the field first; a field with a rich text editor is written with "I write ... in the "..." editor".' });
  }
  return control;
}

/**
 * Fill in a text field or a text area of a form, by its label as it reads: the
 * star of a required field is not part of the label.
 *
 * Example #1: When I enter "A note from the suite" in the "Title" field
 * Example #2: When I enter "A single pixel" in the "Alternate text" field
 * Example #3: When we enter "Wax, Honey" in the "Tags" field
 * Example #4: And I enter "Hours" in the "Menu link title" field
 * Example #5: When enter "opening-hours" in the "Path" field
 *
 */
When(/^(I |we )*enter "(.*)" in the "([^"]*)" field$/, async function (pronounCase, value, label) {
  const control = await fieldControl(this, label, ':scope > input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="file"]), :scope > textarea, :scope > .form-textarea-wrapper > textarea, :scope > span > input', 'a text field');
  await control.fill(value.replace(/\\"/g, '"'));
  // Leaving the field tells the form the value changed (vertical tab summaries follow it).
  await control.dispatchEvent('change');
});

/**
 * Choose an option of a select list of a form, by the label of the field as it
 * reads and the text of the option.
 *
 * Example #1: When I pick "System configuration" in the "Configuration group" field
 * Example #2: When I pick "Custom" in the "Block title type" field
 * Example #3: When we pick "Primary navigation" in the "Menu" field
 * Example #4: And I pick "5" in the "Weight" field
 * Example #5: When pick "Vocabularies" in the "Configuration group" field
 *
 */
When(/^(I |we )*pick "([^"]*)" in the "([^"]*)" field$/, async function (pronounCase, option, label) {
  const control = await fieldControl(this, label, ':scope > select', 'a select list');
  const texts = await control.locator('option').allTextContents();
  const index = texts.map(clean).indexOf(clean(option));
  if (index === -1) {
    throw friendly({ message: `The "${label}" field has no option "${option}". It offers: ${texts.map(clean).filter(Boolean).slice(0, 40).join(', ')}.`, hint: 'Use the text of an option as the field shows it.' });
  }
  await control.selectOption({ index });
  await settle(this);
});

/**
 * Assert the value of a text field, a text area or a select list of a form
 * (the text of its selected option), by the label of the field as it reads.
 *
 * Example #1: Then the "Title" field should have the value "Field note 01"
 * Example #2: Then the "Title" field should not have the value "Another title"
 * Example #3: And the "Menu link title" field should have the value "Hive tour"
 * Example #4: Then the "Configuration group" field should have the value "Vocabularies"
 * Example #5: And the "Tags" field should have the value "Bees"
 *
 */
Then(/^the "([^"]*)" field should( not)* have the value "(.*)"$/, async function (label, notCase, value) {
  const item = await formItem(this, label);
  const control = item.locator(':scope > input:not([type="hidden"]):not([type="submit"]), :scope > textarea, :scope > .form-textarea-wrapper > textarea, :scope > select, :scope > span > input').first();
  if (!(await control.count())) {
    throw friendly({ message: `The "${label}" field has no value to read.`, hint: 'The step reads text fields, text areas and select lists.' });
  }
  const read = () => control.evaluate((el) => (el.tagName === 'SELECT' ? ((el.options[el.selectedIndex] || {}).textContent || '').replace(/\s+/g, ' ').trim() : el.value));
  const wanted = value.replace(/\\"/g, '"');
  const result = await poll(this, read, (found) => (notCase ? found !== wanted : found === wanted));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the "${label}" field not to have the value "${wanted}", but it has.` : `Expected the "${label}" field to have the value "${wanted}", but it has "${result.value}".`, hint: 'A select list is read by the text of its selected option.' });
  }
});

// ---------------------------------------------------------------------------
// The rich text editor
// ---------------------------------------------------------------------------

/**
 * Set the content of the rich text editor of a formatted text field, by the
 * label of the field. HTML is taken as it is; plain text becomes a paragraph.
 * What the field held before is replaced.
 *
 * Example #1: When I write "<p>Hello <strong>bees</strong></p>" in the "Body" editor
 * Example #2: When I write "A plain sentence." in the "Body" editor
 * Example #3: When we write "<h2>Hours</h2><p>Nine to five.</p>" in the "Body" editor
 * Example #4: And I write "<ul><li>One</li><li>Two</li></ul>" in the "Body" editor
 * Example #5: When write "Short note" in the "Description" editor
 *
 */
When(/^(I |we )*write "(.*)" in the "([^"]*)" editor$/, async function (pronounCase, value, label) {
  await setEditor(this, label, value.replace(/\\"/g, '"'));
});

/**
 * Type text into the rich text editor of a field with the keyboard, at the end
 * of what the field holds: the way a person writes, so the toolbar buttons
 * pressed before apply to the text.
 *
 * Example #1: When I type "bold words" into the "Body" editor
 * Example #2: When I type " and more" into the "Body" editor
 * Example #3: When we type "First line" into the "Body" editor
 * Example #4: And I type "A typed sentence." into the "Body" editor
 * Example #5: When type "typed" into the "Description" editor
 *
 */
When(/^(I |we )*type "(.*)" into the "([^"]*)" editor$/, async function (pronounCase, value, label) {
  const item = await editorItem(this, label);
  const editable = item.locator('.ck-editor__editable').first();
  if (!(await editable.count())) {
    await item.locator('textarea').first().pressSequentially(value);
    return;
  }
  // An editor that has the focus keeps its caret and the formatting a toolbar
  // button just switched on or off; otherwise the caret goes to the end.
  const focused = await editable.evaluate((el) => el.ckeditorInstance.editing.view.document.isFocused);
  if (!focused) {
    await editable.click();
    await editable.evaluate((el) => {
      const editor = el.ckeditorInstance;
      editor.model.change((writer) => writer.setSelection(editor.model.document.getRoot(), 'end'));
      editor.editing.view.focus();
    });
  }
  await this.page.keyboard.type(value.replace(/\\"/g, '"'));
});

/**
 * Press a button of the toolbar of the rich text editor of a field, by the
 * name of the button ("Bold", "Italic", "Bulleted List").
 *
 * Example #1: When I press the "Bold" button of the "Body" editor
 * Example #2: When I press the "Italic" button of the "Body" editor
 * Example #3: When we press the "Bulleted List" button of the "Body" editor
 * Example #4: And I press the "Block quote" button of the "Body" editor
 * Example #5: When press the "Bold" button of the "Description" editor
 *
 */
When(/^(I |we )*press the "([^"]*)" button of the "([^"]*)" editor$/, async function (pronounCase, name, label) {
  const item = await editorItem(this, label);
  const button = item.locator('.ck-toolbar button.ck-button').filter({ has: this.page.locator('.ck-button__label').filter({ hasText: exactly(name) }) }).first();
  if (!(await button.count())) {
    const names = await item.locator('.ck-toolbar button.ck-button .ck-button__label').allTextContents();
    throw friendly({ message: `The "${label}" editor has no "${name}" button. Its toolbar has: ${Array.from(new Set(names.map(clean))).filter(Boolean).join(', ') || '(no toolbar: the text format has no editor)'}.`, hint: 'The toolbar follows the text format of the field (Configuration > Content authoring > Text editors and formats).' });
  }
  await button.click();
});

/**
 * Assert the toolbar of the rich text editor of a field has (or does not have)
 * a button.
 *
 * Example #1: Then the "Body" editor should have the "Bold" button
 * Example #2: Then the "Body" editor should have the "Italic" button
 * Example #3: And the "Body" editor should not have the "Source" button
 * Example #4: Then the "Body" editor should have the "Link" button
 * Example #5: And the "Body" editor should not have the "Underline" button
 *
 */
Then(/^the "([^"]*)" editor should( not)* have the "([^"]*)" button$/, async function (label, notCase, name) {
  const item = await editorItem(this, label);
  const names = Array.from(new Set((await item.locator('.ck-toolbar button.ck-button .ck-button__label').allTextContents()).map(clean))).filter(Boolean);
  const has = names.includes(clean(name));
  if (notCase ? has : !has) {
    throw friendly({
      message: notCase ? `Expected the "${label}" editor not to have the "${name}" button, but it has it.` : `Expected the "${label}" editor to have the "${name}" button, but its toolbar has: ${names.join(', ') || '(no toolbar)'}.`,
      hint: 'The toolbar follows the text format of the field and the account (Configuration > Content authoring > Text editors and formats).',
    });
  }
});

/**
 * Assert the HTML of the rich text editor of a field contains (or does not
 * contain) a text.
 *
 * Example #1: Then the "Body" editor should contain "<strong>bold words</strong>"
 * Example #2: Then the "Body" editor should contain "A plain sentence."
 * Example #3: And the "Body" editor should not contain "<script>"
 * Example #4: Then the "Body" editor should contain "<h2>Hours</h2>"
 * Example #5: And the "Body" editor should not contain "<em>"
 *
 */
Then(/^the "([^"]*)" editor should( not)* contain "(.*)"$/, async function (label, notCase, text) {
  const wanted = text.replace(/\\"/g, '"');
  const result = await poll(this, () => getEditor(this, label), (html) => (notCase ? !html.includes(wanted) : html.includes(wanted)));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the "${label}" editor not to contain "${wanted}", but it holds: ${result.value}` : `Expected the "${label}" editor to contain "${wanted}", but it holds: ${result.value || '(nothing)'}`,
      hint: 'The step reads the HTML the editor would save; the editor removes the tags its text format does not allow.',
    });
  }
});

// ---------------------------------------------------------------------------
// Publishing options
// ---------------------------------------------------------------------------

/**
 * Open the vertical tab that holds the publishing options and return the radio
 * buttons of the published state.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function publishingOptions(world) {
  await contentForm(world);
  const pane = world.page.locator(`${FORM} fieldset.node-form-options`).first();
  if (!(await pane.count())) {
    throw friendly({ message: 'The content form has no publishing options for this account.', hint: 'The publishing options need the "Administer content" permission; without it content is saved with the default of its type.' });
  }
  if (!(await pane.isVisible())) {
    const tab = verticalTabs(world).filter({ hasText: /Publishing (actions|options)/ }).first();
    await tab.locator('a').first().click();
    await pane.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return pane;
}

/**
 * Set the published state of the content form: published now, or kept as a
 * draft (unpublished). The state is saved with the form.
 *
 * Example #1: When I set the content to be published
 * Example #2: When I set the content to be a draft
 * Example #3: When we set the content to be published
 * Example #4: And I set the content to be a draft
 * Example #5: When set the content to be published
 *
 */
When(/^(I |we )*set the content to be (published|a draft)$/, async function (pronounCase, state) {
  const pane = await publishingOptions(this);
  await pane.locator(`input[type="radio"][name="status"][value="${state === 'published' ? 1 : 0}"]`).check();
});

/**
 * Promote the content of the form to the lists of promoted content (the home
 * page of a standard site) or keep it out of them, and make it sticky at the
 * top of lists or not: the "Promote" and "Make sticky at top of lists"
 * checkboxes of the publishing options. The two checkboxes share one
 * accessible name ("Additional actions"), so a step that ticks a checkbox by
 * its label does not find them.
 *
 * Example #1: When I set the content to be promoted
 * Example #2: When I set the content to be not promoted
 * Example #3: And I set the content to be sticky
 * Example #4: When we set the content to be not sticky
 * Example #5: And set the content to be not promoted
 *
 */
When(/^(I |we )*set the content to be (not )?(promoted|sticky)$/, async function (pronounCase, notCase, kind) {
  const pane = await publishingOptions(this);
  const box = pane.locator(`input[type="checkbox"][name="${kind === 'promoted' ? 'promote' : 'sticky'}"]`).first();
  if (!(await box.count())) {
    throw friendly({
      message: `The publishing options of this form have no "${kind === 'promoted' ? 'Promote' : 'Make sticky at top of lists'}" checkbox.`,
      hint: 'The content type decides whether its content can be promoted or made sticky (its publishing settings); a Page of the standard profile offers neither.',
    });
  }
  await box.setChecked(!notCase);
});

/**
 * Schedule the content form for publication at a date ("2031-05-01") and a
 * time ("09:30"): the content is saved as a draft and published by cron once
 * the time has come.
 *
 * Example #1: When I schedule the content for "2031-05-01" at "09:30"
 * Example #2: When I schedule the content for "2030-12-31" at "23:59"
 * Example #3: When we schedule the content for "2032-01-15" at "08:00"
 * Example #4: And I schedule the content for "2031-06-30" at "12:00"
 * Example #5: When schedule the content for "2033-03-03" at "03:03"
 *
 */
When(/^(I |we )*schedule the content for "(\d{4}-\d{2}-\d{2})" at "(\d{2}:\d{2}(?::\d{2})?)"$/, async function (pronounCase, date, time) {
  const pane = await publishingOptions(this);
  const later = pane.locator('input[type="radio"][name="status"][value="2"]');
  if (!(await later.count())) {
    throw friendly({ message: 'The publishing options of this form do not offer scheduling.', hint: 'Scheduling is a setting of the content type ("Show option for scheduling", in its publishing settings).' });
  }
  await later.check();
  const dateInput = pane.locator('input[name="scheduled[date]"]');
  await dateInput.waitFor({ state: 'visible', timeout: budget(this) });
  await dateInput.fill(date);
  await pane.locator('input[name="scheduled[time]"]').fill(time.length === 5 ? time + ':00' : time);
});

/**
 * Give the content form a link in a menu: tick "Provide a menu link" in the
 * "Menu settings" vertical tab and fill in the title of the link.
 *
 * Example #1: When I give the content the menu link "Hive tour"
 * Example #2: When I give the content the menu link "Opening hours"
 * Example #3: When we give the content the menu link "Contact"
 * Example #4: And I give the content the menu link "Prices"
 * Example #5: When give the content the menu link "Find us"
 *
 */
When(/^(I |we )*give the content the menu link "([^"]*)"$/, async function (pronounCase, title) {
  await contentForm(this);
  const tab = await verticalTab(this, 'Menu settings');
  await tab.locator('a').first().click();
  const enabled = this.page.locator(`${FORM} input[name="menu[enabled]"]`).first();
  await enabled.waitFor({ state: 'visible', timeout: budget(this) });
  await enabled.check();
  const field = this.page.locator(`${FORM} input[name="menu[link_title]"]`).first();
  await field.waitFor({ state: 'visible', timeout: budget(this) });
  await field.fill(title);
  // The summary of the vertical tab follows the field once it loses the focus.
  await field.blur();
});

// ---------------------------------------------------------------------------
// Vertical tabs and collapsible fieldsets
// ---------------------------------------------------------------------------

/**
 * Switch to a vertical tab of the form, by its title ("URL settings",
 * "Authoring information", "Menu settings").
 *
 * Example #1: When I switch to the "URL settings" vertical tab
 * Example #2: When I switch to the "Authoring information" vertical tab
 * Example #3: When we switch to the "Menu settings" vertical tab
 * Example #4: And I switch to the "Publishing options" vertical tab
 * Example #5: When switch to the "Comment settings" vertical tab
 *
 */
When(/^(I |we )*switch to the "([^"]*)" vertical tab$/, async function (pronounCase, title) {
  const tab = await verticalTab(this, title);
  await tab.locator('a').first().click();
  const result = await poll(this, () => tab.evaluate((el) => el.classList.contains('vertical-tab-selected')), (selected) => selected);
  if (!result.ok) {
    throw friendly({ message: `The "${title}" vertical tab did not open.`, hint: 'Vertical tabs need JavaScript; check for a JavaScript error on the page.' });
  }
});

/**
 * Assert the form offers (or does not offer) a vertical tab, by its title.
 *
 * Example #1: Then I should see the "Menu settings" vertical tab
 * Example #2: Then I should not see the "Menu settings" vertical tab
 * Example #3: And I should see the "URL settings" vertical tab
 * Example #4: Then we should see the "Publishing options" vertical tab
 * Example #5: And should not see the "Authoring information" vertical tab
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" vertical tab$/, async function (pronounCase, notCase, title) {
  const read = async () => (await verticalTabs(this).locator('strong').allTextContents()).map(clean);
  const result = await poll(this, read, (titles) => (notCase ? !titles.includes(clean(title)) : titles.includes(clean(title))));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected no "${title}" vertical tab, but the form offers it.` : `Expected a "${title}" vertical tab, but the form offers: ${result.value.join(', ') || '(no vertical tabs)'}.`,
      hint: 'The vertical tabs of a form follow the permissions of the account.',
    });
  }
});

/**
 * Assert the summary of a vertical tab (the line under its title) contains (or
 * does not contain) a text: the summary follows the fields of the tab.
 *
 * Example #1: Then the "Publishing options" vertical tab summary should contain "Published"
 * Example #2: Then the "Publishing options" vertical tab summary should contain "Draft"
 * Example #3: And the "Menu settings" vertical tab summary should contain "Not in menu"
 * Example #4: Then the "URL settings" vertical tab summary should not contain "No alias"
 * Example #5: And the "Publishing actions" vertical tab summary should contain "Publish now"
 *
 */
Then(/^the "([^"]*)" vertical tab summary should( not)* contain "([^"]*)"$/, async function (title, notCase, text) {
  const tab = await verticalTab(this, title);
  const result = await poll(this, async () => clean(await tab.locator('.summary').first().textContent()), (summary) => (notCase ? !summary.includes(clean(text)) : summary.includes(clean(text))));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the summary of the "${title}" vertical tab not to contain "${text}", but it reads "${result.value}".` : `Expected the summary of the "${title}" vertical tab to contain "${text}", but it reads "${result.value}".`, hint: 'The summary updates when a field of the tab changes.' });
  }
});

/**
 * Expand or collapse a collapsible fieldset of a form, by its legend
 * ("Formatting options", "Visibility conditions"). A fieldset that is already
 * in the wanted state is left alone.
 *
 * Example #1: When I expand the "Formatting options" fieldset
 * Example #2: When I collapse the "Formatting options" fieldset
 * Example #3: When we expand the "Visibility conditions" fieldset
 * Example #4: And I expand the "Style settings" fieldset
 * Example #5: When collapse the "Admin label" fieldset
 *
 */
When(/^(I |we )*(expand|collapse) the "([^"]*)" fieldset$/, async function (pronounCase, action, legend) {
  // The legend reads "Show <name>" or "Hide <name>" for assistive technology.
  const pattern = new RegExp('^\\s*(Show|Hide)?\\s*' + escapeRegExp(legend) + '\\b', 'i');
  const fieldset = this.page.locator('fieldset.collapsible:visible').filter({ has: this.page.locator(':scope > legend .fieldset-title').filter({ hasText: pattern }) }).last();
  const result = await poll(this, () => fieldset.count(), (count) => count > 0);
  if (!result.ok) {
    const legends = await this.page.locator('fieldset.collapsible:visible > legend .fieldset-title').evaluateAll((els) => els.map((el) => (el.textContent || '').replace(/^\s*(Show|Hide)\s+/, '').replace(/\s+/g, ' ').trim()));
    throw friendly({ message: `There is no collapsible "${legend}" fieldset on the page. The collapsible fieldsets are: ${legends.join(', ') || '(none)'}.`, hint: 'Use the legend of the fieldset as the form shows it.' });
  }
  const collapsed = await fieldset.evaluate((el) => el.classList.contains('collapsed'));
  if ((action === 'expand') === collapsed) {
    await fieldset.locator(':scope > legend .fieldset-title').first().click();
    await poll(this, () => fieldset.evaluate((el) => el.classList.contains('collapsed')), (value) => value !== collapsed);
    await settle(this);
  }
});

// ---------------------------------------------------------------------------
// Finding content by its title
// ---------------------------------------------------------------------------

/**
 * Open the content listing filtered by a title and return whether a row with
 * exactly that title is listed.
 *
 * @param {object} world
 * @param {string} title
 * @returns {Promise<boolean>}
 */
async function findContent(world, title) {
  await open(world, '/admin/content?title=' + encodeURIComponent(title));
  await requirePage(world, 'the content listing');
  await world.page.locator('table:not(.sticky-header) tbody').first().waitFor({ state: 'attached', timeout: budget(world) }).catch(() => {});
  return hasRow(world, title);
}

/**
 * The row of a piece of content in the content listing; fails when no content
 * has that title.
 *
 * @param {object} world
 * @param {string} title
 * @returns {Promise<import('playwright').Locator>}
 */
async function contentRow(world, title) {
  if (!(await findContent(world, title))) {
    const names = await rowNames(world);
    throw friendly({
      message: `There is no content titled "${title}". The content listing shows for that title: ${names.join(' | ') || '(nothing)'}.`,
      hint: 'Use the exact title; the listing is the one of Content > Manage content, which needs the "Access the content overview page" permission.',
    });
  }
  return rowNamed(world, title);
}

/**
 * View, or open the edit form of, a piece of content, by its exact title. The
 * content is found in the content listing, so the account of the session must
 * be allowed to open that listing.
 *
 * Example #1: When I view the content "Field note 12"
 * Example #2: When I edit the content "Opening hours"
 * Example #3: When we view the content "Unpublished field note"
 * Example #4: And I edit the content "Editor field note"
 * Example #5: When view the content "Visit the apiary"
 *
 */
When(/^(I |we )*(view|edit) the content "([^"]*)"$/, async function (pronounCase, action, title) {
  const row = await contentRow(this, title);
  if (action === 'view') {
    await row.locator('td.views-field-title a').filter({ hasText: exactly(title) }).first().click();
    await settle(this);
    return;
  }
  await clickRowOperation(this, row, 'Edit', title);
  await contentForm(this);
});

/**
 * Delete a piece of content, by its exact title: the "Delete" operation of its
 * row in the content listing, then the confirmation. Fails when no content has
 * that title.
 *
 * Example #1: When I delete the content "A note from the suite"
 * Example #2: When I delete the content "Scheduled note"
 * Example #3: When we delete the content "Page with an image"
 * Example #4: And I delete the content "Draft from the suite"
 * Example #5: When delete the content "Tagged note"
 *
 */
When(/^(I |we )*delete the content "([^"]*)"$/, async function (pronounCase, title) {
  const row = await contentRow(this, title);
  await clickRowOperation(this, row, 'Delete', title);
  await confirmDelete(this, `the content "${title}"`);
});

/**
 * Make sure no content has a title: every piece of content with exactly that
 * title is deleted. For the start or the end of a scenario that creates
 * content, so it can run again after a failed run.
 *
 * Example #1: Given the content "A note from the suite" does not exist
 * Example #2: Given the content "Scheduled note" does not exist
 * Example #3: And the content "Page with an image" does not exist
 * Example #4: Given the content "Draft from the suite" does not exist
 * Example #5: And the content "Tagged note" does not exist
 *
 */
Given(/^the content "([^"]*)" does not exist$/, async function (title) {
  for (let guard = 0; guard < 25 && (await findContent(this, title)); guard++) {
    const row = await rowNamed(this, title);
    await clickRowOperation(this, row, 'Delete', title);
    await confirmDelete(this, `the content "${title}"`);
  }
});

/**
 * Assert content with a title exists (or does not exist), read from the
 * content listing.
 *
 * Example #1: Then the content "Field note 01" should exist
 * Example #2: Then the content "A note from the suite" should not exist
 * Example #3: And the content "Opening hours" should exist
 * Example #4: Then the content "Scheduled note" should exist
 * Example #5: And the content "Deleted note" should not exist
 *
 */
Then(/^the content "([^"]*)" should( not)* exist$/, async function (title, notCase) {
  const exists = await findContent(this, title);
  if (notCase ? exists : !exists) {
    throw friendly({
      message: notCase ? `Expected no content titled "${title}", but the content listing has it.` : `Expected content titled "${title}", but the content listing shows for that title: ${(await rowNames(this)).join(' | ') || '(nothing)'}.`,
      hint: 'The step reads Content > Manage content, filtered by the title; the title must match exactly.',
    });
  }
});

/**
 * Assert the status the content listing shows for a piece of content:
 * "Published", "Not published" or "Not published (Scheduled)".
 *
 * Example #1: Then the content "Field note 01" should have the status "Published"
 * Example #2: Then the content "Unpublished field note" should have the status "Not published"
 * Example #3: And the content "Scheduled note" should have the status "Not published (Scheduled)"
 * Example #4: Then the content "Opening hours" should have the status "Published"
 * Example #5: And the content "Draft from the suite" should have the status "Not published"
 *
 */
Then(/^the content "([^"]*)" should have the status "([^"]*)"$/, async function (title, status) {
  const row = await contentRow(this, title);
  const column = await this.page.locator('table:not(.sticky-header) > thead th').evaluateAll((ths) => ths.findIndex((th) => /^\s*Status\s*$/i.test(th.textContent || '')));
  const found = column === -1 ? '' : clean(await row.locator('td').nth(column).textContent());
  if (found.toLowerCase() !== clean(status).toLowerCase()) {
    throw friendly({ message: `Expected the content "${title}" to have the status "${status}", but the content listing shows "${found || '(no Status column)'}".`, hint: 'The status is the "Status" column of Content > Manage content: Published, Not published or Not published (Scheduled).' });
  }
});

/**
 * Answer the confirmation form of a delete with its "Delete" button and check
 * the site confirmed.
 *
 * @param {object} world
 * @param {string} what
 */
async function confirmDelete(world, what) {
  const form = world.page.locator('form.confirmation').first();
  await actOrExplain('find the confirmation form to delete', what, () => form.waitFor({ state: 'visible', timeout: budget(world) }),
    'The "Delete" operation leads to a confirmation form; the account may not be allowed to delete this item.');
  await form.locator('.form-actions input[type="submit"]').first().click();
  await settle(world);
  const errors = await messageTexts(world, 'error');
  if (errors.length || (await world.page.locator('form.confirmation').count())) {
    throw friendly({ message: `Could not delete ${what}: ${errors.length ? 'the site answered "' + errors.join('" / "') + '"' : 'the confirmation form is still on the page'}.`, hint: 'Check the permissions of the account and that nothing else uses the item.' });
  }
}

// ---------------------------------------------------------------------------
// Files in fields and in the file listing
// ---------------------------------------------------------------------------

/**
 * The absolute path of a fixture: a path relative to the project, or a file
 * name inside tests/fixtures.
 *
 * @param {string} name
 * @returns {string}
 */
function fixturePath(name) {
  const candidates = [path.resolve(name), path.resolve('tests/fixtures', name), path.resolve(__dirname, '..', 'fixtures', name)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw friendly({ message: `The file "${name}" was not found. Looked in: ${candidates.join(', ')}.`, hint: 'Put the file in tests/fixtures of the project, or give a path relative to the project.' });
  }
  return found;
}

/**
 * Upload a file to an image or file field of a form, by the label of the
 * field, and wait until the site has taken it (the field then shows the file
 * with a "Remove" button). The file comes from tests/fixtures.
 *
 * Example #1: When I upload the file "pixel.png" to the "Image" field
 * Example #2: When I upload the file "hive.jpg" to the "Image" field
 * Example #3: When we upload the file "pixel.png" to the "Picture" field
 * Example #4: And I upload the file "report.pdf" to the "Attachment" field
 * Example #5: When upload the file "pixel.png" to the "Image" field
 *
 */
When(/^(I |we )*upload the file "([^"]*)" to the "([^"]*)" field$/, async function (pronounCase, name, label) {
  const file = fixturePath(name);
  const item = await formItem(this, label);
  const input = item.locator('input[type="file"]').first();
  if (!(await input.count())) {
    throw friendly({ message: `The "${label}" field takes no upload: it already holds a file, or it is not a file field.`, hint: 'Remove the file first ("When I remove the file of the "..." field").' });
  }
  await input.setInputFiles(file);
  // The field uploads on its own; without JavaScript the "Upload" button does it.
  const upload = item.locator('input[type="submit"][value="Upload"]:visible').first();
  if (await upload.count()) await upload.click().catch(() => {});
  const taken = await poll(this, async () => ({ removed: await item.locator('input[type="submit"][value="Remove"]').count(), errors: await messageTexts(this, 'error') }), (value) => value.removed > 0 || value.errors.length > 0);
  if (!taken.ok || !taken.value.removed) {
    throw friendly({ message: `The file "${name}" was not taken by the "${label}" field${taken.value && taken.value.errors.length ? ': the site answered "' + taken.value.errors.join('" / "') + '"' : ''}.`, hint: 'Check the allowed file types and the size limit under the field.' });
  }
  await settle(this);
});

/**
 * Assert an image or file field of a form holds (or does not hold) a file, by
 * its name. A name that was taken is stored with a number ("pixel_0.png"): it
 * counts as the same file.
 *
 * Example #1: Then the "Image" field should hold the file "pixel.png"
 * Example #2: Then the "Image" field should not hold the file "pixel.png"
 * Example #3: And the "Image" field should hold the file "hive.jpg"
 * Example #4: Then the "Attachment" field should hold the file "report.pdf"
 * Example #5: And the "Picture" field should not hold the file "old.png"
 *
 */
Then(/^the "([^"]*)" field should( not)* hold the file "([^"]*)"$/, async function (label, notCase, name) {
  const item = await formItem(this, label);
  const stem = name.replace(/\.[^.]+$/, '');
  const pattern = new RegExp('^' + escapeRegExp(stem) + '(_\\d+)?' + escapeRegExp(name.slice(stem.length)) + '$', 'i');
  const result = await poll(this, async () => (await item.locator('span.file a, .file a').allTextContents()).map(clean), (names) => (notCase ? !names.some((value) => pattern.test(value)) : names.some((value) => pattern.test(value))));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the "${label}" field not to hold the file "${name}", but it does.` : `Expected the "${label}" field to hold the file "${name}", but it holds: ${result.value.join(', ') || '(no file)'}.`, hint: 'Upload first ("When I upload the file "..." to the "..." field").' });
  }
});

/**
 * Remove the file an image or file field of a form holds, with its "Remove"
 * button, and wait until the field is empty again.
 *
 * Example #1: When I remove the file of the "Image" field
 * Example #2: When we remove the file of the "Image" field
 * Example #3: And I remove the file of the "Attachment" field
 * Example #4: When I remove the file of the "Picture" field
 * Example #5: When remove the file of the "Image" field
 *
 */
When(/^(I |we )*remove the file of the "([^"]*)" field$/, async function (pronounCase, label) {
  const item = await formItem(this, label);
  const remove = item.locator('input[type="submit"][value="Remove"]').first();
  if (!(await remove.count())) {
    throw friendly({ message: `The "${label}" field holds no file to remove.`, hint: 'The "Remove" button shows once the field holds a file.' });
  }
  await remove.click();
  const emptied = await poll(this, () => item.locator('input[type="file"]').count(), (count) => count > 0);
  if (!emptied.ok) {
    throw friendly({ message: `The "${label}" field still holds its file after "Remove".`, hint: 'The button works by AJAX; check for a JavaScript error on the page.' });
  }
  await settle(this);
});

/**
 * Open the file listing filtered by a file name and return the names of the
 * files stored under that name ("pixel.png", "pixel_0.png").
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<string[]>}
 */
async function findFiles(world, name) {
  const stem = name.replace(/\.[^.]+$/, '');
  const pattern = new RegExp('^' + escapeRegExp(stem) + '(_\\d+)?' + escapeRegExp(name.slice(stem.length)) + '$', 'i');
  await open(world, '/admin/content/files?filename=' + encodeURIComponent(stem));
  await requirePage(world, 'the file listing');
  await world.page.locator('table:not(.sticky-header) tbody').first().waitFor({ state: 'attached', timeout: budget(world) }).catch(() => {});
  return (await rowNames(world)).filter((value) => pattern.test(value));
}

/**
 * Make sure the site stores no file with a name: every file of that name is
 * deleted from the file listing (Content > Manage files). For the start or the
 * end of a scenario that uploads a file.
 *
 * Example #1: Given the file "pixel.png" does not exist
 * Example #2: Given the file "hive.jpg" does not exist
 * Example #3: And the file "report.pdf" does not exist
 * Example #4: Given the file "upload-test.png" does not exist
 * Example #5: And the file "pixel.png" does not exist
 *
 */
Given(/^the file "([^"]*)" does not exist$/, async function (name) {
  for (let guard = 0; guard < 25; guard++) {
    const found = await findFiles(this, name);
    if (!found.length) return;
    const row = await rowNamed(this, found[0]);
    await clickRowOperation(this, row, 'Delete', found[0]);
    await confirmDelete(this, `the file "${found[0]}"`);
  }
});

/**
 * Assert the site stores (or does not store) a file with a name, read from the
 * file listing.
 *
 * Example #1: Then the file "pixel.png" should exist
 * Example #2: Then the file "pixel.png" should not exist
 * Example #3: And the file "card1-layout.png" should exist
 * Example #4: Then the file "hive.jpg" should not exist
 * Example #5: And the file "report.pdf" should exist
 *
 */
Then(/^the file "([^"]*)" should( not)* exist$/, async function (name, notCase) {
  const found = await findFiles(this, name);
  if (notCase ? found.length > 0 : found.length === 0) {
    throw friendly({ message: notCase ? `Expected no file "${name}", but the file listing has ${found.join(', ')}.` : `Expected a file "${name}", but the file listing has none of that name.`, hint: 'The step reads Content > Manage files, filtered by the name.' });
  }
});

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/**
 * Open the list of terms of a vocabulary, by the name of the vocabulary.
 *
 * @param {object} world
 * @param {string} vocabulary
 */
async function openVocabulary(world, vocabulary) {
  await openAdminPage(world, 'taxonomy');
  const row = await rowNamed(world, vocabulary, { what: 'vocabulary' });
  await clickRowOperation(world, row, 'List terms', vocabulary);
  await world.page.locator('table#taxonomy').first().waitFor({ state: 'visible', timeout: budget(world) });
}

/**
 * Add a term to a vocabulary, by the name of the vocabulary, through its "Add
 * term" form.
 *
 * Example #1: When I add the term "Wax" to the "Tags" vocabulary
 * Example #2: When I add the term "Pollen" to the "Tags" vocabulary
 * Example #3: When we add the term "Smoke" to the "Tags" vocabulary
 * Example #4: And I add the term "Nectar" to the "Tags" vocabulary
 * Example #5: When add the term "Brood" to the "Tags" vocabulary
 *
 */
When(/^(I |we )*add the term "([^"]*)" to the "([^"]*)" vocabulary$/, async function (pronounCase, term, vocabulary) {
  await openVocabulary(this, vocabulary);
  await this.page.locator('ul.action-links a').filter({ hasText: exactly('Add term') }).first().click();
  await settle(this);
  const form = this.page.locator('form.taxonomy-form-term, form#taxonomy-form-term').first();
  await actOrExplain('find', 'the term form', () => form.waitFor({ state: 'visible', timeout: budget(this) }), 'The form opens from the "Add term" action link of the vocabulary.');
  await form.locator('input[name="name"]').fill(term);
  await form.locator('.form-actions input[type="submit"][value="Save"]').first().click();
  await settle(this);
  const outcome = await poll(this, async () => ({ status: await messageTexts(this, 'status'), errors: await messageTexts(this, 'error') }), (value) => value.errors.length > 0 || value.status.some((text) => /Created new term/.test(text)));
  if (!outcome.ok || outcome.value.errors.length) {
    throw friendly({ message: `The term "${term}" was not added: ${outcome.value && outcome.value.errors.length ? 'the site answered "' + outcome.value.errors.join('" / "') + '"' : 'the page showed no confirmation'}.`, hint: 'The confirmation reads "Created new term ...".' });
  }
});

/**
 * Delete a term of a vocabulary, by its name: the "Delete" operation of its
 * row, then the confirmation. Fails when the vocabulary has no such term.
 *
 * Example #1: When I delete the term "Wax" from the "Tags" vocabulary
 * Example #2: When I delete the term "Pollen" from the "Tags" vocabulary
 * Example #3: When we delete the term "Smoke" from the "Tags" vocabulary
 * Example #4: And I delete the term "Nectar" from the "Tags" vocabulary
 * Example #5: When delete the term "Brood" from the "Tags" vocabulary
 *
 */
When(/^(I |we )*delete the term "([^"]*)" from the "([^"]*)" vocabulary$/, async function (pronounCase, term, vocabulary) {
  await openVocabulary(this, vocabulary);
  const row = await rowNamed(this, term, { scope: this.page.locator('table#taxonomy'), what: 'term' });
  await clickRowOperation(this, row, 'Delete', term);
  await confirmDelete(this, `the term "${term}"`);
});

/**
 * Make sure a vocabulary has no term with a name: every term of that name is
 * deleted. For the start or the end of a scenario that creates a term.
 *
 * Example #1: Given the term "Wax" does not exist in the "Tags" vocabulary
 * Example #2: Given the term "Pollen" does not exist in the "Tags" vocabulary
 * Example #3: And the term "Smoke" does not exist in the "Tags" vocabulary
 * Example #4: Given the term "Nectar" does not exist in the "Tags" vocabulary
 * Example #5: And the term "Brood" does not exist in the "Tags" vocabulary
 *
 */
Given(/^the term "([^"]*)" does not exist in the "([^"]*)" vocabulary$/, async function (term, vocabulary) {
  for (let guard = 0; guard < 25; guard++) {
    await openVocabulary(this, vocabulary);
    const scope = this.page.locator('table#taxonomy');
    if (!(await hasRow(this, term, scope))) return;
    const row = await rowNamed(this, term, { scope });
    await clickRowOperation(this, row, 'Delete', term);
    await confirmDelete(this, `the term "${term}"`);
  }
});

/**
 * Assert a vocabulary has (or does not have) a term, read from its list of
 * terms.
 *
 * Example #1: Then the "Tags" vocabulary should have the term "Bees"
 * Example #2: Then the "Tags" vocabulary should have the term "Honey"
 * Example #3: And the "Tags" vocabulary should not have the term "Wax"
 * Example #4: Then the "Tags" vocabulary should have the term "Hives"
 * Example #5: And the "Tags" vocabulary should not have the term "Pollen"
 *
 */
Then(/^the "([^"]*)" vocabulary should( not)* have the term "([^"]*)"$/, async function (vocabulary, notCase, term) {
  await openVocabulary(this, vocabulary);
  const scope = this.page.locator('table#taxonomy');
  const has = await hasRow(this, term, scope);
  if (notCase ? has : !has) {
    throw friendly({ message: notCase ? `Expected the "${vocabulary}" vocabulary not to have the term "${term}", but it has it.` : `Expected the "${vocabulary}" vocabulary to have the term "${term}", but its terms are: ${(await rowNames(this, scope)).join(', ') || '(none)'}.`, hint: 'The step reads the list of terms of the vocabulary (Structure > Taxonomy).' });
  }
});

/**
 * Type the start of a term into an autocomplete field (such as "Tags") and
 * pick a suggestion from the list the site offers.
 *
 * Example #1: When I type "Hon" into the "Tags" field and pick the suggestion "Honey"
 * Example #2: When I type "Bee" into the "Tags" field and pick the suggestion "Bees"
 * Example #3: When we type "Hiv" into the "Tags" field and pick the suggestion "Hives"
 * Example #4: And I type "adm" into the "Authored by" field and pick the suggestion "admin"
 * Example #5: When type "edi" into the "Authored by" field and pick the suggestion "editor"
 *
 */
When(/^(I |we )*type "([^"]*)" into the "([^"]*)" field and pick the suggestion "([^"]*)"$/, async function (pronounCase, typed, label, suggestion) {
  const item = await formItem(this, label);
  const input = item.locator('input.form-autocomplete').first();
  if (!(await input.count())) {
    throw friendly({ message: `The "${label}" field is not an autocomplete field.`, hint: 'Autocomplete fields suggest values as you type (tags, authors).' });
  }
  await input.click();
  await input.pressSequentially(typed, { delay: 60 });
  const options = this.page.locator('#autocomplete li');
  const option = options.filter({ hasText: exactly(suggestion) }).first();
  const result = await poll(this, () => option.count(), (count) => count > 0);
  if (!result.ok) {
    const offered = await options.allTextContents().catch(() => []);
    throw friendly({ message: `The "${label}" field did not suggest "${suggestion}" for "${typed}". It suggested: ${offered.map(clean).join(', ') || '(nothing)'}.`, hint: 'Suggestions come from the existing terms (or accounts) that contain the typed text.' });
  }
  await option.click();
  await settle(this);
});

// ---------------------------------------------------------------------------
// Menu links
// ---------------------------------------------------------------------------

/**
 * Open the list of links of a menu, by the name of the menu.
 *
 * @param {object} world
 * @param {string} menu
 */
async function openMenu(world, menu) {
  await openAdminPage(world, 'menus');
  const row = await rowNamed(world, menu, { what: 'menu' });
  await clickRowOperation(world, row, 'Manage links', menu);
  await world.page.locator('form#menu-overview-form, table#menu-overview').first().waitFor({ state: 'visible', timeout: budget(world) });
}

/**
 * Add a link to a menu, by the name of the menu, through its "Add link" form:
 * the title of the link and the path it leads to ("about", "node/5",
 * "<front>" or a full address).
 *
 * Example #1: When I add the link "Notes" to "about" in the "Primary navigation" menu
 * Example #2: When I add the link "Hours" to "opening-hours" in the "Primary navigation" menu
 * Example #3: When we add the link "Start" to "<front>" in the "Primary navigation" menu
 * Example #4: And I add the link "Project" to "https://example.com" in the "Primary navigation" menu
 * Example #5: When add the link "Account" to "user" in the "Account menu" menu
 *
 */
When(/^(I |we )*add the link "([^"]*)" to "([^"]*)" in the "([^"]*)" menu$/, async function (pronounCase, title, target, menu) {
  await openMenu(this, menu);
  await this.page.locator('ul.action-links a').filter({ hasText: exactly('Add link') }).first().click();
  await settle(this);
  const form = this.page.locator('form#menu-edit-item, form.menu-edit-item').first();
  await actOrExplain('find', 'the menu link form', () => form.waitFor({ state: 'visible', timeout: budget(this) }), 'The form opens from the "Add link" action link of the menu.');
  await form.locator('input[name="link_title"]').fill(title);
  await form.locator('input[name="link_path"]').fill(target);
  await form.locator('.form-actions input[type="submit"][value="Save"]').first().click();
  await settle(this);
  const errors = await messageTexts(this, 'error');
  if (errors.length || (await this.page.locator('form#menu-edit-item, form.menu-edit-item').count())) {
    throw friendly({ message: `The link "${title}" was not added to the "${menu}" menu: ${errors.length ? 'the site answered "' + errors.join('" / "') + '"' : 'the form is still on the page'}.`, hint: 'The path must exist on the site ("about", "node/5", "<front>") or be a full address.' });
  }
});

/**
 * Delete a link of a menu, by its title: the "Delete" operation of its row,
 * then the confirmation. Fails when the menu has no such link.
 *
 * Example #1: When I delete the link "Notes" from the "Primary navigation" menu
 * Example #2: When I delete the link "Hours" from the "Primary navigation" menu
 * Example #3: When we delete the link "Start" from the "Primary navigation" menu
 * Example #4: And I delete the link "Project" from the "Primary navigation" menu
 * Example #5: When delete the link "Account" from the "Account menu" menu
 *
 */
When(/^(I |we )*delete the link "([^"]*)" from the "([^"]*)" menu$/, async function (pronounCase, title, menu) {
  await openMenu(this, menu);
  const row = await rowNamed(this, title, { scope: this.page.locator('table#menu-overview'), what: 'link' });
  await clickRowOperation(this, row, 'Delete', title);
  await confirmDelete(this, `the link "${title}"`);
});

/**
 * Make sure a menu has no link with a title: every link of that title is
 * deleted. For the start or the end of a scenario that creates a link.
 *
 * Example #1: Given the link "Notes" does not exist in the "Primary navigation" menu
 * Example #2: Given the link "Hours" does not exist in the "Primary navigation" menu
 * Example #3: And the link "Start" does not exist in the "Primary navigation" menu
 * Example #4: Given the link "Hive tour" does not exist in the "Primary navigation" menu
 * Example #5: And the link "Account" does not exist in the "Account menu" menu
 *
 */
Given(/^the link "([^"]*)" does not exist in the "([^"]*)" menu$/, async function (title, menu) {
  for (let guard = 0; guard < 25; guard++) {
    await openMenu(this, menu);
    const scope = this.page.locator('table#menu-overview');
    if (!(await hasRow(this, title, scope))) return;
    const row = await rowNamed(this, title, { scope });
    await clickRowOperation(this, row, 'Delete', title);
    await confirmDelete(this, `the link "${title}"`);
  }
});

/**
 * Enable or disable a link of a menu, by its title: its "Enabled" checkbox in
 * the list of links, saved with "Save configuration". A disabled link stays in
 * the menu but is not shown.
 *
 * Example #1: When I disable the link "Notes" of the "Primary navigation" menu
 * Example #2: When I enable the link "Notes" of the "Primary navigation" menu
 * Example #3: When we disable the link "Hours" of the "Primary navigation" menu
 * Example #4: And I enable the link "Hours" of the "Primary navigation" menu
 * Example #5: When disable the link "Start" of the "Primary navigation" menu
 *
 */
When(/^(I |we )*(enable|disable) the link "([^"]*)" of the "([^"]*)" menu$/, async function (pronounCase, action, title, menu) {
  await openMenu(this, menu);
  const row = await rowNamed(this, title, { scope: this.page.locator('table#menu-overview'), what: 'link' });
  await row.locator('td.menu-enabled input[type="checkbox"], input[name$="[hidden]"]').first().setChecked(action === 'enable');
  await this.page.locator('form#menu-overview-form .form-actions input[type="submit"]').first().click();
  await settle(this);
  const errors = await messageTexts(this, 'error');
  if (errors.length) {
    throw friendly({ message: `Could not ${action} the link "${title}": the site answered "${errors.join('" / "')}".`, hint: 'Check the permissions of the account.' });
  }
});

/**
 * Assert a menu has (or does not have) a link, read from its list of links in
 * the administration (enabled or not).
 *
 * Example #1: Then the "Primary navigation" menu should have the link "Home"
 * Example #2: Then the "Primary navigation" menu should have the link "About"
 * Example #3: And the "Primary navigation" menu should not have the link "Notes"
 * Example #4: Then the "Account menu" menu should have the link "Log out"
 * Example #5: And the "Primary navigation" menu should not have the link "Hive tour"
 *
 */
Then(/^the "([^"]*)" menu should( not)* have the link "([^"]*)"$/, async function (menu, notCase, title) {
  await openMenu(this, menu);
  const scope = this.page.locator('table#menu-overview');
  const has = await hasRow(this, title, scope);
  if (notCase ? has : !has) {
    throw friendly({ message: notCase ? `Expected the "${menu}" menu not to have the link "${title}", but it has it.` : `Expected the "${menu}" menu to have the link "${title}", but its links are: ${(await rowNames(this, scope)).join(', ') || '(none)'}.`, hint: 'The step reads the list of links of the menu (Structure > Menus > Manage links).' });
  }
});
