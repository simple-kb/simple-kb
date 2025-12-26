const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const {
    ensureDirectories,
    generateUuid8,
    createSlug,
    writePropositionFile,
    writeRelationFile
} = require('../../../lib/kb-utils');

// Default configuration
const TRACTATUS_FOLDER = process.env.TRACTATUS_IMPORT_FOLDER;
if (!TRACTATUS_FOLDER) {
    console.error('Error: TRACTATUS_IMPORT_FOLDER environment variable is not set.');
    console.error('Please set it in your .env file, for example:');
    console.error('TRACTATUS_IMPORT_FOLDER=C:\\\\path\\\\to\\\\your\\\\tractatus\\\\data');
    process.exit(1);
}

const DEFAULT_FILES = {
    fr: path.join(TRACTATUS_FOLDER, 'fr', 'Tractatus logico-philosophicus (français).md'),
    en: path.join(TRACTATUS_FOLDER, 'en', 'Tractatus Logico-Philosophicus (English).md'),
    es: path.join(TRACTATUS_FOLDER, 'es', 'Tratado lógico-filosófico.md')
};

const OUTPUT_DIR = path.resolve(__dirname, '../../..');

// Command line arguments or defaults
const inputFiles = {
    fr: process.argv[2] || DEFAULT_FILES.fr,
    en: process.argv[3] || DEFAULT_FILES.en,
    es: process.argv[4] || DEFAULT_FILES.es
};

console.log('=== Multilingual Tractatus Import ===\n');
console.log('Input files:');
console.log(`  French:  ${inputFiles.fr}`);
console.log(`  English: ${inputFiles.en}`);
console.log(`  Spanish: ${inputFiles.es}\n`);

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
// TRACTATUS-SPECIFIC FUNCTIONS
// ============================================

/**
 * Localized relation text
 */
const RELATION_TEXT = {
    fr: {
        title: (parent, child) => `Implication : ${parent} → ${child}`,
        content: (parent, child) => `La proposition ${parent} implique la proposition ${child} dans la structure hiérarchique du Tractatus.`
    },
    en: {
        title: (parent, child) => `Implication: ${parent} → ${child}`,
        content: (parent, child) => `Proposition ${parent} implies proposition ${child} in the hierarchical structure of the Tractatus.`
    },
    es: {
        title: (parent, child) => `Implicación: ${parent} → ${child}`,
        content: (parent, child) => `La proposición ${parent} implica la proposición ${child} en la estructura jerárquica del Tractatus.`
    }
};

/**
 * Get parent proposition number based on Tractatus decimal hierarchy
 * The Tractatus hierarchy: each digit after the decimal adds a level
 * - "2" -> no parent (main proposition)
 * - "2.01" -> parent is "2" (first digit after decimal)
 * - "2.011" -> parent is "2.01"
 * - "2.0121" -> parent is "2.012"
 */
function getParentNumber(number) {
    if (!number.includes('.')) return null; // Main propositions (1-7) have no parent

    const parts = number.split('.');
    const mainProp = parts[0];
    const decimal = parts[1];

    if (decimal.length === 1) {
        // e.g., "1.1" -> parent is "1"
        return mainProp;
    } else {
        // e.g., "2.01" -> parent is "2", "2.011" -> parent is "2.01", "2.0121" -> parent is "2.012"
        const parentDecimal = decimal.slice(0, -1);
        // Check if removing the last digit leaves us with just zeros that would collapse to main
        // e.g., "2.01" -> decimal is "01", removing last gives "0", but parent should be "2"
        if (parentDecimal === '0' || parentDecimal === '') {
            return mainProp;
        }
        return mainProp + '.' + parentDecimal;
    }
}

/**
 * Parse propositions from Tractatus markdown format
 * Format: **[NUMBER](URL)** TEXT
 */
function parsePropositions(content) {
    const propositions = [];
    const regex = /\*\*\[([0-9.]+)\]\(([^)]+)\)\*\*\s*([\s\S]*?)(?=\*\*\[[0-9.]+\]|\n## |\n# |$)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
        const number = match[1];
        const url = match[2];
        let text = match[3].trim();

        // Remove footnote markers but keep the text
        text = text.replace(/\[\^[^\]]+\]/g, '');

        propositions.push({
            number,
            url,
            text
        });
    }

    return propositions;
}

