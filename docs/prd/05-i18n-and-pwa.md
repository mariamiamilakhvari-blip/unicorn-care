# PRD 05 — i18n (ka + en) and PWA

## A. i18n

Library: `next-intl` — the App Router-native choice, works in Server Components without a client
provider around the whole tree.

### Routing

Locale-prefixed paths with `ka` as the default and **no prefix for the default locale**:

```
/            → ka
/en          → en
/dashboard   → ka dashboard
/en/dashboard
/p/<token>   → locale resolved from the patient record, not the URL
```

Config in `src/i18n/routing.ts`, `src/i18n/request.ts` (next-intl's expected locations —
these are library-mandated paths and are the one allowed exception to the feature-folder rule;
document it in `CLAUDE.md`).

Message files: `messages/ka.json`, `messages/en.json`. Namespaced by feature:

```json
{
  "common":    { "save": "შენახვა", "cancel": "გაუქმება" },
  "auth":      { ... },
  "patient":   { ... },
  "procedure": { ... },
  "carePlan":  { "intensity": { "light": "მსუბუქი", "moderate": "საშუალო", "intense": "ინტენსიური" } },
  "portal":    { ... },
  "push":      { ... }
}
```

Both files must always have identical key sets. Add a `messages.spec.ts` under
`src/shared/lib/` that asserts key parity — a missing Georgian key silently renders an English
key path to a patient otherwise.

### `src/proxy.ts` interaction

`proxy.ts` currently handles auth redirects. next-intl also needs middleware. Compose them in one
`proxy` function: run the locale middleware first, then apply the auth/cookie rules to the
resolved pathname. Keep it Node-module-free (CLAUDE.md §5).

### Locale sources

| Surface | Locale from |
|---|---|
| Marketing / auth pages | URL prefix, default `ka` |
| Clinic dashboard | `Clinic.locale`, URL prefix overrides |
| Patient portal | `Patient.locale` — set by the clinic, patient can switch, persists to the record |
| Push notification text | `Patient.locale` at occurrence-generation time (baked into the stored title/body) |

### Dates and numbers

Use `next-intl`'s `useFormatter` / `getFormatter`, never hand-rolled formatting. Clinic timezone
(`Clinic.timezone`) drives display; storage is always UTC.

## B. PWA

No `next-pwa` plugin — it fights the Next 16 build. Hand-rolled, which is ~40 lines total.

### `public/manifest.webmanifest`

```json
{
  "name": "Unicorn Care",
  "short_name": "Unicorn",
  "start_url": "/p",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0A0A0A",
  "theme_color": "#5B5BFF",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Colours come straight from the locked design direction (§19: base `#0A0A0A`, accent `#5B5BFF`).

### `src/app/layout.tsx`

```ts
export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Unicorn Care' },
};
export const viewport: Viewport = { themeColor: '#5B5BFF' };
```

### Service worker

`public/sw.js` — see PRD 04. Registration is deliberately scoped to the patient portal layout
only; the clinic dashboard does not need offline or push.

Caching in v1: **network-first for navigation, nothing else**. A stale cached care plan is a
clinical hazard. Offline shows an "you are offline" shell, not stale dosing data.

### Install prompt

`beforeinstallprompt` is captured in `use-install-prompt.ts` and surfaced as a button in the
portal header. iOS never fires this event — show the manual "Share → Add to Home Screen" hint
there instead, gated on UA detection.

## C. Brand rename

Part of foundation, not cosmetic — several PRDs reference these values:

- `src/shared/const/app.const.ts` → `APP_NAME = 'Unicorn Care'`, new `APP_DESCRIPTION`
- `src/app/layout.tsx` metadata
- `package.json` `"name": "unicorn-care"`
- Home page copy in `src/features/marketing/components/home-page.tsx` and
  `src/shared/const/home.const.ts` — rewritten for the clinic audience, keeping the locked
  left-aligned typographic hero + stat strip signature.
