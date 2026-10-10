# Chrome Web Store — Submission Cheat Sheet

Fields to copy and paste into the **Chrome Developer Dashboard**:

---

### 1. Store Listing Tab

**Short Description (max 132 chars):**
```text
Reliable play, seek, speed and volume controls for any web video that site overlays can't block. Plus download and record.
```

**Detailed Description:**
```text
Take full control of any video on the web with a clean playback bar that website overlays can't block.

Ever tried to scrub through a video on a social media site, only to find the site has covered the player with invisible layers that pause, mute, or open the post when you click? Universal Video Controls puts its own control bar right on top of the video, so you can always play, pause, and jump to any moment. The video stays where it is on the page.

KEY FEATURES

• Full Playback Control: Play, pause, seek, adjust volume, mute, go fullscreen, and set playback speed from 0.5x up to 3x on any video.
• Works Where Other Controls Don't: Stays usable on dynamic feeds and video preview cards without breaking the page layout.
• Overlay-Proof: Invisible tap-to-mute or tap-to-pause layers can't block your controls.
• Save Videos:
  - Download regular video files with one click.
  - Record streaming videos directly with a live "● REC" indicator.
• Layouts & Themes: Choose between Full Controls and Minimal Pill mode, with 4 built-in themes (Classic Dark, Midnight OLED, Glassmorphism, Ocean Blue).
• Custom Keyboard Shortcuts: Control playback with keys (Space, J/L, Arrows, etc.), automatically disabled inside text and comment inputs.

HOW TO USE IT

1. Install Universal Video Controls.
2. Open any website with videos (Instagram, Twitter/X, news sites, etc.).
3. The control bar docks onto the active video automatically.
4. Drag the scrub bar or use keyboard shortcuts.
5. Right-click the bar to download or record.
6. Click the toolbar icon to tweak settings or disable for any site.

PRIVACY & SUPPORT

Runs 100% locally in your browser. No tracking, no analytics, no accounts.
Support & Feedback: oneabout@outlook.com
```

**Category:**
`Productivity`

---

### 2. Privacy Practices Tab

**Single Purpose Description:**
```text
Gives users reliable control over HTML5 videos on any website: an overlay-immune playback bar, keyboard shortcuts, and the option to save the video.
```

**Permissions Justification:**
* **storage:**
  ```text
  Saves user preferences: selected theme, layout mode, seek interval, custom shortcuts, and per-site enable/disable settings.
  ```
* **downloads:**
  ```text
  Saves downloaded video files and recorded video streams to the user's downloads folder upon request.
  ```
* **<all_urls> (Host permission):**
  ```text
  Needed to detect HTML5 video elements and display the control bar across any website the user visits. Also checks for version updates.
  ```

**Data Collection & Usage Certification:**
* **Does the extension collect user data?** Select **No**
* Check all 3 checkboxes under **Data Use Certification**

**Privacy Policy URL:**
```text
https://universal-video-controls.pages.dev/privacy
```

---

### 3. Distribution & Review Tab

**Notes for reviewer:**
```text
1. Install and open any webpage with an HTML5 video (e.g. public Instagram post or news site).
2. The control bar docks onto the video. Test seek, volume, speed, and play/pause.
3. On supported sites, right-click the bar to test Download / Record.
4. Per Chrome Web Store policy (Blue Zinc), downloading and stream recording are strictly and completely disabled on YouTube (youtube.com, youtu.be). Context menu and download triggers do not activate on YouTube.
5. Click the extension toolbar icon to open popup settings.
No login or credentials required. DRM-protected streams cannot be captured.
```

---

### 4. Graphic Assets
* **Store Icon:** `public/icons/icon-128.png` (128×128 PNG)
* **Screenshots:** Minimum 1 screenshot required (`1280×800` or `640×400` PNG/JPEG) showing the controls active over a video.
