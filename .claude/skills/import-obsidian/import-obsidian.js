const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const {
    ensureDirectories,
    generateUuid8,
    writePropositionFile,
    writeRelationFile
} = require('../../../lib/kb-utils');

// Default configuration
const OBSIDIAN_FOLDER = process.env.OBSIDIAN_VAULT_IMPORT_FOLDER;
if (!OBSIDIAN_FOLDER) {
    console.error('Error: OBSIDIAN_VAULT_IMPORT_FOLDER environment variable is not set.');
    console.error('Please set it in your .env file, for example:');
    console.error('OBSIDIAN_VAULT_IMPORT_FOLDER=C:\\\\path\\\\to\\\\your\\\\obsidian\\\\vault');
    process.exit(1);
}

const OUTPUT_DIR = path.resolve(__dirname, '../../..');

console.log('=== Obsidian Vault Import (Justice Naturelle) ===\n');
console.log(`Input folder: ${OBSIDIAN_FOLDER}\n`);

// Clear existing propositions and relations folders
const propsDir = path.join(OUTPUT_DIR, 'propositions');
const relsDir = path.join(OUTPUT_DIR, 'relations');

console.log('Clearing existing propositions and relations folders...');
if (fs.existsSync(propsDir)) {
    fs.rmSync(propsDir, { recursive: true, force: true });
    console.log('  Deleted propositions/');
}
if (fs.existsSync(relsDir)) {
    fs.rmSync(relsDir, { recursive: true, force: true });
    console.log('  Deleted relations/');
}
console.log('');

// Ensure directories exist
ensureDirectories(OUTPUT_DIR);

// ============================================
// OBSIDIAN-SPECIFIC FUNCTIONS
// ============================================

/**
 * Create slug from filename
 * - Remove .md extension
 * - Lowercase
 * - Remove accents
 * - Replace spaces/special chars with hyphens
 * - Keep numbers
 * - Max 50 chars
 */
function createObsidianSlug(filename) {
    // Remove .md extension
    let slug = filename.replace(/\.md$/i, '');

    // Remove accents
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Lowercase and replace spaces/special chars with hyphens
    slug = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Truncate to 50 chars
    return slug.substring(0, 50).replace(/-$/, '');
}

/**
 * Recursively find all .md files in a directory
 */
function findMarkdownFiles(dir, baseDir = dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Skip .obsidian directory
            if (entry.name !== '.obsidian') {
                files.push(...findMarkdownFiles(fullPath, baseDir));
            }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            // Get relative path from base directory
            const relativePath = path.relative(baseDir, fullPath);
            const relativeDir = path.dirname(relativePath);

            files.push({
                fullPath,
                filename: entry.name,
                relativePath,
                relativeDir: relativeDir === '.' ? '' : relativeDir
            });
        }
    }

    return files;
}

/**
 * Determine proposition type based on folder and tags
 */
function determineType(relativeDir, tags) {
    // Check folder-based types first
    if (relativeDir.includes('Définitions')) {
        return 'définition';
    }
    if (relativeDir.includes('Citations')) {
        return 'citation';
    }

    // Check tag-based types
    if (tags.includes('performatif')) {
        return 'performative';
    }
    if (tags.includes('définition')) {
        return 'définition';
    }

    // No type
    return null;
}

/**
 * Extract YAML frontmatter and tags
 */
function extractFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { tags: [], contentWithoutFrontmatter: content };
    }

    const frontmatter = match[1];
    const contentWithoutFrontmatter = content.substring(match[0].length);

    // Extract tags
    const tags = [];
    const tagsMatch = frontmatter.match(/tags:\s*\n((?:\s+-\s+.+\n?)+)/);
    if (tagsMatch) {
        const tagLines = tagsMatch[1].trim().split('\n');
        for (const line of tagLines) {
            const tag = line.trim().replace(/^-\s+/, '');
            if (tag) tags.push(tag);
        }
    }

    return { tags, contentWithoutFrontmatter };
}

/**
 * Extract relation tables from content
 * Returns: { cleanContent, relations: [{type, target, detail}] }
 */
function extractRelations(content) {
    const relations = [];

    // Match relation tables
    // Format: | Relation | Proposition | Détail |
    const tableRegex = /\|\s*Relation\s*\|\s*Proposition\s*\|\s*Détail\s*\|\s*\n\|[-\s|]+\|\s*\n((?:\|[^|]*\|[^|]*\|[^|]*\|\s*\n?)+)/gi;

    let cleanContent = content;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
        const tableRows = match[1];
        const rowRegex = /\|\s*([^|]+)\s*\|\s*\[\[([^\]]+)\]\]\s*\|\s*([^|]*)\s*\|/g;

        let rowMatch;
        while ((rowMatch = rowRegex.exec(tableRows)) !== null) {
            const relationType = rowMatch[1].trim();
            const targetWikiLink = rowMatch[2].trim();
            const detail = rowMatch[3].trim();

            relations.push({
                type: relationType.toLowerCase(),
                target: targetWikiLink,
                detail
            });
        }

        // Remove the table from content
        cleanContent = cleanContent.replace(match[0], '');
    }

    // Remove any standalone horizontal rules (---) that might separate sections
    cleanContent = cleanContent.replace(/\n---\n/g, '\n\n');

    // Clean up extra whitespace
    cleanContent = cleanContent.trim();

    return { cleanContent, relations };
}

