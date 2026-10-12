---
name: app-version-admin-prototype
description: "Create and iterate interactive app-version or backend management prototypes, especially configuration list pages with filters, sample data, and detail forms."
---

# App Version Admin Prototype

Use this skill for interactive management-backend prototypes where users configure, filter, review, or edit version records. Keep the existing product language and user-requested fields authoritative.

## Select design standard

- Follow [Ant Design Select](https://ant.design/components/select-cn/) for all dropdown single-select and multi-select controls, including filters, sites, form fields, modal fields, dynamic repeater fields, autocomplete version choices and pagination size controls. Keep radio/checkbox groups that are not dropdowns unchanged.
- Use the shared local `select-design.css` and `select-design.js` adapter in this static prototype. Do not mix OS-native dropdown menus with custom dropdown menus or introduce a framework migration solely for styling.
- Standard appearance: 32px minimum control height, 14px text, 6px control radius, #d9d9d9 border, #1677ff focused border with soft blue focus ring; white 8px-radius popup with shadow, 32px option rows, pale #e6f4ff selection, left-aligned labels. Disabled and validation-error states remain distinct.
- Multi-select uses removable neutral tags and right-side selection checkmarks. Keep selections readable through wrapping rather than clipping. Menus scroll when long, align with the triggering control and must not be clipped by tables or dialogs.
- Preserve existing option sources, default values, read-only restrictions, validation and change events. New repeater fields must inherit the same design automatically. Test keyboard navigation, Enter selection, Escape dismissal, empty results, multi-selection/removal, dynamic options, reset and edit restoration.

## Pagination behavior

When a prototype shows a management list, add working pagination unless the user explicitly asks for a static or complete list.

- Put the pagination control directly below the table and align it to the right.
- Default to 10 records per page. Provide a per-page selector, previous/next controls, numbered page buttons, an ellipsis for longer page ranges, and a page-jump input.
- Use compact, square light-gray page buttons; use the product primary blue for the current page; render disabled previous/next controls in a muted state.
- Recalculate pagination against the active site/data partition and active filters. Changing a filter, resetting filters, or switching a site returns to page 1.

## Sample-data baseline

For each independently selectable site or data partition, seed at least 10 realistic sample records so that the default pagination state is demonstrable. When two selections explicitly share data, one common dataset is sufficient. Include enough variation to demonstrate relevant filters and status/update-method states.

## Source control and Pages publishing

Treat implementation, verification, and publication as separate actions.

- Default to local edits and local verification only. Do not commit, push, or publish after ordinary prototype changes.
- Commit and push only when the user explicitly asks to sync to Git. Do not infer Git authorization from a request to change the prototype.
- When the user explicitly asks to sync, publish the static prototype through GitHub Pages and provide the resulting Pages URL after verifying it is live.

## Required HTML link after every update

- After every completed prototype update, include a clickable HTML preview link in the final response, even when the user does not ask for it again. Link to the updated module where possible.
- Verify that the link is reachable and serves the latest local changes before delivering it. Reuse the project's running preview server, or start the local preview if needed; do not substitute an outdated published page for unsynced changes.
- Clearly label localhost links as available only on the current computer. If the preview cannot be started or verified, report the blocker instead of claiming the link works.
- Providing a preview link does not authorize Git synchronization or publishing. Continue to require the user's explicit request for GitHub Pages publication.
