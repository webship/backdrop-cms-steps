# backdrop-cms-steps

Cucumber step definitions for testing Backdrop CMS sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/backdrop-cms-steps` covers what Backdrop CMS itself renders,
whatever the theme: logging in and out and the session, the administration bar
and its menu search, the administration pages by name, content (create, edit,
publish, save as a draft, schedule, delete), the content, file and account
listings with their filters, sorting, operations and bulk actions, the rich text
editor (CKEditor 5), images and files, terms and tags, menus and menu links, the
layout editor (regions, blocks, moving blocks with the keyboard, visibility
conditions, save and cancel), accounts, roles and permissions, messages and form
errors, the status report, cron, the configuration manager, and the front-end
landmarks (primary navigation, breadcrumb, pager, search, teasers, blocks).

The steps are written against the markup of Backdrop CMS 1.35 with the standard
install profile (the Basis theme, the Seven administration theme). The pack
stands on its own: it needs webship-js and nothing else.

CI builds a real Backdrop CMS site with [DDEV](https://ddev.com) and runs the
whole suite against it, twice, on every push and pull request; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.10 or later)
- A Backdrop CMS 1.x site to test

## Install

```bash
npm install --save-dev @webship-js/backdrop-cms-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/backdrop-cms-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the site and name the accounts the suite logs in with
   (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-site.example',
     users: {
       admin: { username: 'admin', password: process.env.SITE_ADMIN_PASSWORD },
       editor: { username: 'editor', password: process.env.SITE_EDITOR_PASSWORD },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and adjust the titles, menu links and search terms to the content of
   your site.

4. Run the suite:

   ```bash
   npx cucumber-js
   ```

## What is included

| Path | Purpose |
| --- | --- |
| `tests/step-definitions/backdrop.steps.js` | Session and front end: logging in and out, the session cookie, password reset, messages and their "Dismiss" link, form errors, the primary navigation and its toggle, breadcrumb, page heading, page tabs, action links, pager, search, teasers, tags, images, blocks, the layout template and the theme of a page, "Access denied" and "Page not found", access to a path. |
| `tests/step-definitions/backdrop-admin.steps.js` | Administration: the administration bar (menus, menu search, account, flush caches, log out), pages by name, listings (filters, sorting, rows, operations, bulk actions), the dialog, confirmation forms, accounts, roles and permissions, the status report, cron, the configuration manager. |
| `tests/step-definitions/backdrop-content.steps.js` | Content: starting a piece of content, fields by their label, the rich text editor, publishing options and scheduling, vertical tabs and collapsible fieldsets, saving, finding content by its title, files in fields and in the file listing, terms, autocomplete fields, menu links. |
| `tests/step-definitions/backdrop-layout.steps.js` | Layouts: the layout editor, regions and blocks (add, configure, move, disable, remove), the block list and its search, visibility conditions, save and cancel, the list of layouts. |
| `tests/step-definitions/backdrop-helpers.js` | Shared plumbing. It registers no step. |
| `tests/features/*.feature` | Reference features for a standard site with the seeded content. |
| `tests/fixtures/pixel.png` | The image the upload scenarios use. |
| `tests/check-examples.js` | Checks every `Example #n:` line and every feature step against the step patterns (`npm run test:examples`). |
| `.github/scripts/build-ddev-backdrop-cms.sh` | Builds the site with DDEV, the test accounts and the seeded content (`seed-site.php`). |

## Accounts

A feature never creates or deletes an account. The accounts are configuration:
they are created once when the site is built and named in
`worldParameters.users` of `cucumber.js`, by a handle the steps use
(`Given I am logged in as "editor"`).

| Handle | Role | Used for |
| --- | --- | --- |
| `admin` | Administrator | Layouts, menus, accounts, permissions, the status report, configuration. |
| `editor` | Editor (the stock role of the standard profile) | Content, tags and files; no layouts, menus, accounts or configuration. |
| `member` | Authenticated only | A signed-in user without any administration. |

For your own site, create the accounts with the tool you already use and give
their passwords through environment variables (`SITE_ADMIN_PASSWORD`,
`SITE_EDITOR_PASSWORD`, `SITE_MEMBER_PASSWORD`); never commit a real password.

## Steps

One phrasing per step is listed here; every step has at least five in the JSDoc
block above its definition. Assertions read both ways (`should` and
`should not`), and the pronoun (`I`, `we`) is optional.

### `backdrop.steps.js`

**Logging in and out**

- `Given I am logged in as "admin"`
- `When I log in as "admin"`
- `When I submit the log in form with the username "admin" and the password "wrong"`
- `When I log out of the site`
- `Then I should be logged in as "editor"`
- `Then I should be logged out`
- `Then I should have a session cookie`
- `When I ask for a password reset for "editor"`

**Messages**

- `Then the status message should contain "has been created"`
- `Then there should be no error messages`
- `When I dismiss the status message`
- `Then the "Title" field should be marked as an error`

**Primary navigation**

- `Then the primary navigation should list "Home"`
- `When I click "About" in the primary navigation`
- `Then the primary navigation should mark "Home" as the current page`
- `When I toggle the primary navigation`
- `Then the primary navigation should be open`

**Breadcrumb, heading, tabs, action links**

- `Then the breadcrumb trail should be "Home"`
- `Then the page heading should be "Field note 12"`
- `Then I should see the "Edit" page tab`
- `When I open the "Edit" page tab`
- `When I follow the "Add content" action link`

**Pager**

- `Then I should see a pager`
- `When I go to the next page of the pager`
- `Then the pager should be on page 1`

**Search**

- `When I search the site for "apiary"`
- `Then the search results should list "Visit the apiary"`
- `Then the search should find 2 results`

**Content on the front end**

- `Then I should see the teaser "Field note 12"`
- `When I open the teaser "Field note 12"`
- `Then the content on the page should be published`
- `Then the content on the page should be tagged "Hives"`
- `Then the content on the page should show the image "pixel.png"`

**Blocks, layout template and theme of a page**

- `Then I should see the block titled "Search"`
- `Then the page should use the "Boxton" layout template`
- `Then the page should use the "basis" theme`

**Access denied, page not found**

- `Then the page should be an access denied page`
- `Then I should have access to "admin/content"`
- `When I open my account page`


### `backdrop-admin.steps.js`

**The administration bar**

- `Then I should see the administration bar`
- `Then the administration bar should list "Content"`
- `When I open "Structure > Layouts" from the administration bar`
- `When I search the administration bar for "Layouts"`
- `Then the administration bar search should suggest "Structure: Layouts"`
- `When I choose "Structure: Layouts" from the administration bar search`
- `Then the administration bar should show the account "editor"`
- `When I flush all caches from the administration bar`
- `When I log out from the administration bar`

**Administration pages by name**

- `Given I am on the "content" administration page`
- `When I go to the "content" administration page`

**Listings**

- `When I filter the listing by "Type" with "Post"`
- `When I sort the listing by "Title"`
- `Then the listing should list "Field note 01"`
- `Then the listing should start with "Field note 01"`
- `Then the listing should have 3 rows`
- `When I select the row "Field note 01" of the listing`
- `When I apply the "Unpublish content" action to the selected rows`
- `When I choose the "Edit" operation of the "Field note 01" row`
- `Then the "Field note 01" row should offer the "Edit" operation`

**The dialog**

- `Then I should see the dialog "Add block"`
- `When I press "Add block" in the dialog`
- `When I close the dialog`

**Confirmation forms**

- `Then I should be asked to confirm "Are you sure you want to delete"`
- `When I confirm with "Delete"`
- `When I cancel the confirmation`

**Accounts, roles and permissions**

- `Then the "Editor" role should have the permission "Access the content overview page"`
- `Then the account "editor" should have the "Editor" role`
- `Then the account "editor" should be active`
- `Then the site should have the role "Editor"`

**Status report, cron, configuration**

- `Then the status report should not show errors`
- `Then the status report entry "PHP" should contain "8."`
- `Then the status report entry "PHP" should be ok`
- `When I run cron`
- `When I export the configuration "system.core" of the group "System configuration"`
- `Then the exported configuration should contain "site_name"`
- `Then the configuration should not have staged changes`


### `backdrop-content.steps.js`
- `When I start a new "Post"`
- `When I save the content form`

**Fields by their label**

- `When I enter "A note from the suite" in the "Title" field`
- `When I pick "System configuration" in the "Configuration group" field`
- `Then the "Title" field should have the value "Field note 01"`

**The rich text editor**

- `When I write "<p>Hello <strong>bees</strong></p>" in the "Body" editor`
- `When I type "bold words" into the "Body" editor`
- `When I press the "Bold" button of the "Body" editor`
- `Then the "Body" editor should have the "Bold" button`
- `Then the "Body" editor should contain "<strong>bold words</strong>"`

**Publishing options**

- `When I set the content to be published`
- `When I schedule the content for "2031-05-01" at "09:30"`
- `When I give the content the menu link "Hive tour"`

**Vertical tabs and collapsible fieldsets**

- `When I switch to the "URL settings" vertical tab`
- `Then I should see the "Menu settings" vertical tab`
- `Then the "Publishing options" vertical tab summary should contain "Published"`
- `When I expand the "Formatting options" fieldset`

**Finding content by its title**

- `When I view the content "Field note 12"`
- `When I delete the content "A note from the suite"`
- `Given the content "A note from the suite" does not exist`
- `Then the content "Field note 01" should exist`
- `Then the content "Field note 01" should have the status "Published"`
- `When I upload the file "pixel.png" to the "Image" field`
- `Then the "Image" field should hold the file "pixel.png"`
- `When I remove the file of the "Image" field`
- `Given the file "pixel.png" does not exist`
- `Then the file "pixel.png" should exist`

**Terms**

- `When I add the term "Wax" to the "Tags" vocabulary`
- `When I delete the term "Wax" from the "Tags" vocabulary`
- `Given the term "Wax" does not exist in the "Tags" vocabulary`
- `Then the "Tags" vocabulary should have the term "Bees"`
- `When I type "Hon" into the "Tags" field and pick the suggestion "Honey"`

**Menu links**

- `When I add the link "Notes" to "posts" in the "Primary navigation" menu`
- `When I delete the link "Notes" from the "Primary navigation" menu`
- `Given the link "Notes" does not exist in the "Primary navigation" menu`
- `When I disable the link "Notes" of the "Primary navigation" menu`
- `Then the "Primary navigation" menu should have the link "Home"`


### `backdrop-layout.steps.js`
- `Given I am editing the "Default Layout" layout`
- `Given the "Default Layout" layout has no unsaved changes`
- `When I save the layout changes`
- `When I cancel the layout changes`
- `Then the layout should have unsaved changes`

**Regions and blocks**

- `Then the layout should have the "Sidebar" region`
- `When I open the block list of the "Sidebar" region`
- `When I search the block list for "Search"`
- `Then the block list should offer "Search form"`
- `When I choose "Syndicate" from the block list`
- `When I add the "Syndicate" block to the "Sidebar" region`
- `When I configure the "Syndicate" block of the "Sidebar" region`
- `When I remove the "Syndicate" block from the "Sidebar" region`
- `When I disable the "Syndicate" block of the "Sidebar" region`
- `Then the "Syndicate" block of the "Sidebar" region should be disabled`
- `When I move the "Syndicate" block of the "Sidebar" region to the "Footer" region`
- `When I move the "Syndicate" block of the "Sidebar" region up`
- `Then the "Sidebar" region should have the "Syndicate" block`
- `Then the "Sidebar" region should have 0 blocks`
- `Then the "Header block" block should come before the "Primary navigation" block in the "Header" region`

**Visibility conditions**

- `When I start the visibility condition "User account: Role" in the dialog`
- `Then the dialog should list a visibility condition containing "Editor"`

**The list of layouts**

- `Then the "Default Layout" layout should use the "Moscone Flipped" template`
- `Then the "Dashboard" layout should have a condition containing "Access Dashboard"`
- `Then the "Home page" layout should apply to the path "home"`


## Composing with webship-js

The pack adds what the platform needs and leaves the rest to webship-js. A few
built-in steps the reference features use next to the pack's own:

```gherkin
Given I am an anonymous user
Given I am viewing the site on a "xs" device
Given browser validation for the form "form.node-form" is disabled
When I press "Save"
When I check "Editor"
Then I should see "Not published" in the "Unpublished field note" row
Then the response status code should be 403
Then the page should have exactly one h1
```

Two things to know when you mix them:

- A required field prints a star inside its label ("Title \*"), so webship-js's
  `I fill in "Title" with ...` (an exact label match) does not find it. Use
  `I enter "..." in the "Title" field`, which reads the label as a person does.
- Pages for visitors are cached by the site and, for a few minutes, by the
  browser. After a change that should show at once to visitors (a saved
  layout), flush the caches and reload:
  `When I flush all caches from the administration bar`, then
  `When I reload the page` on the page a visitor opens.

## Run this repository's suite

```bash
npm install
npx playwright install chromium

# A standard site in DDEV (project "backdropcmssteps"), with the accounts and content:
SITE_DIR="$PWD/site" .github/scripts/build-ddev-backdrop-cms.sh

npm run test:examples        # examples and feature steps against the patterns
npx cucumber-js --dry-run    # no undefined or ambiguous step
npm test                     # the whole suite, against https://backdropcmssteps.ddev.site
```

`LAUNCH_URL` points the suite at another site, `FEATURES` runs a subset
(`FEATURES=tests/features/layouts.feature npm test`) and `CUCUMBER_TAGS` a lane
(`CUCUMBER_TAGS=@critical npm test`). The suite leaves the site as it found it:
content, terms, links, files and layout changes a scenario makes, it removes.
Remove the site with `ddev delete -Oy` in `site/`.

## What is not covered

- Comments, revisions, URL redirects, translation and multilingual sites.
- Creating views, content types, fields, vocabularies, menus, roles or accounts
  (the suite never changes the structure or the configuration of the site).
- Layouts with flexible templates, layout contexts and relationships, and
  dragging blocks with the mouse (blocks are moved with the keyboard, the way
  the editor supports it).
- Importing configuration, updates of core and modules, maintenance mode.
- Themes other than Basis and Seven: the steps use the classes core prints, but
  only the stock themes were run.

## License

MIT. See [LICENSE](LICENSE).
