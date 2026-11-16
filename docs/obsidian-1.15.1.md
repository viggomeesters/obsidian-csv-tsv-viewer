# Obsidian 1.15.1 assessment — 16 November 2026

Source assessed: `3809295ce1d6e683cae47b337b6ad47b7b30c2a8`, plugin 0.2.0.

[Obsidian desktop 1.15.1](https://obsidian.md/changelog/2026-11-12-desktop-v1.15.1/) changes startup, indexing, hidden-window timers, plugin installation settings and external opening of unrecognized attachments. A targeted source search found no `activeWindow`, Array/String `contains`, `trashFile`, `promptForDeletion`, PIXI or Mermaid use requiring a change. DOM element `contains` is a different API. This bounded search does not establish runtime compatibility.

Local checks passed in a fresh macOS checkout using the existing lockfile and `npm ci --ignore-scripts`. Executed repository scripts: `npm run build`, `npm run test`. Scripts absent from package.json were skipped, not counted as successful tests. Production `main.js` SHA-256: `d28ebb35f7283edf38f0d6e288d58b7bdbc3f9de8d4225f91e2621db91ecd978`. Parser fixtures, test doubles and headless host tests only prove their own tested behavior.

Actual Obsidian 1.15.1 startup, view/file opening, lifecycle and relevant settings remain unverified. No established non-disruptive background connection to a 1.15.1 host was available; the running app and the designated test vault's settings/fixtures were left untouched. No mobile or minimum-version runtime claim follows from these checks. Keep the maintenance issue open for the real-host gate. No release or version bump was made.

Locked-tree npm audit snapshot: `{"info":0,"low":0,"moderate":2,"high":0,"critical":0,"total":2}`. These are whole dependency-tree package counts, not demonstrated runtime exposure; test-only dependencies are included. No broad dependency upgrade or force-fix was applied. Remaining advisories require separate dependency triage.
