# CLAUDE.md - Project Instructions

## Environment

- **Platform**: Windows
- **Working Directory**: `C:\Users\a.vergnaud\dev\simple-kb`
- **IMPORTANT**: Do not change the working directory
- **IMPORTANT**: Do not work inside the `.claude-worktrees` directory

## Project: simple-kb

### Goal

A Knowledge Base focused on simplicity for storing:

1. **Logical Propositions** - Statements that can be true or false
2. **Relations** - Connections between propositions

Both propositions and relations may have associated **metadata**.

### Design Principles

- Keep it simple
- Minimal dependencies
- Clear data structures

## Data Model

### File Structure

```
/propositions/
  {slug}-{uuid8}.md
/relations/
  {slug}-{uuid8}.md
```

### Proposition File Contains

- title
- type (performative | prescriptive | descriptive)
- content
- tags
- metadata: creation date, modification date, author, status

### Relation File Contains

- title
- type (implication | illustration)
- source: `{slug}-{uuid8}`
- target: `{slug}-{uuid8}`
- metadata: creation date, modification date, author, status

### Naming Rules

- Slug: lowercase, hyphens, max 20 chars, no special characters
- Followed by first 8 characters of UUID
- Example: `my-proposition-a1b2c3d4.md`

### Hierarchy

- "implication" relations form a DAG (determines ordering)
- "illustration" relations are outside the hierarchy

### Deferred Topics

- Tooling for title/slug changes
- Programmatic processing
- Search features
