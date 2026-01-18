# UI Bug Detector

> 🔍 Enterprise-grade automated UI quality assurance tool

Detect UI bugs, accessibility issues, and visual defects across your entire website. Powered by Playwright and axe-core for comprehensive automated testing.

![Score: 40/100](https://img.shields.io/badge/Score-40%2F100-orange)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![Playwright](https://img.shields.io/badge/Playwright-1.48-green)

## Features

- 🔍 **Full Website Crawling** - Scan entire websites via sitemap.xml or link discovery
- ♿ **Accessibility Testing** - WCAG compliance with axe-core integration
- 📱 **Responsive Testing** - Desktop, Tablet, and Mobile viewports
- 🎨 **Visual Checks** - Overlaps, z-index conflicts, broken images
- 📝 **Typo Detection** - US and British English dictionary support
- 🔗 **Navigation Testing** - Broken links and anchor target validation
- ⚡ **Parallel Scanning** - Configurable concurrency for faster crawls
- 📊 **Priority Scoring** - Bugs ranked by severity and impact
- 📋 **Export Reports** - JSON and Markdown formats for CI/CD

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ui-bug-detector.git
cd ui-bug-detector

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Development

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

### Production Build

```bash
npm run build
npm start
```

## CLI Usage

The CLI tool supports CI/CD integration with appropriate exit codes.

```bash
# Single page scan
npx tsx scripts/cli.ts scan https://example.com

# Full website crawl
npx tsx scripts/cli.ts crawl https://example.com --depth=3 --pages=20

# Desktop only (faster)
npx tsx scripts/cli.ts scan https://example.com --no-mobile

# Custom output
npx tsx scripts/cli.ts scan https://example.com --output=report --format=both
```

### CLI Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass - No critical/major issues |
| 1 | Warn - Major issues found |
| 2 | Fail - Critical issues found |

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/ui-bug-detector)

1. Connect your GitHub repository
2. Vercel will auto-detect Next.js settings
3. Deploy!

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npx playwright install chromium --with-deps

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Manual Deployment

```bash
# Build
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub PAT for repo scanning | Optional |
| `PORT` | Server port (default: 3000) | Optional |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Browser Automation**: Playwright
- **Accessibility**: axe-core
- **Spell Check**: nspell (US + UK dictionaries)
- **Styling**: Tailwind CSS
- **UI**: Framer Motion, Lucide Icons

## Detection Capabilities

| Category | Checks |
|----------|--------|
| **Layout** | Overflow, clipping, cramped text, misalignment |
| **Visual** | Overlaps, z-index conflicts, broken images, font loading |
| **Accessibility** | Color contrast, missing alt text, landmarks, focus |
| **Interaction** | Small touch targets, unclickable elements, empty links |
| **Content** | Typos (US/UK English), grammar issues |
| **Navigation** | Broken links, missing anchors, inconsistent nav |
| **Forms** | Missing labels, required indicators, autocomplete |

## License

MIT

---

Built with ❤️ for better web quality