/**
 * Translate text using Claude via Anthropic SDK
 */
async function translateWithClaude(text, targetLanguage) {
    // Check if Anthropic SDK is available
    let Anthropic;
    try {
        Anthropic = require('@anthropic-ai/sdk');
    } catch (e) {
        console.error('Warning: @anthropic-ai/sdk not installed. Skipping translation.');
        console.error('Install with: npm install @anthropic-ai/sdk');
        return `[NOT TRANSLATED: ${text.substring(0, 50)}...]`;
    }

    const languageNames = {
        en: 'English',
        es: 'Spanish'
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('Warning: ANTHROPIC_API_KEY not set. Skipping translation.');
        return `[NOT TRANSLATED: ${text.substring(0, 50)}...]`;
    }

    const anthropic = new Anthropic({ apiKey });

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `Translate the following French text to ${languageNames[targetLanguage]}. Only output the translation, nothing else:\n\n${text}`
            }]
        });

        return message.content[0].text.trim();
    } catch (error) {
        console.error(`Translation error for ${targetLanguage}:`, error.message);
        return `[TRANSLATION ERROR: ${text.substring(0, 50)}...]`;
    }
}

/**
 * Localized relation text
 */
const RELATION_TEXT = {
    fr: {
        title: (sourceTitle, targetTitle, type) => {
            const typeText = type === 'implication' ? 'Implication' : 'Illustration';
            return `${typeText} : ${sourceTitle} → ${targetTitle}`;
        },
        content: (sourceTitle, targetTitle, type, detail) => {
            const typeText = type === 'implication' ? 'implique' : 'illustre';
            let text = `La proposition "${sourceTitle}" ${typeText} la proposition "${targetTitle}".`;
            if (detail) {
                text += `\n\n${detail}`;
            }
            return text;
        }
    },
    en: {
        title: (sourceTitle, targetTitle, type) => {
            const typeText = type === 'implication' ? 'Implication' : 'Illustration';
            return `${typeText}: ${sourceTitle} → ${targetTitle}`;
        },
        content: (sourceTitle, targetTitle, type, detail) => {
            const typeText = type === 'implication' ? 'implies' : 'illustrates';
            let text = `The proposition "${sourceTitle}" ${typeText} the proposition "${targetTitle}".`;
            if (detail) {
                text += `\n\n${detail}`;
            }
            return text;
        }
    },
    es: {
        title: (sourceTitle, targetTitle, type) => {
            const typeText = type === 'implication' ? 'Implicación' : 'Ilustración';
            return `${typeText}: ${sourceTitle} → ${targetTitle}`;
        },
        content: (sourceTitle, targetTitle, type, detail) => {
            const typeText = type === 'implication' ? 'implica' : 'ilustra';
            let text = `La proposición "${sourceTitle}" ${typeText} la proposición "${targetTitle}".`;
            if (detail) {
                text += `\n\n${detail}`;
            }
            return text;
        }
    }
};

// ============================================
// MAIN EXECUTION
// ============================================

console.log('Step 1: Scanning for markdown files...');
const allFiles = findMarkdownFiles(OBSIDIAN_FOLDER);
console.log(`Found ${allFiles.length} markdown files\n`);

// Build UUID map: filename (without .md) -> UUID
console.log('Step 2: Building UUID map...');
const uuidMap = new Map();
const fileDataMap = new Map();

for (const file of allFiles) {
    const filenameWithoutExt = file.filename.replace(/\.md$/i, '');
    const uuid = generateUuid8();
    uuidMap.set(filenameWithoutExt, uuid);

    // Read and parse file
    const content = fs.readFileSync(file.fullPath, 'utf8');
    const { tags, contentWithoutFrontmatter } = extractFrontmatter(content);
    const { cleanContent, relations } = extractRelations(contentWithoutFrontmatter);

    const title = filenameWithoutExt;
    const slug = createObsidianSlug(file.filename);
    const type = determineType(file.relativeDir, tags);

    fileDataMap.set(filenameWithoutExt, {
        uuid,
        title,
        slug,
        type,
        tags,
        content: cleanContent,
        relations,
        sourceFile: file.filename,
        sourceFolder: file.relativeDir
    });
}

console.log(`Created UUID map with ${uuidMap.size} entries\n`);

// Create proposition files for all languages
console.log('Step 3: Creating proposition files...');
let propCount = { fr: 0, en: 0, es: 0 };

