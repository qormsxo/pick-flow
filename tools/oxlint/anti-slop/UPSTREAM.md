# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (`main`, 2026-09-10).

Copied from `skills/install-anti-slop/assets/anti-slop` by `.agents/skills/install-anti-slop/scripts/install.mjs`. These blob hashes match that commit:

- `index.ts` `a3876ec07e4548f66ee353096b3ac851b7572f5b`
- `vendor/eslint-stylistic/UPSTREAM.md` `3040694e10e100718e2c43d6b15201a2f1a59016`
- skill `SKILL.md` `8c07e0b5058abbdabdec391064076883eab49d54`

Installed plugin: `tools/oxlint/anti-slop/index.ts`, registered in `.oxlintrc.json`.

Dependencies, pinned exactly: `oxlint@1.87.0`, `@oxlint/plugins@1.87.0`.

## Deviations

- The Effect plugin is not registered. This repository has no direct `effect` dependency.
- `anti-slop/no-runtime-typeof` allows `typeof` inside type predicates. JSON and Redis replies are decoded only in those guards.
- `package.json` in this directory sets `"type": "module"` so Node can load the plugin without a CommonJS warning. The application package stays CommonJS.
- Nested `vendor/eslint-stylistic/` license and provenance are unchanged.
