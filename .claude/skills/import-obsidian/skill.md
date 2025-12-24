# Import Obsidian Vault (Justice Naturelle)

This skill imports propositions and relations from an Obsidian vault into the simple-kb knowledge base with multilingual support (French, English, Spanish).

## Requirements

- **Node.js** with npm installed
- **@anthropic-ai/sdk**: Install with `npm install @anthropic-ai/sdk`
- **ANTHROPIC_API_KEY**: Set in `.env` file for translations
- **OBSIDIAN_VAULT_IMPORT_FOLDER**: Set in `.env` file

## Instructions

You are tasked with importing content from an Obsidian vault into the simple-kb format.

### Input Files

The skill reads the base folder path from the `.env` file:
- **Environment Variable**: `OBSIDIAN_VAULT_IMPORT_FOLDER` (required)

The skill imports all `.md` files from:
- `{OBSIDIAN_VAULT_IMPORT_FOLDER}/Propositions/` (all subdirectories)
- `{OBSIDIAN_VAULT_IMPORT_FOLDER}/Définitions/`
- `{OBSIDIAN_VAULT_IMPORT_FOLDER}/Citations/`
- `{OBSIDIAN_VAULT_IMPORT_FOLDER}/*.md` (root level files)

### Understanding the Structure

The Obsidian vault contains markdown files with:
- Optional YAML frontmatter with tags
- Main content in markdown format
- Optional relation tables at the end

**Relation tables format**:
```markdown
| Relation     | Proposition               | Détail                        |
| ------------ | ------------------------- | ----------------------------- |
| Implication  | [[Target File Name]]      | Description text              |
| Illustration | [[Another Target]]        | More description              |
```

### Extraction Process

1. **Build UUID map** (CRITICAL STEP):
   - Scan all `.md` files in the vault
   - Generate ONE UUID for each file
   - Store in a map: `{ filename_without_extension → uuid }`
   - This ensures all three languages use the **same UUID** for the same proposition

2. **Parse all files**:
   - Extract title from filename (remove `.md` extension)
   - Determine proposition type based on folder and tags
   - Extract content (remove YAML frontmatter and relation tables)
   - Parse relation tables to extract relations

3. **Create proposition files** in `/propositions/{uuid}/`:
   ```
   /propositions/
     a1b2c3d4/
       fr-title-slug.md
       en-title-slug.md
       es-title-slug.md
   ```

   Each file contains:
   ```yaml
   ---
   title: "Original Title"
   type: [définition|performative|prescriptive|descriptive|citation] (or omit if no type)
   language: [fr|en|es]
   tags: [preserved from source YAML]
   created: [current date]
   modified: [current date]
   author: TBD
   status: imported
   source_file: "original_filename.md"
   source_folder: "folder/path"
   ---

   [CONTENT in respective language]
   ```

   **Language handling**:
   - French: Original content from source file
   - English: Translated using Claude AI
   - Spanish: Translated using Claude AI

4. **Create relation files** in `/relations/{source-uuid}-{target-uuid}/`:
   ```
   /relations/
     a1b2c3d4-e5f6g7h8/
       fr-a1b2c3d4-e5f6g7h8.md
       en-a1b2c3d4-e5f6g7h8.md
       es-a1b2c3d4-e5f6g7h8.md
   ```

   - For each relation in the table, create a relation file
   - Resolve WikiLinks `[[Target]]` to target file's UUID
   - Skip relations where target file doesn't exist
   - Include "Détail" column text in relation content

### Type Determination

Proposition types are determined by:
- Files in `Définitions/` folder → type: `"définition"`
- Files in `Citations/` folder → type: `"citation"`
- Files with YAML tag `tags: [performatif]` → type: `"performative"`
- Files with YAML tag `tags: [définition]` → type: `"définition"`
- Other files → omit type field entirely

### Slug Generation

Slugs are generated from filenames:
- Remove `.md` extension
- Convert to lowercase
- Remove accents (é→e, è→e, à→a, etc.)
- Replace spaces and special characters with hyphens
- Keep numbers
- Maximum 50 characters
- Examples:
  - `"1. Vie et intégrité physique.md"` → `"1-vie-et-integrite-physique"`
  - `"Condamnation de l'esclavage.md"` → `"condamnation-de-l-esclavage"`

### Content Extraction

From each source file:
1. Remove YAML frontmatter (everything between `---` markers at the start)
2. Remove relation tables (tables with columns: Relation, Proposition, Détail)
3. Remove horizontal rules (`---`) that separate sections
4. Keep all other markdown content including URLs

Example transformation:
```markdown
---
tags:
  - performatif
---
Main content here.

Some more text.
https://example.com/link

---

| Relation | Proposition | Détail |
| -------- | ----------- | ------ |
| Implication | [[Target]] | Description |
```

Becomes:
```markdown
Main content here.

Some more text.
https://example.com/link
```

### Important Notes

- **UUID consistency**: CRITICAL - The same source file must use the same UUID across all languages
- **Preserve tags**: Keep original YAML tags from source files in the generated propositions
- **Translation**: Use Claude AI to translate French content to English and Spanish
- **Validate targets**: Skip relations where the target WikiLink doesn't resolve to an existing file
- **No reverse relations**: Only create relations as explicitly declared in the tables

### Output

After import, report:
- Number of unique propositions
- Number of proposition files created per language (fr, en, es)
- Number of relation files created per language (fr, en, es)
- Any errors or warnings encountered (missing targets, parsing issues, etc.)

### Future Improvements (Deferred)

- Support for updating existing propositions
- Validation of relation types
- Detection of circular dependencies
- Support for additional metadata fields
