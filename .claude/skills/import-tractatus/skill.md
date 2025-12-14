# Import Tractatus Logico-Philosophicus (Multilingual)

This skill imports propositions and relations from Wittgenstein's Tractatus Logico-Philosophicus into the simple-kb knowledge base in three languages: French, English, and Spanish.

## Instructions

You are tasked with importing content from the Tractatus Logico-Philosophicus markdown files (in three languages) into the simple-kb format.

### Input Files

The skill uses the following default file paths:
- **French**: `C:\Users\a.vergnaud\dev\test-import-data-1\fr\Tractatus logico-philosophicus (français).md`
- **English**: `C:\Users\a.vergnaud\dev\test-import-data-1\en\Tractatus Logico-Philosophicus (English).md`
- **Spanish**: `C:\Users\a.vergnaud\dev\test-import-data-1\es\Tratado lógico-filosófico.md`

Users can override these paths by providing command-line arguments:
```bash
node import-tractatus.js [french-file] [english-file] [spanish-file]
```

### Understanding the Structure

The Tractatus uses a decimal numbering system to show hierarchical relationships:

- **Main propositions**: Single digits (1, 2, 3, etc.)
- **Sub-propositions**: Additional decimal digits (1.1, 1.2, 2.01, 2.011, etc.)

**Implication relationships** are determined by the numbering:
- A proposition implies all its direct children (remove last digit to find parent)
- Examples:
  - `1` implies `1.1`, `1.2`, `1.3`
  - `1.1` implies `1.11`, `1.12`, `1.13`
  - `2.01` implies `2.011`, `2.012`
  - `2.012` implies `2.0121`, `2.0122`, `2.0123`

### Extraction Process

1. **Build UUID map** (CRITICAL STEP):
   - Parse the French file first to extract all proposition numbers
   - Generate ONE UUID for each Tractatus number (e.g., "2.01" → "a1b2c3d4")
   - Store in a map: `{ tractatus_number → uuid }`
   - This ensures all three languages use the **same UUID** for the same proposition

2. **Parse all language files**:
   - Format: `**[NUMBER](URL)** TEXT`
   - Extract: proposition number, URL, and text content
   - Parse French, English, and Spanish files

3. **Create proposition files** in `/propositions/{uuid}/`:
   ```
   /propositions/
     a1b2c3d4/
       fr-prop-2-01.md
       en-prop-2-01.md
       es-prop-2-01.md
   ```

   Each file contains:
   ```yaml
   ---
   title: "Proposition [NUMBER]"
   type: descriptive
   language: [fr|en|es]
   tags: [tractatus, wittgenstein]
   created: [current date]
   modified: [current date]
   author: Ludwig Wittgenstein
   status: imported
   original_number: [NUMBER]
   source_url: [URL from markdown]
   ---

   [TEXT CONTENT in respective language]
   ```

4. **Create implication relations** in `/relations/{source-uuid}-{target-uuid}/`:
   ```
   /relations/
     a1b2c3d4-e5f6g7h8/
       fr-a1b2c3d4-e5f6g7h8.md
       en-a1b2c3d4-e5f6g7h8.md
       es-a1b2c3d4-e5f6g7h8.md
   ```

   - For each proposition (except main ones), create an implication relation to its parent
   - Parent is determined by removing the last digit/segment from the number
   - Example: `2.012` → parent is `2.01`
   - Use the same UUIDs from the UUID map

### Important Notes

- **UUID consistency**: CRITICAL - The same proposition number must use the same UUID across all languages
- **Preserve original content**: Keep the text in each language exactly as it appears
- **Handle special cases**: Some propositions may have multiple paragraphs or formatting
- **Track footnotes**: Footnote references (e.g., `[^tlp-note-1_2-0]`) are removed from content
- **Validate structure**: Ensure all parent propositions exist before creating child relations

### Output

After import, report:
- Number of unique propositions
- Number of proposition files created per language (fr, en, es)
- Number of relation files created per language (fr, en, es)
- Any errors or warnings encountered

### Future Improvements (Deferred)

- Import footnote content as separate propositions or metadata
- Handle cross-references between non-hierarchical propositions
- Support for additional languages
- Validation of DAG structure
