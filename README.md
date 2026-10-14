<div align="center">
  <img src="public/icons/icon-128.png" width="110" height="110" alt="OnePlay Video Control logo" />
  <h1>OnePlay — Video Control</h1>
  <p><b>Reliable play, seek, speed and volume controls for any HTML5 video on the web — that site overlays can't block.</b></p>

  <p>
    <a href="https://chromewebstore.google.com/detail/oneplay-video-control/gpmickcblelmgkfheifkhnhehhmcfahp">
      <img src="https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Install from Chrome Web Store" />
    </a>
    <img src="https://img.shields.io/badge/Manifest-V3-success?style=for-the-badge&logo=google" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" /></a>
  </p>

  <p>
    <a href="https://chromewebstore.google.com/detail/oneplay-video-control/gpmickcblelmgkfheifkhnhehhmcfahp"><b>Install from Chrome Web Store</b></a>
    &nbsp;•&nbsp;
    <a href="#features">Features</a>
    &nbsp;•&nbsp;
    <a href="#build-from-source">Build from Source</a>
    &nbsp;•&nbsp;
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## Why OnePlay?

Ever tried to scrub through a video on a social media site, only to find invisible layers that pause, mute, or open the post when you click? Or a site that hides the native controls entirely?

OnePlay puts its own control bar **on top of** the video, in an isolated Shadow DOM layer. It doesn't touch the site's player, so it keeps working when the site changes its layout or class names.

## Screenshots

<div align="center">
  <img src="promo/3.gif" alt="OnePlay in action" width="100%" />
  <p><i>OnePlay controlling a video without interfering with the page</i></p>
</div>

<table align="center" width="100%">
  <tr>
    <td align="center" width="50%" valign="top">
      <img src="promo/4.png" alt="Controller over a video" width="100%" /><br>
      <b>Overlay-proof control bar</b>
      <p>Works on feeds, Shorts, Reels and preview cards.</p>
    </td>
    <td align="center" width="50%" valign="top">
      <img src="promo/1.png" alt="Quick settings popup" width="100%" /><br>
      <b>Quick settings popup</b>
      <p>Themes, position, layout and per-site overrides.</p>
    </td>
  </tr>
</table>

<div align="center">
  <img src="promo/2.png" alt="Options dashboard" width="100%" /><br>
  <b>Options dashboard</b>
  <p>Injection policy, detection thresholds, shortcuts and theme builder.</p>
</div>

---

## Features

- 🎛️ **Full playback control**: play/pause, seek, volume, mute, fullscreen, and speed from 0.5× to 3×.
- 🛡️ **Overlay-proof**: the controller sits at the top z-index layer with its own pointer handling, so transparent tap-to-mute/pause layers can't block it.
- 🧩 **Doesn't depend on the site**: it mounts in a Shadow DOM at the document root and never injects into the host player, so site redesigns don't break it.
- 📐 **Layouts & positions**
  - **Full**: scrub bar, time, volume, speed, fullscreen.
  - **Minimal pill**: compact `-5s / Play / +5s` with a slim progress bar.
  - Automatic **2-row mode** on narrow videos.
  - Dock **inside or outside**, at the **top or bottom** of the video.
- 🎨 **4 built-in themes**: Classic Dark, Midnight, Glass, Ocean Blue, plus a theme builder.
- ⌨️ **Custom keyboard shortcuts**: single keys or combinations (`Ctrl+Shift+P`, `Alt+M`…). Shortcuts turn off automatically while you type in inputs.
- 🎯 **Smart video selection**: prefers videos that are playing with sound, and supports several controllers at once when multiple videos are ≥70% visible.
- ⬇️ **Download & stream recording** (right-click the bar):
  - Direct download for regular video URLs.
  - Real-time recording of streamed (MSE / HLS / DASH) videos via `captureStream()` + `MediaRecorder`, with a live `● REC` badge.
  - Disabled on YouTube, per Chrome Web Store policy. DRM-protected streams can't be captured.
