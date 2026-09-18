# Universal Floating Video Controls (Chrome Extension - Manifest V3)

A robust, website-independent floating video controller for HTML5 `<video>` elements across the web. Designed to remain completely resilient against host-site layout modifications, CSS class obfuscation, and transparent click-blocking overlay layers (such as those on Instagram Web).

---

## Table of Contents

1. [Key Features](#key-features)
2. [Core Architecture & Design Principle](#core-architecture--design-principle)
3. [Detection & Selection Engine](#detection--selection-engine)
4. [Site Adapter Architecture](#site-adapter-architecture)
5. [Configuration & Precedence Order](#configuration--precedence-order)
6. [Themes System](#themes-system)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Installation & Development](#installation--development)
9. [Loading Unpacked Extension in Chrome](#loading-unpacked-extension-in-chrome)
10. [How to Add a New Site Adapter](#how-to-add-a-new-site-adapter)
11. [How to Add a New Theme](#how-to-add-a-new-theme)
12. [Future Feature Plugins](#future-feature-plugins)
13. [Project Directory Structure](#project-directory-structure)

---

## Key Features

- **Website-Independent UI**: The floating controller is never injected as a child of the host website's player container. It mounts at the top-level document with an open **Shadow DOM** and fixed viewport positioning.
- **Immune to Overlay Hijacking**: Operates at maximum `z-index: 2147483647` with direct pointer-events capture. Transparent tap-to-mute or tap-to-pause overlays on Instagram Web cannot block controller clicks.
- **Intelligent Video Selection**:
  - Automatically identifies candidate videos using rendered dimensions (`getBoundingClientRect()`).
  - Prioritizes currently playing, audible videos over muted videos.
  - Implements the **70% Viewport Visibility Rule**: multiple videos with $\ge 70\%$ intersection ratio can simultaneously receive controllers.
- **Zero Polling & Battery-Friendly**: Coordinates updates using `MutationObserver`, `IntersectionObserver`, `ResizeObserver`, media events, and `requestAnimationFrame` throttled scroll/resize tracking. No infinite animation loops.
- **Clean Adapter System**: Dedicated out-of-the-box adapters for **Instagram Web** and **YouTube** (previews/cards), completely isolated from the generic engine.
- **4 Built-in Themes**: `minimal` (default), `minimal-dark`, `glass` (glassmorphism with backdrop blur), and `accent-blue`.
- **Keyboard Shortcuts**: Space (Play/Pause), Left/Right or J/L (Seek $\pm 5$s), Up/Down (Volume $\pm 10\%$) with strict input guarding that automatically suspends when typing in editable fields.

---

## Core Architecture & Design Principle

### The Core Design Principle: Never Integrate with Host Player DOM

Existing video control extensions frequently break when sites like Instagram update their React/GraphQL component trees or alter CSS class names. 

Instead of injecting into the website's DOM:

```text
Host Website
│
├── Website DOM (React/Vue/Angular)
│   ├── Dynamic/Obfuscated Containers
│   ├── Transparent Overlays / Tap Catchers
│   └── <video> element
│
└── Completely Independent Layer
    │
    ▼
┌────────────────────────────────────────────────────────┐
│ document.documentElement                               │
│ └── <div class="ufvc-controller-root">                 │
│     └── ShadowRoot (open)                              │
│         ├── Isolated CSS Reset (:host { all: initial })│
│         └── Fixed Floating Control Bar (z: 2147483647) │
└────────────────────────────────────────────────────────┘
```

The controller monitors the target video's viewport bounding rect and positions its own floating UI directly over the bottom of the video, completely isolated from any parent container overflow clipping (`overflow: hidden`) or layout reflows.

---

## Detection & Selection Engine

### Lifecycle States

Every discovered video element transitions through an explicit lifecycle:
```text
DISCOVERED ──► TRACKED ──► CANDIDATE ──► ACTIVE ──► INACTIVE ──► REMOVED ──► CLEANED
```

1. **DISCOVERED**: Detected by `VideoObserver` (`MutationObserver` or initial scan).
2. **TRACKED**: Added to `VideoRegistry`. `IntersectionObserver`, `ResizeObserver`, and media listeners attached.
3. **CANDIDATE**: Passes candidate filter rules (rendered dimensions $\ge 160\times 120$px, connected to DOM, visible in CSS).
4. **ACTIVE**: Selected by `VideoSelector`. Floating controller mounted.
5. **INACTIVE**: Temporarily hidden or controller removed when out of viewport or paused below thresholds.
6. **REMOVED**: Element disconnected from the DOM.
7. **CLEANED**: All event listeners, observers, and controller instances destroyed, enabling garbage collection.

### Selection Algorithm & 70% Visibility Rule

When multiple `<video>` elements exist on a page:
1. **Audible Playback Priority**: Videos that are currently playing and unmuted (`!paused && !muted && volume > 0`) receive top priority (+1000 score bonus).
2. **Playing Muted**: If all playing videos are muted, viewport visibility is evaluated.
3. **70% Rule**: If one or more candidate videos have an intersection ratio of **70% or greater**, all qualifying videos may remain active simultaneously and receive their own controller.
4. **Sub-70% Fallback**: If no video reaches 70%, the video with the highest visibility ratio is prioritized.
5. **Paused Candidates**: Videos paused in the viewport with high visibility ($\ge 70\%$) remain eligible for controls.

---

## Site Adapter Architecture

Site adapters allow domain-specific customization without contaminating the generic detection engine:

```ts
export interface SiteAdapter {
  readonly id: string;
  readonly name: string;
  matches(url: URL): boolean;
  getConfigOverrides(): Partial<SiteSettings>;
  filterVideo?(video: HTMLVideoElement): boolean;
  scoreVideo?(video: HTMLVideoElement, context: VideoCandidateContext): number | null;
  selectVideos?(candidates: TrackedVideo[]): TrackedVideo[] | null;
  onVideoDetected?(video: HTMLVideoElement): void;
  onVideoActivated?(video: HTMLVideoElement): void;
  onVideoDeactivated?(video: HTMLVideoElement): void;
}
```

### Built-in Adapters

- **Instagram Adapter** (`src/content/adapters/instagram-adapter.ts`):
  - Targets `instagram.com` and all subdomains.
  - Adapts minimum video sizes for Reels, Stories, and Feed.
  - Zero dependency on Instagram's obfuscated class names or React tree.
- **YouTube Adapter** (`src/content/adapters/youtube-adapter.ts`):
  - Targets `youtube.com`.
  - Configures relaxed dimensions ($120\times 80$px) to support hover preview video cards.
- **Generic Adapter** (`src/content/adapters/generic-adapter.ts`):
  - Universal fallback for any other web domain.

---

## Configuration & Precedence Order

Settings are resolved per-domain using a strict 4-tier precedence hierarchy:

```text
1. User Per-Site Settings (chrome.storage.sync siteSettings[domain])
       │
       ▼ (if undefined)
2. Site Adapter Configuration (adapter.getConfigOverrides())
       │
       ▼ (if undefined)
3. Global User Settings (chrome.storage.sync globalSettings)
       │
       ▼ (if undefined)
4. Built-in Defaults (DEFAULT_GLOBAL_SETTINGS)
```

Changes in `chrome.storage.sync` update active video controllers in real time without requiring a page reload.

---

## Themes System

The controller uses CSS custom variables inside the Shadow DOM:

| Variable | Description |
|---|---|
| `--ufvc-bg` | Background color / gradient |
| `--ufvc-text` | Primary text and icon color |
| `--ufvc-accent` | Highlight color for scrubber and speed pill |
| `--ufvc-accent-hover` | Hover color for buttons |
| `--ufvc-border` | Border style and color |
| `--ufvc-radius` | Corner border radius |
| `--ufvc-blur` | Backdrop filter blur effect |
| `--ufvc-shadow` | Box shadow styling |
| `--ufvc-scale` | Scale transform multiplier |

### Built-in Themes

- **`minimal`** (Default): Non-intrusive dark semi-transparent bar (`rgba(18, 20, 24, 0.76)`).
- **`minimal-dark`**: Obsidian high-contrast theme (`rgba(8, 8, 10, 0.92)`).
- **`glass`**: Modern frosted glassmorphism with `backdrop-filter: blur(16px) saturate(180%)`.
- **`accent-blue`**: Cybernetic neon blue accents on dark navy background.

---

## Keyboard Shortcuts

| Key | Action | Description |
|---|---|---|
| <kbd>Space</kbd> | Play / Pause | Toggles playback of the primary active video |
| <kbd>←</kbd> or <kbd>J</kbd> | Seek Backward | Jumps backward 5 seconds (configurable) |
| <kbd>→</kbd> or <kbd>L</kbd> | Seek Forward | Jumps forward 5 seconds (configurable) |
| <kbd>↑</kbd> | Volume Up | Increases volume by +10% |
| <kbd>↓</kbd> | Volume Down | Decreases volume by -10% |

> **Typing Guard**: Shortcuts are automatically disabled when focus is inside an `<input>`, `<textarea>`, `<select>`, `[contenteditable]`, or inside editable shadow trees.

---

## Installation & Development

### Prerequisites

- Node.js $\ge 18$ (tested on v22)
- npm $\ge 9$

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

### Build Extension

```bash
npm run build
```

This bundles all modules into `dist/`, including:
- `dist/manifest.json` (Manifest V3)
- `dist/background/service-worker.js` (ES module service worker)
- `dist/content/index.js` (Self-contained IIFE content script)
- `dist/popup/popup.html`, `dist/popup/popup.js`, `dist/popup/popup.css`
- `dist/icons/` (Valid PNG icons for 16, 48, and 128px)

---

## Loading Unpacked Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top right corner.
3. Click the **Load unpacked** button in the top left.
4. Select the `dist/` directory inside this project:
   `d:\Workspace\1 My Github Projects\Extentions\CD Video Player\dist`
5. The extension **"Universal Floating Video Controls"** will appear in your extensions list.
6. Pin the extension icon to your toolbar and visit Instagram or YouTube to test!

---

## How to Add a New Site Adapter

1. Create a new file in `src/content/adapters/`, e.g. `src/content/adapters/tiktok-adapter.ts`:
   ```ts
   import { SiteAdapter } from './site-adapter';
   import { SiteSettings } from '../../storage/types';
   import { domainMatches } from '../../utils/url';

   export class TikTokAdapter implements SiteAdapter {
     readonly id = 'tiktok';
     readonly name = 'TikTok Adapter';

     matches(url: URL): boolean {
       return domainMatches(url.hostname, 'tiktok.com');
     }

     getConfigOverrides(): Partial<SiteSettings> {
       return {
         minWidth: 200,
         minHeight: 300,
         visibilityThreshold: 0.6,
         allowMultiple: false
       };
     }
   }
   ```
2. Register the adapter in `src/content/adapters/adapter-manager.ts`:
   ```ts
   import { TikTokAdapter } from './tiktok-adapter';
   // In constructor:
   this.register(new TikTokAdapter());
   ```
3. Run `npm run build`.

---

## How to Add a New Theme

1. Open `src/themes/default-themes.ts` and add your theme definition to `BUILTIN_THEMES`:
   ```ts
   'sunset-orange': {
     id: 'sunset-orange',
     name: 'Sunset Orange',
     isBuiltin: true,
     properties: {
       bg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.85), rgba(236, 72, 153, 0.85))',
       text: '#ffffff',
       accent: '#fef08a',
       accentHover: '#ffffff',
       border: '1px solid rgba(255, 255, 255, 0.3)',
       radius: '12px',
       blur: 'blur(10px)',
       opacity: 0.98,
       shadow: '0 8px 24px rgba(249, 115, 22, 0.35)',
       scale: 1.0
     }
   }
   ```
2. Add an `<option>` in `src/popup/popup.html`.
3. Run `npm run build`.

---

## Future Feature Plugins

The extension is designed with a provider interface (`src/content/plugins/feature-plugin.ts`) allowing seamless addition of features:
- AI Audio Dubbing
- Real-time Subtitle Generation & Translation
- A-B Video Section Looper
- Instant Video Frame Screenshot Tool
- Picture-in-Picture Quick Launch

---

## Project Directory Structure

```text
universal-floating-video-controls/
├── manifest.json              # Source Manifest V3
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript strict configuration
├── vite.config.ts             # Vite & Vitest configuration
├── CHROMEWEBSTORE.md          # Chrome Web Store listing metadata & justifications
├── README.md                  # Comprehensive documentation
├── scripts/
│   ├── generate-icons.js      # Binary PNG generator for icons
│   └── build.js               # Multi-target extension bundler
├── public/
│   ├── manifest.json          # Manifest copied to dist
│   └── icons/                 # Generated 16, 48, 128px PNG icons
├── src/
│   ├── types/                 # Shared domain types
│   ├── utils/                 # Geometry, DOM, throttle, and URL utilities
│   ├── storage/               # Storage schemas & precedence resolution
│   ├── themes/                # Theme engine & built-in themes
│   ├── background/
│   │   └── service-worker.ts  # Manifest V3 service worker
│   ├── content/
│   │   ├── detection/         # Registry, candidate filter, scorer, selector
│   │   ├── adapters/          # Site adapters (Instagram, YouTube, Generic)
│   │   ├── controller/        # Floating controller, Shadow DOM, position tracker
│   │   ├── shortcuts/         # Keyboard shortcut dispatcher
│   │   ├── plugins/           # Future feature plugin contracts
│   │   └── index.ts           # Content coordinator
│   └── popup/
│       ├── popup.html         # Extension popup
│       ├── popup.css          # Popup styling
│       └── popup.ts           # Popup settings manager
├── tests/                     # Vitest unit tests
│   ├── candidate-filter.test.ts
│   ├── video-scorer.test.ts
│   ├── video-selector.test.ts
│   ├── config-precedence.test.ts
│   └── url-matching.test.ts
└── dist/                      # Final unpackable Chrome extension
```

---

## License

MIT
