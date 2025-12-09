# Import Tractatus Logico-Philosophicus

This skill imports propositions and relations from Wittgenstein's Tractatus Logico-Philosophicus into the simple-kb knowledge base.

## Instructions

You are tasked with importing content from the Tractatus Logico-Philosophicus markdown file into the simple-kb format.

### Input File

Ask the user: "Where is the Tractatus md file located?"

Wait for the user to provide the file path before proceeding with the import.

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

1. **Parse propositions** from the markdown file
   - Format: `**[NUMBER](URL)** TEXT`
   - Extract: proposition number, URL, and text content
   - Continue reading until the next proposition or section boundary

2. **Generate filenames** for each proposition:
   - Create slug from proposition number: `prop-X-Y-Z` (e.g., `prop-1-1-11` for 1.1.11)
   - Generate 8-character UUID prefix
   - Filename: `{slug}-{uuid8}.md`

3. **Create proposition files** in `/propositions/`:
   ```yaml
   ---
   title: "Proposition [NUMBER]"
   type: descriptive
   tags: [tractatus, wittgenstein]
   created: [current date]
   modified: [current date]
   author: Ludwig Wittgenstein
   status: imported
   original_number: [NUMBER]
   source_url: [URL from markdown]
   ---

   [TEXT CONTENT]
   ```

4. **Create implication relations** in `/relations/`:
   - For each proposition (except main ones), create an implication relation to its parent
   - Parent is determined by removing the last digit/segment from the number
   - Example: `2.012` → parent is `2.01`

   ```yaml
   ---
   title: "Implication: [PARENT_NUMBER] → [CHILD_NUMBER]"
   type: implication
   source: {parent-slug}-{parent-uuid8}
   target: {child-slug}-{child-uuid8}
   created: [current date]
   modified: [current date]
   author: system
   status: imported
   ---

   Proposition [PARENT_NUMBER] implies proposition [CHILD_NUMBER] in the hierarchical structure of the Tractatus.
   ```

### Important Notes

- **Preserve original content**: Keep the French text exactly as it appears
- **Handle special cases**: Some propositions may have multiple paragraphs or formatting
- **Track footnotes**: Note any footnote references (e.g., `[^tlp-note-1_2-0]`) in metadata
- **Validate structure**: Ensure all parent propositions exist before creating child relations
- **Generate unique UUIDs**: Each file needs a unique 8-character UUID prefix

### Output

After import, report:
- Number of propositions created
- Number of implication relations created
- Any errors or warnings encountered
- Sample of created files for verification

### Future Improvements (Deferred)

- Import footnote content as separate propositions or metadata
- Handle cross-references between non-hierarchical propositions
- Support for multiple languages/translations
- Validation of DAG structure