// ============================================
// MAIN EXECUTION
// ============================================

console.log('Step 1: Parsing French file to build UUID map...');
const frContent = fs.readFileSync(inputFiles.fr, 'utf8');
const frPropositions = parsePropositions(frContent);
console.log(`Found ${frPropositions.length} propositions in French file`);

// CRITICAL: Create UUID map using French propositions as reference
// This ensures all languages use the same UUIDs for the same Tractatus numbers
const uuidMap = new Map();
frPropositions.forEach(prop => {
    const uuid = generateUuid8();
    uuidMap.set(prop.number, uuid);
});
console.log(`Created UUID map with ${uuidMap.size} entries\n`);

// Parse all language files
console.log('Step 2: Parsing all language files...');
const allPropositions = {
    fr: frPropositions,
    en: parsePropositions(fs.readFileSync(inputFiles.en, 'utf8')),
    es: parsePropositions(fs.readFileSync(inputFiles.es, 'utf8'))
};

console.log(`  French:  ${allPropositions.fr.length} propositions`);
console.log(`  English: ${allPropositions.en.length} propositions`);
console.log(`  Spanish: ${allPropositions.es.length} propositions\n`);

// Create maps for quick lookup by number
const propMaps = {
    fr: new Map(allPropositions.fr.map(p => [p.number, p])),
    en: new Map(allPropositions.en.map(p => [p.number, p])),
    es: new Map(allPropositions.es.map(p => [p.number, p]))
};

// Write proposition files for all languages
console.log('Step 3: Creating proposition files...');
let propCount = { fr: 0, en: 0, es: 0 };

// Iterate through the UUID map to ensure consistent processing
uuidMap.forEach((uuid, number) => {
    // Write file for each language if proposition exists
    ['fr', 'en', 'es'].forEach(lang => {
        const prop = propMaps[lang].get(number);
        if (prop) {
            const slug = createSlug(number, 'prop');
            writePropositionFile({
                slug: slug,
                uuid: uuid,
                language: lang,
                title: `Proposition ${number}`,
                type: 'descriptive',
                tags: ['tractatus', 'wittgenstein'],
                author: 'Ludwig Wittgenstein',
                status: 'imported',
                content: prop.text,
                metadata: {
                    original_number: `"${number}"`,
                    source_url: prop.url
                }
            }, OUTPUT_DIR);
            propCount[lang]++;
        }
    });
});

console.log(`  French:  ${propCount.fr} files`);
console.log(`  English: ${propCount.en} files`);
console.log(`  Spanish: ${propCount.es} files\n`);

// Create relation files for all languages
console.log('Step 4: Creating relation files...');
let relCount = { fr: 0, en: 0, es: 0 };

// Iterate through propositions to create relations
uuidMap.forEach((childUuid, number) => {
    const parentNumber = getParentNumber(number);
    if (parentNumber && uuidMap.has(parentNumber)) {
        const parentUuid = uuidMap.get(parentNumber);

        // Create relation file for each language
        ['fr', 'en', 'es'].forEach(lang => {
            const childProp = propMaps[lang].get(number);
            const parentProp = propMaps[lang].get(parentNumber);

            if (childProp && parentProp) {
                writeRelationFile({
                    sourceUuid: parentUuid,
                    targetUuid: childUuid,
                    language: lang,
                    title: RELATION_TEXT[lang].title(parentNumber, number),
                    type: 'implication',
                    source: parentUuid,
                    target: childUuid,
                    author: 'system',
                    status: 'imported',
                    content: RELATION_TEXT[lang].content(parentNumber, number)
                }, OUTPUT_DIR);
                relCount[lang]++;
            }
        });
    }
});

console.log(`  French:  ${relCount.fr} files`);
console.log(`  English: ${relCount.en} files`);
console.log(`  Spanish: ${relCount.es} files\n`);

console.log('=== Import Summary ===');
console.log(`Total propositions: ${uuidMap.size} (with ${propCount.fr + propCount.en + propCount.es} language files)`);
console.log(`Total relations: ${relCount.fr + relCount.en + relCount.es} language files`);
console.log(`Output directory: ${OUTPUT_DIR}`);
