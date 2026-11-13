# Features

Reference features for a standard site with the seeded content
(`.github/scripts/build-ddev-backdrop-cms.sh` builds one). Copy a feature into
your project and replace the titles, menu links and search terms with the
content of your site.

| Feature | Covers |
| --- | --- |
| `session` | Logging in and out with the users registry, the session cookie, refused log ins, password reset, the account menu of the header. |
| `messages-and-validation` | Status, warning and error messages, dismissing them, fields marked as errors, values of fields. |
| `navigation`, `search`, `front-end-content` | Primary navigation and its toggle, breadcrumb, heading, page tabs and the active tab, pager, the search block and results, teasers, tags, blocks, layout template and theme. |
| `access` | Who may open which page; the "Access denied" and "Page not found" pages. |
| `administration-bar`, `administration-pages` | The administration bar, its menus and menu search, on a wide window and on windows where the bar folds its parts away; administration pages by name. |
| `listings` | Filters, sorting, rows, operations and bulk actions of the listings. |
| `content`, `editor`, `images-and-files`, `taxonomy`, `menus` | The life of posts and pages, the rich text editor, image fields and the file listing, terms and tags, menu links. |
| `layouts` | The layout editor: blocks, regions, keyboard moves, visibility conditions, save and cancel. |
| `users-and-roles` | Roles of the site, roles of the accounts, permissions of the roles. |
| `status-and-configuration` | Status report, cron, single configuration export, the import form's validation. |
| `accessibility` | webship-js's structural accessibility checks on stock pages. |

Scenarios that create content, terms, links or files remove them at the end and
start with a "... does not exist" step, so a failed run does not stop the next
one. A scenario that edits a layout starts with "the ... layout has no unsaved
changes".