async function createPropositions() {
    for (const [filename, data] of fileDataMap.entries()) {
        console.log(`Processing: ${filename}`);

        // French (original)
        const frenchProp = {
            uuid: data.uuid,
            slug: data.slug,
            language: 'fr',
            title: data.title,
            type: data.type,
            tags: data.tags,
            author: 'TBD',
            status: 'imported',
            content: data.content,
            metadata: {
                source_file: `"${data.sourceFile}"`,
                source_folder: data.sourceFolder ? `"${data.sourceFolder}"` : '""'
            }
        };

        // Omit type field if null
        if (!frenchProp.type) {
            delete frenchProp.type;
        }

        writePropositionFile(frenchProp, OUTPUT_DIR);
        propCount.fr++;

        // English (translated)
        console.log(`  Translating to English...`);
        const englishTitle = await translateWithClaude(data.title, 'en');
        const englishContent = await translateWithClaude(data.content, 'en');

        const englishProp = {
            uuid: data.uuid,
            slug: data.slug,
            language: 'en',
            title: englishTitle,
            type: data.type ? (data.type === 'définition' ? 'definition' :
                              data.type === 'citation' ? 'quote' : data.type) : undefined,
            tags: data.tags,
            author: 'TBD',
            status: 'imported',
            content: englishContent,
            metadata: {
                source_file: `"${data.sourceFile}"`,
                source_folder: data.sourceFolder ? `"${data.sourceFolder}"` : '""'
            }
        };

        if (!englishProp.type) {
            delete englishProp.type;
        }

        writePropositionFile(englishProp, OUTPUT_DIR);
        propCount.en++;

        // Spanish (translated)
        console.log(`  Translating to Spanish...`);
        const spanishTitle = await translateWithClaude(data.title, 'es');
        const spanishContent = await translateWithClaude(data.content, 'es');

        const spanishProp = {
            uuid: data.uuid,
            slug: data.slug,
            language: 'es',
            title: spanishTitle,
            type: data.type ? (data.type === 'définition' ? 'definición' :
                              data.type === 'citation' ? 'cita' : data.type) : undefined,
            tags: data.tags,
            author: 'TBD',
            status: 'imported',
            content: spanishContent,
            metadata: {
                source_file: `"${data.sourceFile}"`,
                source_folder: data.sourceFolder ? `"${data.sourceFolder}"` : '""'
            }
        };

        if (!spanishProp.type) {
            delete spanishProp.type;
        }

        writePropositionFile(spanishProp, OUTPUT_DIR);
        propCount.es++;

        // Store translations for later use in relations
        data.translations = {
            en: { title: englishTitle, content: englishContent },
            es: { title: spanishTitle, content: spanishContent }
        };
    }
}

// Create relation files
async function createRelations() {
    console.log('\nStep 4: Creating relation files...');
    let relCount = { fr: 0, en: 0, es: 0 };
    let skippedCount = 0;

    for (const sourceData of fileDataMap.values()) {
        for (const relation of sourceData.relations) {
            const targetFilename = relation.target;

            // Check if target exists
            if (!uuidMap.has(targetFilename)) {
                console.log(`  Warning: Skipping relation - target not found: ${targetFilename}`);
                skippedCount++;
                continue;
            }

            const targetData = fileDataMap.get(targetFilename);
            const sourceUuid = sourceData.uuid;
            const targetUuid = targetData.uuid;

            // Determine relation type
            const relationType = relation.type === 'implication' ? 'implication' : 'illustration';

            // Create relation for each language
            for (const lang of ['fr', 'en', 'es']) {
                const sourceTitle = lang === 'fr' ? sourceData.title : sourceData.translations[lang].title;
                const targetTitle = lang === 'fr' ? targetData.title : targetData.translations[lang].title;
                const detail = lang === 'fr' ? relation.detail :
                              await translateWithClaude(relation.detail, lang);

                writeRelationFile({
                    sourceUuid,
                    targetUuid,
                    language: lang,
                    title: RELATION_TEXT[lang].title(sourceTitle, targetTitle, relationType),
                    type: relationType === 'implication' ? (lang === 'es' ? 'implicación' : 'implication') :
                          (lang === 'fr' ? 'illustration' : lang === 'es' ? 'ilustración' : 'illustration'),
                    source: sourceUuid,
                    target: targetUuid,
                    author: 'system',
                    status: 'imported',
                    content: RELATION_TEXT[lang].content(sourceTitle, targetTitle, relationType, detail)
                }, OUTPUT_DIR);

                relCount[lang]++;
            }
        }
    }

    console.log(`  French:  ${relCount.fr} files`);
    console.log(`  English: ${relCount.en} files`);
    console.log(`  Spanish: ${relCount.es} files`);
    if (skippedCount > 0) {
        console.log(`  Skipped: ${skippedCount} relations (target not found)\n`);
    }

    return relCount;
}

// Run the async import
(async () => {
    await createPropositions();

    console.log(`  French:  ${propCount.fr} files`);
    console.log(`  English: ${propCount.en} files`);
    console.log(`  Spanish: ${propCount.es} files\n`);

    const relCount = await createRelations();

    console.log('\n=== Import Summary ===');
    console.log(`Total propositions: ${uuidMap.size} (with ${propCount.fr + propCount.en + propCount.es} language files)`);
    console.log(`Total relations: ${relCount.fr + relCount.en + relCount.es} language files`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
})();
