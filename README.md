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

## Deployment

Since this application uses Playwright (browser automation), **Docker deployment is recommended**. Serverless platforms like Vercel often have size limits that block browser binaries.

### Option 1: Render (Recommended - Free Tier)
1. Fork this repository
2. Sign up at [render.com](https://render.com)
3. Create a new **Web Service**
4. Connect your GitHub repository
5. Select **Docker** as the Runtime
6. Click **Create Web Service**

### Option 2: Railway
1. Sign up at [railway.app](https://railway.app)
2. Create a new Project from GitHubRepo
3. Railway will automatically detect the `Dockerfile`
4. Deploy!

### Option 3: Vercel (Advanced)
If you must use Vercel:
1. Ensure `postinstall` script is enabled (`npx playwright install chromium`)
2. You may need a **Pro** plan as the Function size (~300MB) often exceeds the Free tier limit (250MB)

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
