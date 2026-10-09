# Project Architecture

Universal Video Controls is built as a website-agnostic, overlay-resilient video enhancement platform for Manifest V3. 

The architecture strictly adheres to a core philosophical invariant: **Complete DOM Decoupling**. The extension never mounts UI inside host website containers or relies on host site class hierarchies.

---

## 1. High-Level Architectural Flow

```text
Host Webpage (Videos & Observers)
       │
       ▼
[ Detection & Tracking Engine ]
  • VideoObserver (DOM mutations)
  • VideoRegistry (Geometry, Intersection, Media events)
       │
       ▼
[ Selection & Arbitration Engine ]
  • Candidate Filter (Size & visibility constraints)
  • VideoScorer (Playback state & audio scoring)
  • VideoSelector (Multi-video & 70% viewport rule)
       │
       ▼
[ Content Coordinator ] ◄──► [ Site Adapter Layer ]
  (Glues state & configuration)    (Site-specific quirks & overrides)
       │
       ├──► [ Detached Controller Layer ]
       │      • Open Shadow DOM (document.documentElement)
       │      • Viewport-relative RAF Position Tracker
       │      • Theme Engine (CSS Custom Properties)
       │
       ├──► [ Media Capture & Downloader ]
       │      • Direct & Blob URL extraction
       │      • MSE Real-time Stream Recorder (captureStream + MediaRecorder)
       │
       ├──► [ Feature Plugin Subsystem ] (Extensibility Contract)
       │      • Plugin Registry & Lifecycle Hooks (init, execute, destroy)
       │      • Scoped Context Injection (VideoFeatureContext)
       │
       └──► [ Input & Shortcuts Engine ]
              • Key binding coordinator with editable input guards
```

---

## 2. Core Abstract Subsystems

### A. Lifecycle & Registry Subsystem
Abstracts video discovery and tracking across dynamic single-page applications:
- **Observer (`VideoObserver`)**: Captures additions and removals of `<video>` elements via `MutationObserver` without polling.
- **Registry (`VideoRegistry`)**: Maintains active records (`TrackedVideo`), binding passive observers (`IntersectionObserver`, `ResizeObserver`) and media listeners to track geometry and playback states.

### B. Arbitration & Selection Subsystem
Resolves which video(s) receive active control bars when pages contain multiple candidates:
- **Filtering**: Enforces baseline dimension and visibility thresholds.
- **Scoring**: Ranks candidates based on active playback, audible audio, and viewport proximity.
- **Multi-Selection**: Coordinates concurrent controllers using the viewport visibility threshold rule.

### C. Presentation & Viewport Docking Subsystem
Renders and positions the user interface while isolating it from host page styles and event manipulation:
- **Detached Mount**: Attaches directly to `document.documentElement` to bypass parent container `overflow: hidden`, clipping, or CSS transforms.
- **Shadow DOM Boundary**: Completely encapsulates styles and prevents host script collisions.
- **Viewport Tracker**: Continuously syncs bounding client rects via `requestAnimationFrame` to pin the UI to the moving video without modifying host DOM nodes.

### D. Media Extraction & Capture Subsystem
Provides uniform media export capabilities across static and dynamic streaming formats:
- **Static Resolution**: Inspects DOM attributes, direct sources, and metadata tags for static media URLs.
- **Stream Interception**: Streams segmented MSE media (HLS/DASH/blob) via canvas/media capture APIs into a real-time recording pipeline.

### E. Site Adaptation Subsystem
Isolates site-specific behavioral rules through a polymorphic interface (`SiteAdapter`):
- Provides domain-level score modifications, preview exclusions (e.g. YouTube watch player vs hover cards), and event dampening without polluting the generic engine.

### F. Configuration & Persistence Subsystem
Implements a 4-tier hierarchical resolution model:
- `Site User Settings` > `Site Adapter Overrides` > `Global User Settings` > `Default Settings`.
- State updates propagate reactively across active controllers via `chrome.storage.sync`.

### G. Feature Plugin Extensibility Subsystem (Planned Architecture)
Designed to accommodate pluggable, modular capabilities (e.g., subtitle generation/translation, AI audio dubbing, A-B repeat loopers, frame screenshot tools, audio equalizers) without bloating the core player engine:
- **Abstract Contracts (`VideoFeaturePlugin`)**: Establishes an isolated contract with distinct lifecycle hooks (`initialize`, optional `execute`, and `destroy`).
- **Scoped Context Injection (`VideoFeatureContext`)**: Restricts plugin access to a scoped envelope containing the targeted `<video>`, the controller's `ShadowRoot`, and UI notification helpers (`showToast`), preventing cross-plugin interference or raw global state pollution.
- **Decoupled Registry (`FeaturePluginRegistry`)**: Provides a plug-and-play registry enabling optional features to register, initialize on controller mount, and cleanly tear down when a video controller unmounts.

