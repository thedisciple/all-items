# Dependency maintenance - M3.2-R1

Checked on 2026-10-23. This milestone changes ESLint and its required dependency graph, without upgrading the application framework, React, database client or media processor.

## ESLint and Node

ESLint is now 10.13.0, the latest 10.x release reported by npm at validation time. The existing flat configuration and typescript-eslint 8.72.0 support ESLint 10 without dropping rules. The reviewed [official migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) covers the Node floor, removal of legacy configuration/APIs, configuration lookup and JSX scope changes. This project has no custom lint rules, legacy config or deprecated ESLint API calls. [typescript-eslint's supported versions](https://typescript-eslint.io/users/dependency-versions/) include ESLint 10 and TypeScript 5.9.

The package engine range matches ESLint: Node ^20.19, ^22.13 or >=24. Local validation uses Node 24.20.0. GitHub Actions setup-node selects the current 22.x release, satisfying the 22.13 floor. The existing CI commands remain npm ci, typecheck, lint, isolated unit tests and build. A fresh installation from the lockfile is checked separately; dependency installation never starts the application or migrates configured data.

## Next.js notice

Next.js 15.5.28 still reports that its ESLint plugin is absent during build. The matching @next/eslint-plugin-next 15.5.28 was evaluated, but npm audit reported four high-severity dependency findings through fast-glob/micromatch/braces ([advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). It was removed from the final package and lockfile. No old plugin downgrade, forced override or disabled lint integration was added. Standalone ESLint remains a required CI/build-review check. Revisit the notice when a compatible plugin has a safe dependency graph; this is an intentional remaining development notice, not a suppressed lint failure.

## Database-client deprecation

The current chain remains @libsql/client 0.15.15 -> @libsql/hrana-client 0.7.0 -> node-fetch 3.3.2 -> fetch-blob 3.2.0 -> deprecated node-domexception 1.0.0. npm metadata shows client 0.18.0 uses hrana-client 0.10.0, whose dependency list no longer contains node-fetch. No newer compatible 0.15 patch removes the chain. Moving across pre-1.0 client release lines needs a separate driver/native-library regression review; this milestone does not upgrade that stack solely to remove a nonblocking warning. No forced override or manual dependency deletion is used. The final npm audit reports zero vulnerabilities; deprecation and vulnerability status are distinct findings.
