// ═══════════════════════════════════════════════════
//  Code Generation Service
//  Fetches real theme code and generates targeted fixes
//  Available: PRO (suggest only) + AGENCY (auto-apply)
// ═══════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';
import { createShopifyClient } from './shopify.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Shopify theme file registry ──────────────────────
// Maps issue types to which theme files to fetch
const ISSUE_FILE_MAP = {
  'CONVERSION': ['sections/main-product.liquid', 'snippets/product-form.liquid', 'assets/theme.css'],
  'MOBILE':     ['assets/theme.css', 'assets/base.css', 'layout/theme.liquid'],
  'SPEED':      ['layout/theme.liquid', 'assets/theme.js'],
  'LAYOUT':     ['sections/main-product.liquid', 'assets/theme.css'],
};

// ── Fetch active theme ID ─────────────────────────────
async function getActiveThemeId(client) {
  const { data } = await client.get('/themes.json');
  const active = data.themes?.find(t => t.role === 'main');
  return active?.id || null;
}

// ── Fetch a specific theme asset file ────────────────
async function fetchThemeAsset(client, themeId, assetKey) {
  try {
    const { data } = await client.get(
      `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`
    );
    return data.asset?.value || null;
  } catch (err) {
    logger.warn(`Could not fetch theme asset ${assetKey}: ${err.message}`);
    return null;
  }
}

// ── Write a fix file to Shopify theme ────────────────
async function writeThemeAsset(client, themeId, assetKey, content) {
  const { data } = await client.put(`/themes/${themeId}/assets.json`, {
    asset: { key: assetKey, value: content },
  });
  return data.asset;
}

// ─────────────────────────────────────────────────────
//  MAIN: Generate fix code for a visual issue
// ─────────────────────────────────────────────────────
export async function generateFixCode(issue, merchant) {
  logger.info(`Generating fix code for: ${issue.title}`);

  const client  = createShopifyClient(merchant.shopDomain, merchant.accessToken);
  const themeId = await getActiveThemeId(client);

  if (!themeId) {
    return {
      success: false,
      error:   'Could not find active theme',
    };
  }

  // Fetch relevant theme files for this issue type
  const relevantFiles = ISSUE_FILE_MAP[issue.category] || ['assets/theme.css'];
  const themeCode     = {};

  for (const fileKey of relevantFiles.slice(0, 2)) {
    const content = await fetchThemeAsset(client, themeId, fileKey);
    if (content) {
      // Truncate large files to first 4000 chars for token efficiency
      themeCode[fileKey] = content.length > 4000
        ? content.substring(0, 4000) + '\n... [truncated for brevity]'
        : content;
    }
  }

  // Build prompt with real theme code context
  const themeCodeContext = Object.entries(themeCode)
    .map(([file, code]) => `\n=== ${file} ===\n${code}`)
    .join('\n');

  const prompt = `You are a Shopify theme developer. Generate a minimal, safe CSS/Liquid fix for this specific issue.

ISSUE: ${issue.title}
DESCRIPTION: ${issue.description}
LOCATION: ${issue.location}
CSS TARGET: ${issue.cssFixTarget || 'See issue description'}
FIX DESCRIPTION: ${issue.fixDescription}

CURRENT THEME CODE:
${themeCodeContext || 'Theme code not available — generate a general fix'}

RULES:
1. Generate ONLY the minimal code change needed
2. CSS fixes go in a <style> block with a clear comment
3. Never modify merchant's original files — output goes in storecoach-fixes.css
4. Always use mobile-first CSS with proper media queries
5. CSS must be scoped — never use * selector
6. If a Liquid change is needed, show it as a comment with instructions
7. Return JSON with this exact structure:
{
  "cssCode": "/* StoreCoach Fix: [issue title] */\\n.selector { property: value; }",
  "liquidNote": "Optional instruction if Liquid template change is needed",
  "explanation": "One sentence explaining what this code does",
  "riskLevel": "LOW | MEDIUM | HIGH",
  "reversible": true
}

Return ONLY the JSON object. No other text.`;

  try {
    const response = await ai.models.generateContent({
      model:      'gemini-2.5-pro',
      contents:   prompt,
      config:     { maxOutputTokens: 800 },
    });

    const raw = response.text?.trim();

    // Parse JSON response
    const clean   = raw.replace(/```json|```/g, '').trim();
    const fixData = JSON.parse(clean);

    logger.info(`Fix code generated for: ${issue.title} (risk: ${fixData.riskLevel})`);

    return {
      success:    true,
      themeId,
      issueId:    issue.id,
      cssCode:    fixData.cssCode,
      liquidNote: fixData.liquidNote,
      explanation: fixData.explanation,
      riskLevel:  fixData.riskLevel,
      reversible: fixData.reversible,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };

  } catch (err) {
    logger.error(`Code generation failed for ${issue.title}: ${err.message}`);
    return {
      success: false,
      error:   `Code generation failed: ${err.message}`,
    };
  }
}

