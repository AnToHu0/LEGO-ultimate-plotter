import { DOMParser } from 'xmldom';
import svgPathParser from 'svg-path-parser';
import fs from 'fs';
import path from 'path';
// import { fileURLToPath } from 'url';

// Get path for ESM modules - commented out as not used in current implementation
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Get command line arguments
const inputFileName = process.argv[2] || 'CutlingsDualis.svg';
const outputFontName = process.argv[3] || 'CutlingsDualis';

// Define file paths
const inputFilePath = path.resolve(process.cwd(), 'public/fonts', inputFileName);
const outputFilePath = path.resolve(process.cwd(), 'public/fonts', `${outputFontName}.json`);

console.log(`Input file: '${inputFilePath}'`);
console.log(`Output file: '${outputFilePath}'`);

// Check if input file exists
if (!fs.existsSync(inputFilePath)) {
  console.error(`File '${inputFilePath}' not found!`);
  process.exit(1);
}

// Map of special characters for replacement
const charMap = {
  '#': 'hash',
  '@': 'at',
  '&': 'amp',
  '+': 'plus',
  '*': 'asterisk',
  '=': 'equal',
  '>': 'gt',
  '<': 'lt',
  '[': 'lbracket',
  ']': 'rbracket',
  '{': 'lcurly',
  '}': 'rcurly',
  '(': 'lparen',
  ')': 'rparen',
  '|': 'pipe',
  '\\': 'backslash',
  '/': 'slash',
  '^': 'caret',
  '~': 'tilde',
  '`': 'backtick',
  '\'': 'apos',
  '"': 'quote',
  '$': 'dollar',
  '%': 'percent',
  '_': 'underscore',
  '-': 'hyphen'
};

// Extract functions from CommonJS module
const { parseSVG, makeAbsolute } = svgPathParser;

// Function to normalize SVG paths considering character type and common baseline
const normalizePaths = (paths, minX, minY, maxX, maxY, targetHeight = 10, isLowercase = false, char = '') => {
  // Use fixed values for character proportions
  // Based on font metrics from SVG

  // Total character area height (10 units)
  const totalHeight = targetHeight;

  // Define baseline position from bottom edge (30% of height)
  const baselineOffset = totalHeight * 0.3;

  // Calculate unified scale for all characters based on global metrics
  const fontHeight = ascent + Math.abs(descent);
  const scale = (totalHeight * 0.9) / fontHeight; // Use 90% of available height

  // Determine character type for proper positioning
  const hasDescender = /[gjpqy]/.test(char);
  const isSpecialCase = char === 'f'; // f has special behavior too

  // Transform coordinates using unified scale and common baseline
  return paths.map(path => path.map(point => {
    // Scale coordinates
    const scaledX = (point[0] - minX) * scale;

    // Invert Y and position relative to common baseline
    let scaledY;

    if (hasDescender) {
      // For letters with descenders, maintain correct baseline position
      // Descender characters should not be vertically centered
      scaledY = baselineOffset - ((point[1] - ascent) * scale);
    } else if (isSpecialCase) {
      // Special handling for 'f' which extends above x-height but should align with baseline
      scaledY = baselineOffset - ((point[1] - ascent) * scale);
    } else if (isLowercase) {
      // Regular lowercase letters align with baseline
      scaledY = baselineOffset - ((point[1] - ascent) * scale);
    } else {
      // Uppercase letters and other symbols
      scaledY = baselineOffset - ((point[1] - ascent) * scale);
    }

    // Round to 2 decimal places
    return [
      parseFloat(scaledX.toFixed(2)),
      parseFloat(scaledY.toFixed(2))
    ];
  }));
};

