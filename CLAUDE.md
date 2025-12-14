# CLAUDE.md - Project Instructions

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
  {uuid8}/
    {lang}-{slug}.md
    {lang}-{slug}.md
/relations/
  {source-uuid8}-{target-uuid8}/
    {lang}-{source-uuid8}-{target-uuid8}.md
    {lang}-{source-uuid8}-{target-uuid8}.md
```

**Examples:**
```
/propositions/
  a1b2c3d4/
    fr-le-monde.md
    en-the-world.md
/relations/
  a1b2c3d4-e5f6g7h8/
    fr-a1b2c3d4-e5f6g7h8.md
    en-a1b2c3d4-e5f6g7h8.md
```

### Proposition File Contains

- title
- type (see [/config/proposition-types.md](config/proposition-types.md))
- language (ISO 639-1 code: fr, en, es, etc.)
- content
- tags
- metadata: creation date, modification date, author, status

**Multilingual Support:**
- Each proposition has a unique 8-character UUID
- Multiple language versions live in the same UUID directory
- All metadata is duplicated in each language file
- Slugs can differ per language (e.g., `fr-le-monde.md` vs `en-the-world.md`)

### Relation File Contains

- title
- type (see [/config/relation-types.md](config/relation-types.md))
- language (ISO 639-1 code: fr, en, es, etc.)
- source: `{uuid8}` (language-agnostic)
- target: `{uuid8}` (language-agnostic)
- metadata: creation date, modification date, author, status

**Multilingual Support:**
- Each relation has a unique directory named `{source-uuid8}-{target-uuid8}`
- Multiple language versions live in the same relation directory
- All metadata is duplicated in each language file
- Title and content can differ per language

### Naming Rules

**Propositions:**
- UUID: 8 characters (first 8 chars of a generated UUID)
- Language: ISO 639-1 code (fr, en, es, etc.)
- Slug: lowercase, hyphens, max 20 chars, no special characters
- Format: `{lang}-{slug}.md`
- Example: `fr-ma-proposition.md`

**Relations:**
- Directory format: `{source-uuid8}-{target-uuid8}/`
- File format: `{lang}-{source-uuid8}-{target-uuid8}.md`
- Example: `fr-a1b2c3d4-e5f6g7h8.md`
- References (source/target) are language-agnostic (UUID only)

### Hierarchy

- "implication" relations form a DAG (determines ordering)
- "illustration" relations are outside the hierarchy

### Deferred Topics

- Tooling for title/slug changes
- Programmatic processing
- Search features