// ─────────────────────────────────────────────────────
//  AUTO-APPLY: Write fix directly to Shopify theme
//  AGENCY plan only
// ─────────────────────────────────────────────────────
export async function applyFixCode(fixData, merchant, db) {
  logger.info(`Auto-applying fix for merchant: ${merchant.shopDomain}`);

  const client = createShopifyClient(merchant.shopDomain, merchant.accessToken);

  // Safety check — only apply LOW or MEDIUM risk fixes automatically
  if (fixData.riskLevel === 'HIGH') {
    return {
      success: false,
      error:   'HIGH risk fixes require manual review and cannot be auto-applied',
    };
  }

  try {
    const FIXES_FILE = 'assets/storecoach-fixes.css';

    // Fetch existing fixes file (or start fresh)
    let existingContent = '';
    try {
      const existing = await fetchThemeAsset(client, fixData.themeId, FIXES_FILE);
      existingContent = existing || '';
    } catch (e) {
      existingContent = '/* StoreCoach Automated Fixes */\n/* All changes are tracked and reversible */\n\n';
    }

    // Append new fix with timestamp and issue reference
    const timestamp  = new Date().toISOString();
    const fixComment = `\n/* [${timestamp}] Fix ID: ${fixData.issueId} — ${fixData.explanation} */\n`;
    const newContent = existingContent + fixComment + fixData.cssCode + '\n';

    // Write to Shopify theme
    await writeThemeAsset(client, fixData.themeId, FIXES_FILE, newContent);

    // Ensure storecoach-fixes.css is included in theme.liquid
    await ensureFixesFileIncluded(client, fixData.themeId);

    logger.info(`Fix applied to theme: ${FIXES_FILE} for ${merchant.shopDomain}`);

    return {
      success:    true,
      appliedAt:  new Date(),
      fixFile:    FIXES_FILE,
      themeId:    fixData.themeId,
      reversible: true,
    };

  } catch (err) {
    logger.error(`Auto-apply failed: ${err.message}`);
    return {
      success: false,
      error:   `Failed to apply fix: ${err.message}`,
    };
  }
}

// ── Ensure storecoach-fixes.css is linked in theme ───
async function ensureFixesFileIncluded(client, themeId) {
  try {
    const themeLayout = await fetchThemeAsset(client, themeId, 'layout/theme.liquid');
    if (!themeLayout) return;

    const linkTag = `{{ 'storecoach-fixes.css' | asset_url | stylesheet_tag }}`;

    // Already included — skip
    if (themeLayout.includes('storecoach-fixes.css')) return;

    // Inject before </head>
    const updated = themeLayout.replace('</head>', `  ${linkTag}\n</head>`);
    await writeThemeAsset(client, themeId, 'layout/theme.liquid', updated);

    logger.info('storecoach-fixes.css linked in theme.liquid');
  } catch (err) {
    logger.warn(`Could not inject CSS link in theme.liquid: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────
//  REVERT: Remove a specific fix from storecoach-fixes.css
// ─────────────────────────────────────────────────────
export async function revertFixCode(issueId, merchant) {
  logger.info(`Reverting fix for issue: ${issueId}`);

  const client  = createShopifyClient(merchant.shopDomain, merchant.accessToken);
  const themeId = await getActiveThemeId(client);
  if (!themeId) return { success: false, error: 'Theme not found' };

  try {
    const FIXES_FILE     = 'assets/storecoach-fixes.css';
    const existingContent = await fetchThemeAsset(client, themeId, FIXES_FILE);
    if (!existingContent) return { success: true, message: 'No fixes file found' };

    // Remove the specific fix block using issue ID as marker
    const fixPattern  = new RegExp(
      `\\/\\*[^*]*Fix ID: ${issueId}[^*]*\\*\\/\\n[^/]*(?=\\/\\*|$)`,
      'gs'
    );
    const newContent  = existingContent.replace(fixPattern, '').trim();

    await writeThemeAsset(client, themeId, FIXES_FILE, newContent + '\n');

    logger.info(`Fix reverted for issue: ${issueId}`);
    return { success: true, revertedAt: new Date() };

  } catch (err) {
    logger.error(`Revert failed for ${issueId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────
//  REVERT ALL: Remove entire storecoach-fixes.css
// ─────────────────────────────────────────────────────
export async function revertAllFixes(merchant) {
  logger.info(`Reverting ALL fixes for: ${merchant.shopDomain}`);

  const client  = createShopifyClient(merchant.shopDomain, merchant.accessToken);
  const themeId = await getActiveThemeId(client);
  if (!themeId) return { success: false, error: 'Theme not found' };

  try {
    // Reset fixes file to empty
    await writeThemeAsset(
      client, themeId,
      'assets/storecoach-fixes.css',
      '/* StoreCoach Fixes — All reverted */\n'
    );

    // Remove link from theme.liquid
    const themeLayout = await fetchThemeAsset(client, themeId, 'layout/theme.liquid');
    if (themeLayout?.includes('storecoach-fixes.css')) {
      const cleaned = themeLayout.replace(
        /\s*\{\{ 'storecoach-fixes\.css'[^\n]+\n/g, ''
      );
      await writeThemeAsset(client, themeId, 'layout/theme.liquid', cleaned);
    }

    logger.info(`All fixes reverted for: ${merchant.shopDomain}`);
    return { success: true, revertedAt: new Date() };

  } catch (err) {
    logger.error(`Revert all failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}