// Function to convert SVG path to point array for JSON format
const parseSVGPath = (pathData, isLowercase = false, char = '') => {
  try {
    // Parse SVG path
    const pathCommands = parseSVG(pathData);
    // Convert relative coordinates to absolute
    makeAbsolute(pathCommands);

    // Number of segments for Bezier curve approximation
    const bezierSegments = 10;

    // Variables to store current position and last control points
    let currentX = 0, currentY = 0;
    let lastControlX = 0, lastControlY = 0;

    // Array of paths (each path is a separate stroke)
    const paths = [];
    let currentPath = [];

    // Process SVG path commands
    for (const cmd of pathCommands) {
      switch (cmd.code) {
        case 'M': // Move to
          if (currentPath.length > 0) {
            paths.push([...currentPath]);
            currentPath = [];
          }
          currentX = cmd.x;
          currentY = cmd.y;
          currentPath.push([currentX, currentY]);
          break;

        case 'L': // Line to
          currentX = cmd.x;
          currentY = cmd.y;
          currentPath.push([currentX, currentY]);
          break;

        case 'H': // Horizontal line
          currentX = cmd.x;
          currentPath.push([currentX, currentY]);
          break;

        case 'V': // Vertical line
          currentY = cmd.y;
          currentPath.push([currentX, currentY]);
          break;

        case 'C': // Cubic Bezier curve
          const cubicPoints = approximateCubicBezier(
            currentX, currentY,
            cmd.x1, cmd.y1,
            cmd.x2, cmd.y2,
            cmd.x, cmd.y,
            bezierSegments
          );

          // Skip first point as it should already be in the path
          for (let i = 1; i < cubicPoints.length; i++) {
            currentPath.push(cubicPoints[i]);
          }

          currentX = cmd.x;
          currentY = cmd.y;
          lastControlX = cmd.x2;
          lastControlY = cmd.y2;
          break;

        case 'S': // Smooth cubic Bezier
          // Reflected control point
          const sx1 = currentX + (currentX - lastControlX);
          const sy1 = currentY + (currentY - lastControlY);

          const smoothCubicPoints = approximateCubicBezier(
            currentX, currentY,
            sx1, sy1,
            cmd.x2, cmd.y2,
            cmd.x, cmd.y,
            bezierSegments
          );

          // Skip first point
          for (let i = 1; i < smoothCubicPoints.length; i++) {
            currentPath.push(smoothCubicPoints[i]);
          }

          currentX = cmd.x;
          currentY = cmd.y;
          lastControlX = cmd.x2;
          lastControlY = cmd.y2;
          break;

        case 'Q': // Quadratic Bezier curve
          const quadraticPoints = approximateQuadraticBezier(
            currentX, currentY,
            cmd.x1, cmd.y1,
            cmd.x, cmd.y,
            bezierSegments
          );

          // Skip first point
          for (let i = 1; i < quadraticPoints.length; i++) {
            currentPath.push(quadraticPoints[i]);
          }

          currentX = cmd.x;
          currentY = cmd.y;
          lastControlX = cmd.x1;
          lastControlY = cmd.y1;
          break;

        case 'T': // Smooth quadratic Bezier
          // Reflected control point
          const tx1 = currentX + (currentX - lastControlX);
          const ty1 = currentY + (currentY - lastControlY);

          const smoothQuadraticPoints = approximateQuadraticBezier(
            currentX, currentY,
            tx1, ty1,
            cmd.x, cmd.y,
            bezierSegments
          );

          // Skip first point
          for (let i = 1; i < smoothQuadraticPoints.length; i++) {
            currentPath.push(smoothQuadraticPoints[i]);
          }

          currentX = cmd.x;
          currentY = cmd.y;
          lastControlX = tx1;
          lastControlY = ty1;
          break;

        case 'A': // Elliptical arc
          // Simple approximation - just connect end points
          currentX = cmd.x;
          currentY = cmd.y;
          currentPath.push([currentX, currentY]);
          break;

        case 'Z': // Close path
          if (currentPath.length > 0 &&
            (currentPath[0][0] !== currentPath[currentPath.length - 1][0] ||
              currentPath[0][1] !== currentPath[currentPath.length - 1][1])) {
            currentPath.push([currentPath[0][0], currentPath[0][1]]);
          }
          paths.push([...currentPath]);
          currentPath = [];
          break;
      }
    }

    // Add last path if not empty
    if (currentPath.length > 0) {
      paths.push(currentPath);
    }

    // Find min and max coordinates for normalization
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const path of paths) {
      for (const [x, y] of path) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    // Use global font metrics instead of individual character boundaries
    // for unified scaling
    return normalizePaths(paths, minX, minY, maxX, maxY, 10, isLowercase, char);
  } catch (error) {
    console.error(`Error parsing SVG path: ${error.message}`);
    return [[[0, 0], [0, 0]]]; // Empty path in case of error
  }
};

// Function to approximate cubic Bezier curve
const approximateCubicBezier = (x0, y0, x1, y1, x2, y2, x3, y3, segments = 10) => {
  const result = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;

    result.push([parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2))]);
  }
  return result;
};

// Function to approximate quadratic Bezier curve
const approximateQuadraticBezier = (x0, y0, x1, y1, x2, y2, segments = 10) => {
  const result = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;

    const x = mt2 * x0 + 2 * mt * t * x1 + t2 * x2;
    const y = mt2 * y0 + 2 * mt * t * y1 + t2 * y2;

    result.push([parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2))]);
  }
  return result;
};

