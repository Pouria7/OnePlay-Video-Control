/**
 * Content Script Coordinator for Universal Floating Video Controls
 *
 * Coordinates VideoRegistry, VideoObserver, SiteAdapters, ControllerManager,
 * and ShortcutManager while remaining completely isolated from host-site DOM hierarchies.
 */

import { storageManager } from '../storage/storage-manager';
import { resolveEffectiveConfig } from '../storage/config-precedence';
import { ResolvedConfig } from '../storage/types';
import { themeEngine } from '../themes/theme-engine';
import { adapterManager } from './adapters/adapter-manager';
import { SiteAdapter } from './adapters/site-adapter';
import { VideoRegistry } from './detection/video-registry';
import { VideoObserver } from './detection/video-observer';
import { selectActiveVideos } from './detection/video-selector';
import { ControllerManager } from './controller/controller-manager';
import { ShortcutManager } from './shortcuts/shortcut-manager';
import { getDomainFromUrl } from '../utils/url';
import { debounce } from '../utils/throttle';

class ContentCoordinator {
  private currentUrl = new URL(window.location.href);
  private currentDomain = getDomainFromUrl(window.location);
  private activeAdapter: SiteAdapter;
  private currentConfig!: ResolvedConfig;

  private registry!: VideoRegistry;
  private controllerManager!: ControllerManager;
  private shortcutManager!: ShortcutManager;
  private observer!: VideoObserver;

  private isInitialized = false;

  constructor() {
    this.activeAdapter = adapterManager.resolve(this.currentUrl);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Load storage & compute effective configuration
    await this.reloadConfiguration();

    // 2. Initialize Controller Manager
    this.controllerManager = new ControllerManager(this.currentConfig, (video, isHovered, host) => {
      if (this.activeAdapter.onControllerHover) {
        this.activeAdapter.onControllerHover(video, isHovered, host);
      }
    });

    // 3. Initialize Shortcut Manager
    this.shortcutManager = new ShortcutManager(this.controllerManager, {
      seekInterval: this.currentConfig.seekInterval,
      shortcuts: this.currentConfig.shortcuts
    });
    this.shortcutManager.start();

    // 4. Initialize Video Registry
    this.registry = new VideoRegistry(
      () => this.scheduleSelection(),
      (videoId, video) => {
        this.controllerManager.removeController(video);
        if (this.activeAdapter.onVideoDeactivated) {
          this.activeAdapter.onVideoDeactivated(video);
        }
      }
    );

    // 5. Initialize DOM Video Observer
    this.observer = new VideoObserver({
      onVideoAdded: (video) => {
        this.registry.register(video, this.currentConfig);
        if (this.activeAdapter.onVideoDetected) {
          this.activeAdapter.onVideoDetected(video);
        }
        this.scheduleSelection();
      },
      onVideoRemoved: (video) => {
        this.registry.unregister(video);
        this.scheduleSelection();
      }
    });

    this.observer.start();

    // 6. Listen for storage changes in real time
    storageManager.onChanged(async () => {
      await this.reloadConfiguration();
      this.controllerManager.updateConfig(this.currentConfig);
      this.shortcutManager.updateConfig({
        seekInterval: this.currentConfig.seekInterval,
        shortcuts: this.currentConfig.shortcuts
      });
      this.scheduleSelection();
    });

    // 7. Handle SPA navigation (pushState, replaceState, popstate, hashchange)
    this.setupSpaNavigationListener();

    // 8. Handle runtime messages (e.g. from popup query)
    this.setupMessageListener();

    // 9. Periodic & mousemove verification for dynamic cards / horizontal moving previews
    window.addEventListener(
      'mousemove',
      debounce(() => {
        this.scheduleSelection();
      }, 150),
      { passive: true }
    );

    setInterval(() => {
      this.scheduleSelection();
    }, 500);
  }

  /**
   * Reloads and cascades configuration layers:
   * User per-site > Site adapter > Global user > Built-in defaults
   */
  private async reloadConfiguration(): Promise<void> {
    const all = await storageManager.getAll();
    themeEngine.setCustomThemes(all.customThemes);

    this.activeAdapter = adapterManager.resolve(this.currentUrl);

    this.currentConfig = resolveEffectiveConfig({
      domain: this.currentDomain,
      userSiteSettings: all.siteSettings[this.currentDomain],
      adapterOverrides: this.activeAdapter.getConfigOverrides(),
      globalUserSettings: all.globalSettings
    });
  }

  /**
   * Debounced candidate selection to avoid churning during high-frequency events
   */
  private scheduleSelection = debounce(() => {
    if (!this.currentConfig.enabled) {
      this.controllerManager.destroyAll();
      return;
    }

    const candidates = this.registry.getCandidates();
    const activeCandidates = selectActiveVideos(
      candidates,
      this.currentConfig,
      this.activeAdapter.selectVideos ? (c) => this.activeAdapter.selectVideos!(c) : undefined
    );

    // Sync active controllers
    this.controllerManager.syncActiveVideos(activeCandidates, this.currentConfig);

    // Notify adapter of newly activated videos
    if (this.activeAdapter.onVideoActivated) {
      activeCandidates.forEach((c) => this.activeAdapter.onVideoActivated!(c.element));
    }
  }, 50);

  /**
   * Intercepts SPA route changes
   */
  private setupSpaNavigationListener(): void {
    const checkNavigation = () => {
      const newUrl = new URL(window.location.href);
      if (newUrl.href !== this.currentUrl.href) {
        this.currentUrl = newUrl;
        const newDomain = getDomainFromUrl(newUrl);
        if (newDomain !== this.currentDomain) {
          this.currentDomain = newDomain;
          this.reloadConfiguration().then(() => {
            this.scheduleSelection();
          });
        }
        // Rescan videos on route change
        this.observer.scanInitialVideos();
        this.scheduleSelection();
      }
    };

    window.addEventListener('popstate', checkNavigation, { passive: true });
    window.addEventListener('hashchange', checkNavigation, { passive: true });

    // Monkey-patch pushState & replaceState for seamless SPA tracking
    const originalPushState = history.pushState;
    history.pushState = function (...args: any[]) {
      const result = originalPushState.apply(this, args as any);
      window.dispatchEvent(new Event('ufvc-navigation'));
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args: any[]) {
      const result = originalReplaceState.apply(this, args as any);
      window.dispatchEvent(new Event('ufvc-navigation'));
      return result;
    };

    window.addEventListener('ufvc-navigation', checkNavigation, { passive: true });
  }

  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === 'GET_STATUS') {
          sendResponse({
            domain: this.currentDomain,
            adapterId: this.activeAdapter.id,
            adapterName: this.activeAdapter.name,
            config: this.currentConfig,
            trackedCount: this.registry.size(),
            activeCount: this.controllerManager.activeCount()
          });
          return true;
        }
        return false;
      });
    }
  }
}

// Bootstrap coordinator
const coordinator = new ContentCoordinator();
coordinator.initialize().catch((err) => {
  console.error('[UFVC] Initialization error:', err);
});
