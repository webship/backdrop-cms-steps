# Step definitions

| File | Covers |
| --- | --- |
| `backdrop.steps.js` | Session and front end: log in and out, messages, form errors, primary navigation, account menu, breadcrumb, heading, page tabs, pager, search, teasers, tags, blocks, layout template, theme, error pages, access to a path. |
| `backdrop-admin.steps.js` | Administration: the administration bar, pages by name, listings, the dialog, confirmation forms, accounts, roles, permissions, status report, cron, configuration manager. |
| `backdrop-content.steps.js` | Content: content forms, fields by label, the rich text editor, publishing and scheduling, vertical tabs, fieldsets, files, terms, menu links. |
| `backdrop-layout.steps.js` | Layouts: the layout editor, blocks, regions, visibility conditions, the list of layouts. |
| `backdrop-helpers.js` | Shared plumbing: wait budget, polling, presence assertions, URLs, the users registry, logging in, messages, named administration pages, table rows and operations, the dialog, form items, the editor. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No platform name in a step pattern, an example or a feature step.
- The regular expression starts with the pronoun group `(I |we )*`, and an
  assertion takes `should( not)*`, so one definition reads both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does (label, visible text, role), with the
  classes and ids core prints as the fallback. Read a name from the page
  source (`textContent`), not as it is drawn (`innerText`): the themes draw
  tabs, table headers and region names in upper case. Wait on what the step reads
  (`poll`, `assertPresence`), never on a fixed time, and fail with
  `friendly({ message, hint })` so the failure says what was expected, what was
  found and where to look.
- A step that names an item of a listing opens the listing itself, so it does
  not depend on the page the scenario was on.
- A step never creates or deletes an account: accounts are configuration, named
  in the `users` registry of `cucumber.js` and created when the site is built.
