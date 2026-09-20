# Chrome Web Store Listing — Universal Video Controls

> Last Updated: 2026-09-20

## Store Listing

**Extension Name** [REQUIRED]
Universal Video Controls

**Short Description** [REQUIRED]
Universal video controls for HTML5 videos across the web, designed for resilient overlay-independent playback.

**Detailed Description** [REQUIRED]
Take full command of any HTML5 video across the web with a sleek, site-independent playback control bar that never gets blocked by website overlays.

Have you ever struggled to scrub through videos on social media sites or websites that cover their players with transparent click-blocking layers? Universal Video Controls adds an independent, on-video playback controller positioned seamlessly over any active HTML5 video—without floating or detaching the video itself.

KEY FEATURES

• Universal Playback Control: Play, pause, seek, adjust volume, mute, toggle fullscreen, and adjust playback speed from 0.5x up to 3x on any HTML5 video.
• Resilient to Layout Changes: Unlike traditional extensions that inject into fragile website DOM structures, our controller is isolated in a separate Shadow DOM layer, working reliably even on complex dynamic feeds like Instagram and preview cards like YouTube.
• Overlay Immune: Transparent tap-to-mute, tap-to-pause overlays, and custom player masks cannot block your controls.
• Video Downloader & Live Stream Recorder:
  - Right-click the controller bar to open the context menu.
  - Direct media download for MP4/WebM video sources.
  - Built-in live stream capture (`captureStream()` + `MediaRecorder`) for MSE, DASH, and HLS blob streams (e.g., YouTube, Twitter/X, Twitch) with a real-time `● REC` indicator.
• Layout Densities: Choose between Full Controls and an ultra-compact Minimal Pill layout (Seek & slim progress line).
• Intelligent Video Selection: Automatically detects active videos, prioritizes audible audio, and highlights the video you are actually watching with the 70% Viewport Visibility rule.
• Multiple Simultaneous Videos: Supports controlling multiple visible videos when browsing multi-video feeds or split views.
• Customizable Themes: Choose between Classic Dark (Default), Midnight OLED, Glassmorphism, and Ocean Blue. Customize themes globally or per website.
• Fully Customizable Keyboard Shortcuts: Set single keys or key combinations (e.g. Space, J/L, Left/Right, Ctrl+Alt+M). Shortcuts automatically pause when typing into text boxes or comment fields.

HOW TO USE IT

1. Install Universal Video Controls.
2. Browse to any website with HTML5 videos, such as Instagram, YouTube, Twitter/X, or news platforms.
3. As soon as a video appears in your viewport, the control bar appears docked on the video.
4. Use the interactive scrub bar to jump to any point in the video, or use the keyboard shortcuts.
5. Right-click the control bar to download or record the video.
6. Click the extension icon in your browser toolbar to customize themes, shortcuts, layout modes, or toggle controls for specific websites.

PRIVACY FIRST

Universal Video Controls processes all video detection, playback controls, and stream recordings locally inside your browser. No browsing history, account credentials, video data, or analytics are ever collected or transmitted.

SUPPORT

Need help or want to suggest a new feature or site adapter? Visit our GitHub repository to submit issues or feature requests.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Provides an overlay-independent control bar, video downloader/recorder, and keyboard shortcuts for HTML5 videos on any website.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | public/icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | promo/screenshot-1-instagram.png |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | promo/screenshot-2-themes.png |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | promo/screenshot-3-popup.png |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | promo/tile-small.png |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | promo/tile-marquee.png |

### Screenshot Notes
- Screenshot 1: Shows Instagram Web feed with a video displaying the sleek Minimal controller bar, highlighting the interactive scrub timeline and speed controls over Instagram's transparent overlay.
- Screenshot 2: Side-by-side showcase of the four built-in themes: Classic Dark, Midnight OLED, Glassmorphism, and Ocean Blue.
- Screenshot 3: The extension popup UI showing global and domain-specific settings, current active video count, and keyboard shortcut guide.

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| storage | permissions | Used to save user preferences, per-domain enable/disable toggles, selected themes, custom shortcuts, and seek intervals synced across browser sessions. |
| downloads | permissions | Required to download detected video files or user-recorded live media streams directly to the browser's download folder. |
| &lt;all_urls&gt; | host_permissions | Required to detect HTML5 video elements and display controls on any website the user visits, including Instagram, YouTube, and news or media sites. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|---|---|---|---|---|
| Personally identifiable info | No | No | None | No |
| Health info | No | No | None | No |
| Financial info | No | No | None | No |
| Authentication info | No | No | None | No |
| Personal communications | No | No | None | No |
| Location | No | No | None | No |
| Web history | No | No | None | No |
| User activity | No | No | None | No |
| Website content | No | No | None | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
https://github.com/Pouria7/universal-floating-video-controls/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
Universal Video Tools

**Contact Email** [REQUIRED]
support@universalvideotools.example.com

**Support URL / Email** [RECOMMENDED]
https://github.com/Pouria7/universal-floating-video-controls/issues

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-09-20 | Release: Universal HTML5 detection, Instagram & YouTube preview adapters, Shadow DOM isolation, context menu video downloader, MSE live stream recorder, 4 themes, customizable combo shortcuts, 3x speed, and Minimal pill mode. | Ready to Submit |

## Review Notes

### Known Issues / Limitations
- None. Fully compliant with Manifest V3 and Content Security Policy requirements.
