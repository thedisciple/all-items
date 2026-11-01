# Contributing

Thanks for helping improve All Items. Please open an issue before substantial changes so the scope and product direction can be discussed. Keep changes focused, preserve privacy by default, and do not include real personal inventory data or credentials in issues, fixtures, or commits.

Use English for code and public documentation; keep all system interface dictionaries complete in Russian, English, Ukrainian, Serbian Latin and Simplified Chinese. Preserve user-entered text without translation. Add or update tests for changed behavior, and run typecheck, lint, tests, and the production build before submitting a pull request. Use concise conventional commit messages. There is no CLA or copyright assignment requirement.

Follow [the design workflow](docs/product/design-workflow.md) for substantial interface work and [AGENTS.md](AGENTS.md) for data/migration boundaries. After a production build, run the relevant isolated Edge acceptance with `npx playwright test --config playwright.acceptance.config.ts`; the development gate remains `npx playwright test`. Record physical-device limitations separately from camera/touch mocks. Test databases, private media, screenshots and backups must stay outside version control, and tests/builds must never migrate configured owner data.
