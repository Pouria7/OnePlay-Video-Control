# Roadmap & Future Ideas — OnePlay Video Control

This document outlines planned technical improvements, architectural enhancements, and upcoming features for future releases of OnePlay - Video Control.

---

## 📌 Next Release (v1.1.0)

### 1. Volume State Management & YouTube Preview Unmute
* **Current Issue:** In YouTube video preview cards (`ytd-video-preview`), YouTube's internal listeners forcefully reset volume to 0 and re-apply `muted`. When capturing events with `e.stopImmediatePropagation()` to prevent YouTube's override, controller-level listeners also get halted, preventing volume icons and sliders from syncing properly.
* **Architectural Solution:**
  1. Introduce an **Internal Volume State Store** (`internalVolume`, `internalMuted`) inside `VideoController`.
  2. Direct user interaction with the volume slider or mute button immediately updates the internal state and the UI (icons, slider thumb).
  3. Apply the verified volume value directly to the video element.
  4. External media event listeners only synchronize UI state when changes originate outside user interaction.
* **YouTube Adapter:** Enable smooth, stable audio unmuting on preview cards without relying on heavy polling loops.

---

### 2. Granular Context Menu Items
* **Current Issue:** On restricted domains (such as YouTube under Chrome Web Store policies), the entire right-click context menu is currently disabled because the download button is its only action.
* **Solution:**
  1. Maintain the context menu active for non-download actions (e.g., Copy Timestamped URL, Picture-in-Picture, Screenshot Frame, Audio Boost).
  2. Selectively hide only download-related actions (`ui.contextDownloadBtn`) when `isDownloadRestricted()` evaluates to `true`, leaving other tools accessible.

---

## 💡 Backlog & Proposed Features

- [ ] **Frame-by-Frame Seek:** Keyboard shortcuts (<kbd>,</kbd> and <kbd>.</kbd>) to step backward and forward by a single video frame.
- [ ] **Screenshot Video Frame:** One-click snapshot capture of the current video frame in native resolution (PNG/JPEG).
- [ ] **A-B Video Section Looper:** Set point A and point B to continuously loop a specific segment of any video.
- [ ] **Audio Compressor / Night Mode:** Dynamic range compression to balance loud sound effects and quiet dialogue.
- [ ] **Picture-in-Picture (PiP) Trigger:** Direct toggle button on the controller to pop out the video into Chrome's native PiP window.
- [ ] **Speed Presets Expansion:** Customizable speed presets and fine-grained 0.1x increment hotkeys.
