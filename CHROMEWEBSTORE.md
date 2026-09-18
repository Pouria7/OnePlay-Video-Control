# Chrome Web Store Listing — Universal Floating Video Controls

> Last Updated: 2026-09-18

## Store Listing

**Extension Name** [REQUIRED]
Universal Floating Video Controls

**Short Description** [REQUIRED]
Universal floating video controls for HTML5 videos across the web, designed for resilient overlay-independent playback.

**Detailed Description** [REQUIRED]
Control any HTML5 video across the web with a sleek, floating, site-independent playback bar that never gets blocked by website overlays.

Have you ever struggled to scrub through videos on social media sites or websites that cover their players with transparent click-blocking layers? Universal Floating Video Controls provides a dedicated, floating playback controller positioned seamlessly above any active HTML5 video.

KEY FEATURES

• Universal Playback Control: Play, pause, seek, adjust volume, mute, toggle fullscreen, and adjust playback speed (0.5x to 2x) on any HTML5 video.
• Resilient to Layout Changes: Unlike traditional extensions that inject into fragile website code, our floating controller is completely isolated, working smoothly even on complex dynamic feeds like Instagram and video previews like YouTube.
• Overlay Immune: Transparent tap overlays, click-jacking layers, and custom player masks cannot block your controls.
• Intelligent Video Selection: Automatically detects active videos, prioritizes audible audio, and highlights the video you are actually watching.
• Multiple Simultaneous Videos: Supports controlling multiple visible videos when browsing multi-video feeds or split views.
• Customizable Themes: Choose between Minimal (Default), Minimal Dark, Glassmorphism, and Cyber Accent Blue. Customize themes globally or per website.
• Fluent Keyboard Shortcuts: Use Space to play/pause, Left/Right arrows or J/L to seek, and Up/Down arrows to adjust volume. Shortcuts automatically pause when you are typing into text boxes or comment fields.

HOW TO USE IT

1. Install Universal Floating Video Controls.
2. Browse to any website with HTML5 videos, such as Instagram or YouTube.
3. As soon as a video appears in your viewport, the floating controller appears docked at the bottom of the video.
4. Use the interactive scrub bar to jump to any point in the video, or use the keyboard shortcuts.
5. Click the extension icon in your browser toolbar to customize themes or toggle controls for specific websites.

PRIVACY FIRST

Universal Floating Video Controls processes all video detection and controls locally inside your browser. No browsing history, account credentials, video data, or analytics are ever collected or transmitted.

SUPPORT

Need help or want to suggest a new feature or site adapter? Visit our GitHub repository to submit issues or feature requests.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Provides an overlay-independent floating control bar and keyboard shortcuts for HTML5 videos on any website.

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
- Screenshot 1: Shows Instagram Web feed with a video displaying the sleek Minimal floating controller bar, highlighting the interactive scrub timeline and speed controls over Instagram's transparent overlay.
- Screenshot 2: Side-by-side showcase of the four built-in themes: Minimal, Minimal Dark, Glassmorphism, and Accent Blue.
- Screenshot 3: The extension popup UI showing global and domain-specific settings, current active video count, and keyboard shortcut guide.

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| storage | permissions | Used to save user preferences, per-domain enable/disable toggles, selected themes, and custom seek intervals synced across browser sessions. |
| &lt;all_urls&gt; | host_permissions | Required to detect HTML5 video elements and display floating controls on any website the user visits, including Instagram, YouTube, and news or media sites. |

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
https://github.com/universal-floating-video-controls/privacy-policy

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
Universal Video Tools

**Contact Email** [REQUIRED]
support@universalvideotools.example.com

**Support URL / Email** [RECOMMENDED]
https://github.com/universal-floating-video-controls/issues

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-09-18 | Initial release with Universal HTML5 detection, Instagram & YouTube adapters, Shadow DOM isolation, 4 themes, and keyboard shortcuts. | Ready to Submit |

## Review Notes

### Known Issues / Limitations
- None. Fully compliant with Manifest V3 and Content Security Policy requirements.
