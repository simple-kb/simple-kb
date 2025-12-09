const fs = require('fs');
const path = require('path');
const {
    ensureDirectories,
    generateUuid8,
    createSlug,
    writePropositionFile,
    writeRelationFile
} = require('../../../lib/kb-utils');

// Configuration
const INPUT_FILE = process.argv[2];
if (!INPUT_FILE) {
    console.error('Usage: node import-tractatus.js <path-to-tractatus-md-file>');
    process.exit(1);
}

const OUTPUT_DIR = path.resolve(__dirname, '../../..');

// Ensure directories exist
ensureDirectories(OUTPUT_DIR);

// ============================================
// TRACTATUS-SPECIFIC FUNCTIONS
// ============================================

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
            text,
            slug: createSlug(number, 'prop'),
            uuid: generateUuid8()
        });
    }

    return propositions;
}

// ============================================
// MAIN EXECUTION
// ============================================

console.log('Reading input file...');
const content = fs.readFileSync(INPUT_FILE, 'utf8');

console.log('Parsing propositions...');
const propositions = parsePropositions(content);
console.log(`Found ${propositions.length} propositions`);

// Create a map for quick lookup
const propMap = new Map();
propositions.forEach(p => propMap.set(p.number, p));

// Write proposition files
console.log('Creating proposition files...');
let propCount = 0;
propositions.forEach(prop => {
    writePropositionFile({
        slug: prop.slug,
        uuid: prop.uuid,
        title: `Proposition ${prop.number}`,
        type: 'descriptive',
        tags: ['tractatus', 'wittgenstein'],
        author: 'Ludwig Wittgenstein',
        status: 'imported',
        content: prop.text,
        metadata: {
            original_number: `"${prop.number}"`,
            source_url: prop.url
        }
    }, OUTPUT_DIR);
    propCount++;
});
console.log(`Created ${propCount} proposition files`);

// Create relation files
console.log('Creating relation files...');
let relCount = 0;
propositions.forEach(prop => {
    const parentNumber = getParentNumber(prop.number);
    if (parentNumber && propMap.has(parentNumber)) {
        const parent = propMap.get(parentNumber);
        const relSlug = createSlug(`${parent.number}-${prop.number}`, 'impl');

        writeRelationFile({
            slug: relSlug,
            uuid: generateUuid8(),
            title: `Implication: ${parent.number} → ${prop.number}`,
            type: 'implication',
            source: `${parent.slug}-${parent.uuid}`,
            target: `${prop.slug}-${prop.uuid}`,
            author: 'system',
            status: 'imported',
            content: `Proposition ${parent.number} implies proposition ${prop.number} in the hierarchical structure of the Tractatus.`
        }, OUTPUT_DIR);
        relCount++;
    }
});
console.log(`Created ${relCount} relation files`);

console.log('\n=== Import Summary ===');
console.log(`Propositions created: ${propCount}`);
console.log(`Relations created: ${relCount}`);
console.log(`Output directory: ${OUTPUT_DIR}`);
