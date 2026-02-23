#!/usr/bin/env node

/**
 * Icon Generator Script for Jocasta
 * Generates PNG icons from logo.png source
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const WEB_DIR = path.join(__dirname, '..', 'web');
const SOURCE_LOGO = path.join(ASSETS_DIR, 'logo.png');

// Icon configurations - all generated from logo.png
const ICON_CONFIGS = [
  // App icons
  { name: 'icon.png', size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'notification-icon.png', size: 96 },

  // Favicon sizes
  { name: 'favicon.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-192.png', size: 192 },
  { name: 'favicon-512.png', size: 512 },

  // Apple touch icons
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'apple-touch-icon-152.png', size: 152 },
  { name: 'apple-touch-icon-167.png', size: 167 },
  { name: 'apple-touch-icon-180.png', size: 180 },
];

async function generateIcons() {
  console.log('Generating icons from logo.png...\n');

  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error('❌ Source logo.png not found at:', SOURCE_LOGO);
    process.exit(1);
  }

  // Get source image info
  const metadata = await sharp(SOURCE_LOGO).metadata();
  console.log(`Source: logo.png (${metadata.width}x${metadata.height})\n`);

  for (const config of ICON_CONFIGS) {
    const outputPath = path.join(ASSETS_DIR, config.name);

    try {
      await sharp(SOURCE_LOGO)
        .resize(config.size, config.size, {
          fit: 'contain',
          background: { r: 26, g: 39, b: 68, alpha: 1 } // #1a2744
        })
        .png()
        .toFile(outputPath);

      console.log(`  ✅ ${config.name} (${config.size}x${config.size})`);
    } catch (error) {
      console.log(`  ❌ ${config.name}: ${error.message}`);
    }
  }

  // Copy web favicons
  const webFavicons = ['favicon.png', 'favicon-192.png', 'favicon-512.png', 'apple-touch-icon.png'];
  console.log('\nCopying to web directory...');

  if (!fs.existsSync(WEB_DIR)) {
    fs.mkdirSync(WEB_DIR, { recursive: true });
  }

  for (const favicon of webFavicons) {
    const src = path.join(ASSETS_DIR, favicon);
    const dest = path.join(WEB_DIR, favicon);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  ✅ web/${favicon}`);
    }
  }

  console.log('\n✨ Icon generation complete!');
}

generateIcons().catch(console.error);