- 🔋 **Lightweight**: event-driven (`MutationObserver`, `IntersectionObserver`, `ResizeObserver`), with no polling loops.
- 🔒 **Private**: runs 100% locally. No analytics, no tracking, no accounts.

## Keyboard Shortcuts

All shortcuts can be changed in the popup or the options page.

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Play / Pause |
| <kbd>←</kbd> / <kbd>J</kbd> | Seek backward (default 5s) |
| <kbd>→</kbd> / <kbd>L</kbd> | Seek forward (default 5s) |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Volume ±5% |
| <kbd>M</kbd> | Mute / Unmute |
| <kbd>F</kbd> | Fullscreen |

---

## Installation

### From the Chrome Web Store (recommended)

[![Install from Chrome Web Store](https://img.shields.io/badge/Install_from-Chrome_Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/oneplay-video-control/gpmickcblelmgkfheifkhnhehhmcfahp)

### Build from Source

**Requirements:** Node.js 18+ and npm 9+.

```bash
git clone https://github.com/Pouria7/OnePlay-Video-Control.git
cd OnePlay-Video-Control
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions/`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and pick the generated `dist/` folder.

### Development

```bash
npm run dev     # rebuild on file changes
npm test        # run the test suite (Vitest)
```

---

## How It Works

```text
Host page
├── Site DOM (React/Vue/…, obfuscated classes, invisible overlays)
│   └── <video>
└── OnePlay layer (independent)
    └── <div class="ufvc-controller-root">
        └── ShadowRoot
            ├── Isolated CSS reset
            ├── Control bar (fixed, z-index: 2147483647)
            └── Context menu / REC indicator
```

OnePlay tracks the target video's bounding box and places its own UI over it. Because the UI lives outside the site's DOM tree, the site's `overflow: hidden`, reflows and class changes don't affect it.

Domain-specific behavior lives in small **site adapters** (Instagram, YouTube, plus a generic fallback), separate from the core engine. Settings are resolved in this order: **per-site user settings → adapter defaults → global user settings → built-in defaults**.

For the full design, see [ARCHITECTURE.md](ARCHITECTURE.md).

### Adding a Site Adapter

Create `src/content/adapters/<site>-adapter.ts`:

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
    return { minWidth: 200, minHeight: 300, visibilityThreshold: 0.6, allowMultiple: false };
  }
}
```

Then register it in `src/content/adapters/adapter-manager.ts`:

```ts
this.register(new TikTokAdapter());
```

### Adding a Theme

Add an entry to `BUILTIN_THEMES` in `src/themes/default-themes.ts`, then add a matching `<option>` in `src/popup/popup.html`. Themes are plain CSS variables (`--ufvc-bg`, `--ufvc-text`, `--ufvc-accent`, `--ufvc-radius`, `--ufvc-blur`, …).

---

## Roadmap

Planned ideas include an A-B section looper, frame screenshots, quick Picture-in-Picture, and subtitle tools. See [ROADMAP.md](ROADMAP.md).

## Contributing

Contributions are welcome!

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Make your changes and run `npm test`
3. Open a Pull Request

Bug reports and site-compatibility issues are very helpful. Please include the site URL and steps to reproduce.

## Privacy

OnePlay doesn't collect, store, or send any personal data. The only network request is an occasional check of a public `version.json` file for update notices. Read the full [Privacy Policy](https://anaspect-oneplay.pages.dev/privacy).

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/Pouria7/OnePlay-Video-Control/issues)
- ✉️ Email: oneabout@outlook.com
- ⭐ If OnePlay is useful to you, please star the repo and [leave a review](https://chromewebstore.google.com/detail/oneplay-video-control/gpmickcblelmgkfheifkhnhehhmcfahp) on the Chrome Web Store!

## License

[MIT](LICENSE)
