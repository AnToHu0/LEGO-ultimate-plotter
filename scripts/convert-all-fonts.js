/**
 * Script for batch conversion of all SVG fonts to JSON format
 *
 * Usage:
 * node scripts/convert-all-fonts.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Define paths
const fontsDir = path.resolve(process.cwd(), 'public/fonts');
const svgToJsonScript = path.resolve(process.cwd(), 'scripts/svg-to-json.js');

// Get list of SVG files in fonts directory
const svgFiles = fs.readdirSync(fontsDir)
  .filter(file => file.toLowerCase().endsWith('.svg'));

console.log(`Found ${svgFiles.length} SVG font files for conversion`);

// Process each SVG file
for (const svgFile of svgFiles) {
  try {
    // Use SVG filename without extension as output name
    const outputName = svgFile.replace(/\.svg$/i, '');

    console.log(`Converting ${svgFile} to ${outputName}.json...`);

    // Run conversion script
    execSync(`node ${svgToJsonScript} "${svgFile}" "${outputName}"`, {
      stdio: 'inherit' // Show output in console
    });

    console.log(`Successfully converted ${svgFile}\n`);
  } catch (error) {
    console.error(`Error converting ${svgFile}: ${error.message}`);
  }
}

console.log('Font conversion completed!');
