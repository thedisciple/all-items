# ADR 0002: Minimal workspace-owned item records

- Status: Accepted for M0
- Date: 2026-10-22

## Decision

Give each item a stable UUID and a required workspace UUID, with only a name, optional model/marking, and timestamps in the first migration. Create one default local workspace. Manage schema changes with versioned SQL migrations and Drizzle schema declarations.

## Reasoning

This supports the first create/list/restart slice without baking electronics-specific fields or speculative future platform tables into the schema. Workspace ownership provides a clear boundary for future authorization; UUIDs remain stable if that boundary evolves.

## Consequences

M0 has no inventory number, quantity, category, media, collections, or sale intent. Those fields and behaviors belong to later migrations and milestones.
