# Business Configuration Guide

Date: 2026-11-05
Status: Initial configuration and core component integrations completed locally; theme alignment and fresh-client verification pending.

## 1. Purpose

The reusable business template separates business identity and presentation settings from shared application logic.

Royal Shop is the first implementation. Its business configuration is stored in:

`src/config/business.config.js`

## 2. Current Configuration Structure

The configuration currently defines:

- `name`: Public business name.
- `shortName`: Compact business name for limited spaces.
- `tagline`: Business tagline.
- `businessType`: Business category identifier.
- `contact.whatsapp`: WhatsApp contact configuration.
- `contact.phone`: Public phone contact.
- `contact.email`: Public email contact.
- `branding.primaryColor`: Primary brand color.
- `branding.secondaryColor`: Secondary brand color.
- `branding.backgroundColor`: Main background color.

## 3. Configuration Boundaries

This file may contain public business identity, presentation and contact settings.

Never store the following in this file:

- Supabase service-role keys.
- API secrets, access tokens or private credentials.
- Database passwords or private connection strings.
- Customer, order or other private business records.
- Authentication secrets.

Supabase credentials must remain in environment variables and must follow the project's security rules.

## 4. Shared Core vs Business-Specific Content

Shared application components should read business identity and presentation settings from the configuration instead of duplicating hardcoded business names.

Integrated and remaining integration points:

- Header and Footer — integrated with business configuration.
- Admin login and dashboard branding — integrated with business configuration.
- Checkout business name and WhatsApp contact configuration — integrated without changing order workflows.
- Announcement banner — future integration point.
- Search labels and business-specific presentation text where appropriate — future integration points.

Shared workflows such as cart calculations, order validation, authentication and order management must remain independent of a particular business name.

## 5. Client Setup

For a new client implementation:

1. Start from the reviewed reusable project template.
2. Create a separate business configuration.
3. Set the client's public identity and approved contact details.
4. Set business-specific branding.
5. Configure the client's own environment variables and Supabase project.
6. Enable only the business capabilities required by that client.
7. Complete the documented fresh-project setup and verification.

Each client must retain separate credentials, storage and business data.

## 6. Implementation Rules

- Keep the configuration small and easy to understand.
- Do not introduce a complex settings framework for a few business values.
- Do not put operational business rules into branding configuration.
- Keep optional business workflows in separate modules when needed.
- Preserve existing Royal Shop cart, checkout and order-management behavior.
- Update this document whenever configuration fields or responsibilities change.
- Verify each integration with a production build before proceeding to the next component.

## 7. Current Implementation Status

- [x] Initial `src/config/business.config.js` created.
- [x] Header branding integration.
- [x] Footer branding integration.
- [x] Admin Dashboard branding integration.
- [x] Admin Login branding integration.
- [x] Checkout business identity integration.
- [x] Checkout WhatsApp contact configuration integration.
- [x] Production build completed successfully after component integrations.
- [ ] Theme variable alignment.
- [ ] Fresh client configuration verification.
- [ ] Browser-level verification of all integrated branding.

### Verification Notes

- Latest build: Vite completed successfully; 97 modules transformed.
- A bundle-size warning remains because the JavaScript chunk exceeds 500 kB after minification.
- Build success does not establish browser-level or production readiness.
- No database migration, deployment or production setting was changed.

Creating or integrating this configuration does not authorize database changes, deployment or production configuration changes.


## Theme Architecture — Light and Dark Mode

### Approved direction

The reusable business template will support three theme preferences:

- Light: default theme.
- Dark: optional dark theme.
- System: follows the device or operating-system preference.

### Architecture principles

- Business branding colors remain configurable through `business.config.js`.
- Theme-specific presentation colors are managed through CSS custom properties.
- Light and Dark modes use semantic color variables for backgrounds, surfaces, text, borders, and interactive elements.
- Dark Mode must preserve readable contrast and clear visual states.
- Theme preference should persist between visits.
- Theme selection must work consistently across storefront and admin pages.
- Theme behavior must not change authentication, cart, checkout, order, or database workflows.
- Avoid introducing a complex theme framework when CSS variables and a small React theme controller are sufficient.

### Implementation boundary

- Keep Light Mode as the initial default.
- Implement theme support incrementally.
- Do not change database schema or Supabase configuration for theme preference.
- Do not modify business workflows while implementing visual theme support.
- Verify both themes through browser testing before marking the work complete.


### Implementation Progress — 2026-11-05

#### Implemented locally

- Created `src/context/ThemeContext.jsx`.
- Integrated `ThemeProvider` into `src/main.jsx`.
- Added Light, Dark and System preference handling.
- Added local preference persistence with the `royal-shop-theme` key.
- Added operating-system preference detection.
- Added semantic theme variables to `src/index.css`.
- Connected root text color and page backgrounds to semantic theme variables.

#### Current default behavior

- The initial preference is `system` when no valid saved preference exists.
- A valid saved `light`, `dark`, or `system` preference is restored from local storage.
- The resolved visual theme is applied through the root `data-theme` attribute.
- System preference changes are observed while System mode is active.

#### Verification

- Production build completed successfully after global theme integration.
- Latest build: 98 modules transformed.
- Browser-level testing is still pending.
- The JavaScript bundle-size warning above 500 kB remains.

#### Remaining work

- [ ] Add a visible theme selector to shared navigation.
- [ ] Migrate active page styles to semantic theme variables.
- [ ] Verify Light, Dark and System modes in the browser.
- [ ] Verify saved preference after reload.
- [ ] Verify storefront and admin theme consistency.
- [ ] Perform fresh-client configuration verification.

These implementation notes describe local development progress only. They do not establish production readiness.
