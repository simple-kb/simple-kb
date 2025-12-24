# Import Obsidian Skill

This Claude Code skill imports content from an Obsidian vault into the simple-kb knowledge base format.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install @anthropic-ai/sdk
   ```

2. **Set environment variables** in `.env`:
   ```env
   OBSIDIAN_VAULT_IMPORT_FOLDER=C:\path\to\your\obsidian\vault
   ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Run the import**:
   ```bash
   node .claude/skills/import-obsidian/import-obsidian.js
   ```

## What it does

- Scans all `.md` files from the Obsidian vault
- Creates propositions with French, English, and Spanish versions
- Extracts and creates relations between propositions
- Translates content using Claude AI
- Preserves tags and metadata from source files

## Output

Generates files in:
- `/propositions/{uuid}/` - Proposition files (3 per source file: fr, en, es)
- `/relations/{source-uuid}-{target-uuid}/` - Relation files (3 per relation: fr, en, es)

See [skill.md](skill.md) for detailed documentation.
