const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Default output directory (can be overridden)
const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '..');
const PROPOSITIONS_DIR = path.join(DEFAULT_OUTPUT_DIR, 'propositions');
const RELATIONS_DIR = path.join(DEFAULT_OUTPUT_DIR, 'relations');

/**
 * Ensure propositions and relations directories exist
 */
function ensureDirectories(outputDir = DEFAULT_OUTPUT_DIR) {
    const propsDir = path.join(outputDir, 'propositions');
    const relsDir = path.join(outputDir, 'relations');
    if (!fs.existsSync(propsDir)) fs.mkdirSync(propsDir, { recursive: true });
    if (!fs.existsSync(relsDir)) fs.mkdirSync(relsDir, { recursive: true });
    return { propsDir, relsDir };
}

/**
 * Generate 8-character UUID
 */
function generateUuid8() {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 8);
}

/**
 * Create slug from a title or identifier
 * - lowercase
 * - hyphens instead of spaces/dots
 * - max 20 chars
 * - no special characters
 */
function createSlug(text, prefix = '') {
    let slug = text
        .toLowerCase()
        .replace(/\./g, '-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 20);

    if (prefix) {
        slug = prefix + '-' + slug;
    }
    return slug;
}

/**
 * Create proposition file content
 * @param {Object} prop - Proposition data
 * @param {string} prop.title - Title of the proposition
 * @param {string} prop.type - Type: performative | prescriptive | descriptive
 * @param {string} prop.content - The proposition text content
 * @param {string[]} prop.tags - Array of tags
 * @param {string} prop.author - Author name
 * @param {string} prop.language - Language code (e.g., 'fr', 'en', 'es')
 * @param {Object} prop.metadata - Additional metadata fields
 */
function createPropositionContent(prop) {
    const today = new Date().toISOString().split('T')[0];

    let frontmatter = `---
title: "${prop.title}"
type: ${prop.type || 'descriptive'}
language: ${prop.language || 'fr'}
tags: [${(prop.tags || []).join(', ')}]
created: ${today}
modified: ${today}
author: ${prop.author || 'unknown'}
status: ${prop.status || 'imported'}`;

    // Add any additional metadata fields
    if (prop.metadata) {
        for (const [key, value] of Object.entries(prop.metadata)) {
            if (typeof value === 'string') {
                frontmatter += `\n${key}: ${value}`;
            } else {
                frontmatter += `\n${key}: ${JSON.stringify(value)}`;
            }
        }
    }

    frontmatter += '\n---\n\n';

    return frontmatter + (prop.content || '');
}

/**
 * Create relation file content
 * @param {Object} relation - Relation data
 * @param {string} relation.title - Title of the relation
 * @param {string} relation.type - Type: implication | illustration
 * @param {string} relation.source - Source proposition UUID
 * @param {string} relation.target - Target proposition UUID
 * @param {string} relation.language - Language code (e.g., 'fr', 'en', 'es')
 * @param {string} relation.content - Optional description
 */
function createRelationContent(relation) {
    const today = new Date().toISOString().split('T')[0];

    return `---
title: "${relation.title}"
type: ${relation.type || 'implication'}
language: ${relation.language || 'fr'}
source: ${relation.source}
target: ${relation.target}
created: ${today}
modified: ${today}
author: ${relation.author || 'system'}
status: ${relation.status || 'imported'}
---

${relation.content || ''}
`;
}

/**
 * Write a proposition file
 * @param {Object} prop - Proposition with slug, uuid, and language
 * @param {string} prop.uuid - 8-character UUID
 * @param {string} prop.slug - Slug for the proposition
 * @param {string} prop.language - Language code (e.g., 'fr', 'en', 'es')
 * @param {string} outputDir - Output directory
 * @returns {string} - The filepath created
 */
function writePropositionFile(prop, outputDir = DEFAULT_OUTPUT_DIR) {
    const language = prop.language || 'fr';
    const propDir = path.join(outputDir, 'propositions', prop.uuid);

    // Create UUID directory if it doesn't exist
    if (!fs.existsSync(propDir)) {
        fs.mkdirSync(propDir, { recursive: true });
    }

    const filename = `${language}-${prop.slug}.md`;
    const filepath = path.join(propDir, filename);
    fs.writeFileSync(filepath, createPropositionContent(prop));
    return filepath;
}

/**
 * Write a relation file
 * @param {Object} relation - Relation data with source and target UUIDs
 * @param {string} relation.sourceUuid - Source proposition UUID (8 chars)
 * @param {string} relation.targetUuid - Target proposition UUID (8 chars)
 * @param {string} relation.language - Language code (e.g., 'fr', 'en', 'es')
 * @param {string} outputDir - Output directory
 * @returns {string} - The filepath created
 */
function writeRelationFile(relation, outputDir = DEFAULT_OUTPUT_DIR) {
    const language = relation.language || 'fr';
    const relDirName = `${relation.sourceUuid}-${relation.targetUuid}`;
    const relDir = path.join(outputDir, 'relations', relDirName);

    // Create relation directory if it doesn't exist
    if (!fs.existsSync(relDir)) {
        fs.mkdirSync(relDir, { recursive: true });
    }

    const filename = `${language}-${relDirName}.md`;
    const filepath = path.join(relDir, filename);
    fs.writeFileSync(filepath, createRelationContent(relation));
    return filepath;
}

module.exports = {
    ensureDirectories,
    generateUuid8,
    createSlug,
    createPropositionContent,
    createRelationContent,
    writePropositionFile,
    writeRelationFile,
    DEFAULT_OUTPUT_DIR,
    PROPOSITIONS_DIR,
    RELATIONS_DIR
};
