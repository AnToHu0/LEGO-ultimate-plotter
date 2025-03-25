# Font Conversion Scripts

This directory contains scripts for converting SVG fonts to JSON format for use in the Plotter application.
You could use any single line svg fonts like Hershey.

## Available Scripts

### `svg-to-json.js`

Converts a single SVG font file to JSON format with proper scaling and positioning of characters.

**Usage:**

```bash
node svg-to-json.js <input-svg-file> <output-json-name>
```

**Example:**

```bash
node svg-to-json.js "HersheyMusic.svg" "HersheyMusic"
```

**Features:**

- Extracts glyph paths and metrics from SVG files
- Supports special characters
- Normalizes paths with common baseline and consistent scaling
- Approximates Bezier curves with linear segments for simple rendering
- Retains proper typography for lowercase letters with descenders (g, j, p, q, y)
- Adds metadata like letterSpacing, lineHeight, and humanizeable flag

### `convert-all-fonts.js`

Batch converts all SVG font files in the public/fonts directory to JSON format.

**Usage:**

```bash
node convert-all-fonts.js
```

**Features:**

- Automatically finds all SVG files in the fonts directory
- Uses the SVG filename (without extension) as the output JSON filename
- Processes each font sequentially
- Shows progress and error reporting

## How It Works

1. The scripts read SVG font files using the xmldom parser
2. Each glyph is extracted with its Unicode character and path data
3. SVG paths are parsed using svg-path-parser and converted to point arrays
4. Bezier curves are approximated with linear segments for simpler rendering
5. Coordinates are normalized to a common baseline and consistent scale
6. The output is saved as a JSON file with the following structure:

```json
{
  "meta": {
    "minSize": 8,
    "maxSize": 72,
    "letterSpacing": 0.3,
    "lineHeight": 1.5,
    "spaceWidth": 3,
    "lowercaseScale": 0.6,
    "humanizeable": false
  },
  "characters": {
    "A": [ [[x1, y1], [x2, y2], ...], ... ],
    "B": [ [[x1, y1], [x2, y2], ...], ... ],
    ...
  }
}
```

Each character is represented as an array of paths, where each path is an array of points [x, y].

## Requirements

The scripts require the following dependencies, which are listed in package.json:

- xmldom: For parsing SVG files
- svg-path-parser: For parsing SVG path commands
