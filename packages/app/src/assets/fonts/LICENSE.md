# Bundled fonts

Both fonts below are licensed under the **SIL Open Font License, Version 1.1**
(<https://scripts.sil.org/OFL>), which permits bundling and redistribution.

## Caveat — `caveat-latin.woff2`

- Designer: Impallari Type (Pablo Impallari)
- Source: Google Fonts (<https://fonts.google.com/specimen/Caveat>)
- Subset: Latin only (variable-weight file, used across 400–700)

## Patrick Hand — `patrick-hand-latin.woff2`

- Designer: Patrick Wagesreiter
- Source: Google Fonts (<https://fonts.google.com/specimen/Patrick+Hand>)
- Subset: Latin only

Only the Latin subset of each face is bundled to keep the payload small. No
external font-CDN request is made at runtime; the app self-hosts these via
`@font-face` in `styles.css`.
