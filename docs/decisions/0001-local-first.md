# ADR 0001: Local-first single-owner application

- Status: Accepted for M0
- Date: 2026-10-22

## Decision

Run one Node.js application on loopback and store the SQLite database in an application-owned directory outside the repository. Do not require a remote service for core inventory operation.

## Reasoning

The initial product must be useful to a single local owner, preserve privacy by default, and remain straightforward to install on Windows. This avoids a cloud account and prevents private inventory files from entering Git.

## Consequences

The local server is unauthenticated and must remain loopback-only. LAN access, device-local offline operation, and synchronization are not provided. Production deployment beyond the owner's machine requires a later secure design.
