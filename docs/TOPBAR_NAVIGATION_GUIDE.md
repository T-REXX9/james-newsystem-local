# Topbar Navigation Guide

This guide explains the topbar navigation system, how it is structured, and how to extend it.

## Menu Structure Overview

- Main menu (Top-level): `HOME`, `WAREHOUSE`, `SALES`, `ACCOUNTING`, `MAINTENANCE`, `COMMUNICATION`
- Submenus (Level 2): Domain groupings like `INVENTORY`, `PURCHASING`, `REPORTS`
- Items (Level 3): Routes that map directly to canonical module IDs

The configuration lives in `utils/topbarMenuConfig.ts` and uses canonical route IDs from `constants.ts`.

## How to Add a New Menu Item

1. Add the route to `AVAILABLE_APP_MODULES` in `constants.ts`.
2. Add the route to `DEFAULT_STAFF_ACCESS_RIGHTS` if it should be visible by default.
3. Add a case in `App.tsx` `renderContent()` to render the view.
4. Add the menu item under the correct submenu in `utils/topbarMenuConfig.ts`.

## Permissions and Access Rights

Topbar items are filtered by `user.access_rights` and role.

- Owners see all modules.
- Users with `*` access see all modules.
- `maintenance-profile-server-maintenance` is restricted to Owner/Developer.
- Legacy aliases from `MODULE_ID_ALIASES` remain supported.

If a menu item is missing for a user, confirm the route ID exists in their `access_rights`.

## Customization Options

- Adjust icons by editing `utils/topbarMenuConfig.ts`.
- Update keyboard shortcuts in `components/TopbarNavigation.tsx`.
- Change layout spacing in `components/TopNav.tsx`.

## Troubleshooting

- Item not visible: add the route ID to `DEFAULT_STAFF_ACCESS_RIGHTS` or the user profile.
- "Coming Soon" page: add a view in `App.tsx` for the route.
- Dropdown overlap issues: verify the topbar uses `z-50` and dropdowns use `z-[60]`.
