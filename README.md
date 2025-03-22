# LEGO Plotter

A web application for converting raster images to vector SVG for LEGO plotter. Uses WebGL for fast CMYK channel processing and web workers for SVG path generation.

## Technologies

- Vue 3
- WebGL for CMYK processing
- Web Workers for SVG generation
- TypeScript

## Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Algorithms

The application supports various algorithms for SVG path generation:

- Dots
- Halftone
- Linedraw
- Spiral
- Waves
- And more...

## Features

- Fast image processing using GPU via WebGL
- CMYK channel separation
- Customizable parameters for each algorithm
- Real-time preview
- Optimized performance using Web Workers

## License

MIT
