# Contributing

Thanks for helping improve CSV TSV Viewer.

## Local setup

```bash
npm install
npm run build
npx tsc --noEmit
npm test
```

For manual testing, copy the repository into `.obsidian/plugins/csv-tsv-viewer/` in a test vault, reload the app, and open `.csv` and `.tsv` files.

## Pull requests

- Keep the plugin read-only.
- Do not add network APIs in runtime plugin code.
- Do not add clipboard access without explicit user action and documentation.
- Preserve parser fixture coverage for quoted fields, escaped quotes, multiline fields, and delimiter detection.
- Run build, typecheck, and tests before opening a PR.

## Release assets

Community releases must include:

- `main.js`
- `manifest.json`
- `styles.css`