// Read SVG file
const svgContent = fs.readFileSync(inputFilePath, 'utf8');

// Parse SVG using xmldom
const parser = new DOMParser();
const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');

// Get font metadata from SVG
const fontElement = svgDoc.getElementsByTagName('font')[0];
const fontFaceElement = svgDoc.getElementsByTagName('font-face')[0];

// Extract font metrics
const unitsPerEm = fontFaceElement ? parseInt(fontFaceElement.getAttribute('units-per-em') || '1000') : 1000;
const ascent = fontFaceElement ? parseInt(fontFaceElement.getAttribute('ascent') || '800') : 800;
const descent = fontFaceElement ? parseInt(fontFaceElement.getAttribute('descent') || '-200') : -200;
const xHeight = fontFaceElement ? parseInt(fontFaceElement.getAttribute('x-height') || '300') : 300;
const capHeight = fontFaceElement ? parseInt(fontFaceElement.getAttribute('cap-height') || '500') : 500;
const horizontalAdvX = fontElement ? parseInt(fontElement.getAttribute('horiz-adv-x') || '0') : 0;

console.log(`Font metrics from SVG:`);
console.log(`unitsPerEm: ${unitsPerEm}`);
console.log(`ascent: ${ascent}`);
console.log(`descent: ${descent}`);
console.log(`xHeight: ${xHeight}`);
console.log(`capHeight: ${capHeight}`);
console.log(`horiz-adv-x: ${horizontalAdvX}`);

// Create basic structure for output JSON
let outputFont = {
  meta: {
    minSize: 8,
    maxSize: 72,
    letterSpacing: 0.3,
    lineHeight: 1.5,
    spaceWidth: 3,
    lowercaseScale: 1, // xHeight / capHeight,
    humanizeable: false // By default, font doesn't support humanization
  },
  characters: {}
};

// Check if output file exists and load it if it does
if (fs.existsSync(outputFilePath)) {
  console.log(`Existing font file '${outputFontName}.json' found, updating characters.`);
  try {
    const existingFont = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
    outputFont.meta = existingFont.meta || outputFont.meta;
  } catch (error) {
    console.error('Error reading existing font file:', error);
  }
}

// Get list of characters in reference font
const referenceFont = fs.existsSync(path.resolve(process.cwd(), 'public/fonts', 'handwritten.json'))
  ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/fonts', 'handwritten.json'), 'utf8'))
  : null;

const availableChars = referenceFont ? Object.keys(referenceFont.characters) : [];

// Set of characters to forcibly extract
const forcedChars = ['.', ',', '-', '!', '?', '+', '=', '&', '%', '$', '#', ':', '\''];

// Get all glyph elements from SVG
const glyphElements = svgDoc.getElementsByTagName('glyph');
console.log(`Found glyphs in SVG: ${glyphElements.length}`);

// Clear existing characters in output font
outputFont.characters = {};

// Debug output for first two glyphs
if (glyphElements.length > 0) {
  console.log(`Example of first glyph:`, glyphElements[0].toString());
}
if (glyphElements.length > 1) {
  console.log(`Example of second glyph:`, glyphElements[1].toString());
}

// Process each glyph
for (let i = 0; i < glyphElements.length; i++) {
  const glyphElem = glyphElements[i];

  // Get glyph attributes
  const unicode = glyphElem.getAttribute('unicode');
  const pathData = glyphElem.getAttribute('d');

  // Debug information
  if (unicode && !pathData) {
    console.log(`Glyph with unicode="${unicode}" has no d attribute`);
    continue;
  }

  if (!unicode || !pathData) continue;

  let char = unicode;

  // Check if this character should be forcibly processed
  const forceProcessing = forcedChars.includes(char);

  // If this is a special character that needs forced processing,
  // don't use charMap, otherwise apply replacement
  if (!forceProcessing && charMap[char]) {
    char = charMap[char];
  }

  // Process character if it exists in reference font or is in forced list
  if (availableChars.includes(char) || forceProcessing) {
    console.log(`Processing character: ${char}`);
    try {
      // Determine if character is lowercase
      const isLowercase = /[a-z]/.test(char);

      // Parse SVG path considering character type
      const paths = parseSVGPath(pathData, isLowercase, char);
      outputFont.characters[char] = paths;
    } catch (error) {
      console.error(`Error processing character "${char}":`, error);
    }
  } else {
    console.log(`Character "${char}" not found in reference font, skipping`);
  }
}

// Write results to JSON file
fs.writeFileSync(outputFilePath, JSON.stringify(outputFont, null, 2));
console.log(`Conversion complete. Check file ${outputFontName}.json`);
