import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GuardedState } from '../src/content/state/guarded-state';
import { VideoActionDispatcher } from '../src/content/actions/action-dispatcher';
import { GenericAdapter } from '../src/content/adapters/generic-adapter';
import { InstagramAdapter } from '../src/content/adapters/instagram-adapter';
import { YouTubeAdapter } from '../src/content/adapters/youtube-adapter';
import { VideoController } from '../src/content/controller/video-controller';
import { ShortcutManager } from '../src/content/shortcuts/shortcut-manager';
import { VideoAdapterContext } from '../src/content/adapters/action-types';
import { VolumeState } from '../src/content/state/volume-state';
import { PlaybackRateState } from '../src/content/state/playback-rate-state';
import { ResolvedConfig, DEFAULT_SHORTCUTS } from '../src/storage/types';
import { normalizeKey, formatShortcutForDisplay, matchesShortcut } from '../src/utils/shortcuts';

describe('GuardedState<T>', () => {
  let domValue: number;

  beforeEach(() => {
    domValue = 1.0;
  });

  it('reads initial state from DOM via readFromDom', () => {
    const state = new GuardedState<number>({
      readFromDom: () => domValue,
      applyToDom: (v) => {
        domValue = v;
      },
      isEqual: (a, b) => a === b
    });

    expect(state.snapshot).toBe(1.0);
  });

  it('commits user changes to DOM and notifies listeners with user source', () => {
    const state = new GuardedState<number>({
      readFromDom: () => domValue,
      applyToDom: (v) => {
        domValue = v;
      },
      isEqual: (a, b) => a === b
    });

    const listener = vi.fn();
    state.subscribe(listener);

    state.commitUser(2.0);

    expect(domValue).toBe(2.0);
    expect(state.snapshot).toBe(2.0);
    expect(listener).toHaveBeenCalledWith(2.0, 'user');
  });

  it('suppresses echo when DOM change matches current state', () => {
    const state = new GuardedState<number>({
      readFromDom: () => domValue,
      applyToDom: (v) => {
        domValue = v;
      },
      isEqual: (a, b) => a === b
    });

    const listener = vi.fn();
    state.subscribe(listener);

    // Trigger DOM event with same value
    state.handleDomEvent();

    expect(listener).not.toHaveBeenCalled();
  });

  it('reverts unauthorized external changes within guard window up to maxReapplies', () => {
    let now = 1000;
    const state = new GuardedState<number>({
      readFromDom: () => domValue,
      applyToDom: (v) => {
        domValue = v;
      },
      isEqual: (a, b) => a === b,
      shouldRevertExternal: (userState, domState) => userState > 0 && domState === 0,
      guardWindowMs: 2000,
      maxReapplies: 2,
      now: () => now
    });

    state.commitUser(0.8);
    expect(domValue).toBe(0.8);

    // Site forcefully resets to 0 at 1400ms (within 2000ms guard)
    now = 1400;
    domValue = 0;
    state.handleDomEvent();

    // Should revert back to 0.8 (reapply 1)
    expect(domValue).toBe(0.8);

    // Site forcefully resets again at 1600ms (within guard)
    now = 1600;
    domValue = 0;
    state.handleDomEvent();

    // Should revert back to 0.8 (reapply 2)
    expect(domValue).toBe(0.8);

    // Site forcefully resets again at 1800ms (exceeds maxReapplies of 2)
    now = 1800;
    domValue = 0;
    state.handleDomEvent();

    // Reapply limit reached; accepts external change
    expect(domValue).toBe(0);
    expect(state.snapshot).toBe(0);
  });

  it('adopts external changes after guard window expires', () => {
    let now = 1000;
    const state = new GuardedState<number>({
      readFromDom: () => domValue,
      applyToDom: (v) => {
        domValue = v;
      },
      isEqual: (a, b) => a === b,
      shouldRevertExternal: (userState, domState) => userState > 0 && domState === 0,
      guardWindowMs: 2000,
      now: () => now
    });

    state.commitUser(0.5);

    // 3000ms later (after 2000ms guard window)
    now = 4500;
    domValue = 0;
    state.handleDomEvent();

    expect(state.snapshot).toBe(0);
  });
});

describe('VideoActionDispatcher', () => {
  let video: HTMLVideoElement;
  let host: HTMLElement;
  let baseContext: VideoAdapterContext;

  beforeEach(() => {
    video = document.createElement('video');
    host = document.createElement('div');
    baseContext = {
      video,
      controllerHost: host,
      settings: { enabled: true },
      volumeState: new VolumeState(video),
      url: new URL('https://example.com/watch?v=123'),
      updateSettings: vi.fn(),
      updateConfig: vi.fn()
    };
  });

  it('executes user action sequentially: before -> coreAction -> after', async () => {
    const sequence: string[] = [];

    const mockAdapter = {
      id: 'mock',
      name: 'Mock Adapter',
      matches: () => true,
      getConfigOverrides: () => ({}),
      actions: {
        play: {
          before: async () => {
            sequence.push('before');
          },
          after: async () => {
            sequence.push('after');
          }
        }
      }
    };

    const dispatcher = new VideoActionDispatcher(baseContext, mockAdapter);

    await dispatcher.dispatchUserAction('play', undefined as void, () => {
      sequence.push('core');
    });

    expect(sequence).toEqual(['before', 'core', 'after']);
  });

  it('allows before hook to mutate payload before core action executes', async () => {
    let receivedPayload: any = null;

    const mockAdapter = {
      id: 'mock',
      name: 'Mock Adapter',
      matches: () => true,
      getConfigOverrides: () => ({}),
      actions: {
        toggleFullscreen: {
          before: (ctx: any) => {
            ctx.payload.fillToFit = false;
          }
        }
      }
    };

    const dispatcher = new VideoActionDispatcher(baseContext, mockAdapter);

    await dispatcher.dispatchUserAction(
      'toggleFullscreen',
      { entering: true, fillToFit: true },
      (payload) => {
        receivedPayload = payload;
      }
    );

    expect(receivedPayload).toEqual({ entering: true, fillToFit: false });
  });

  it('aborts coreAction and after hook when ctx.cancel() is called in before hook', async () => {
    const coreAction = vi.fn();
    const afterHook = vi.fn();

    const mockAdapter = {
      id: 'mock',
      name: 'Mock Adapter',
      matches: () => true,
      getConfigOverrides: () => ({}),
      actions: {
        seek: {
          before: (ctx: any) => {
            ctx.cancel();
          },
          after: afterHook
        }
      }
    };

    const dispatcher = new VideoActionDispatcher(baseContext, mockAdapter);

    await dispatcher.dispatchUserAction('seek', { targetTime: 30 }, coreAction);

    expect(coreAction).not.toHaveBeenCalled();
    expect(afterHook).not.toHaveBeenCalled();
  });

  it('notifies external after hook for external source, but ignores user source', async () => {
    const afterHook = vi.fn();

    const mockAdapter = {
      id: 'mock',
      name: 'Mock Adapter',
      matches: () => true,
      getConfigOverrides: () => ({}),
      actions: {
        setSpeed: {
          after: afterHook
        }
      }
    };

    const dispatcher = new VideoActionDispatcher(baseContext, mockAdapter);

    // user source should be ignored (since dispatchUserAction handles user after sequentially)
    await dispatcher.notifyExternalAfter('setSpeed', { rate: 1.5 }, 'user');
    expect(afterHook).not.toHaveBeenCalled();

    // external source invokes after hook
    await dispatcher.notifyExternalAfter('setSpeed', { rate: 1.5 }, 'external');
    expect(afterHook).toHaveBeenCalledTimes(1);
    expect(afterHook).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'setSpeed',
        source: 'external',
        payload: { rate: 1.5 }
      })
    );
  });
});

describe('InstagramAdapter Action Hooks', () => {
  let adapter: InstagramAdapter;
  let video: HTMLVideoElement;
  let host: HTMLElement;
  let context: VideoAdapterContext;

  beforeEach(() => {
    adapter = new InstagramAdapter();
    video = document.createElement('video');
    host = document.createElement('div');
    context = {
      video,
      controllerHost: host,
      settings: { enabled: true },
      volumeState: new VolumeState(video),
      url: new URL('https://www.instagram.com/reels/123/'),
      updateSettings: vi.fn(),
      updateConfig: vi.fn()
    };
  });

  it('disables fillToFit (sets false) on vertical video (videoHeight > videoWidth) when entering fullscreen', async () => {
    // Set vertical dimensions
    Object.defineProperty(video, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1280, configurable: true });

    const dispatcher = new VideoActionDispatcher(context, adapter);
    let capturedPayload: any = null;

    await dispatcher.dispatchUserAction(
      'toggleFullscreen',
      { entering: true, fillToFit: true },
      (payload) => {
        capturedPayload = payload;
      }
    );

    expect(capturedPayload.fillToFit).toBe(false);
  });

  it('preserves fillToFit (keeps true) on horizontal video (videoHeight <= videoWidth)', async () => {
    // Set horizontal landscape dimensions
    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });

    const dispatcher = new VideoActionDispatcher(context, adapter);
    let capturedPayload: any = null;

    await dispatcher.dispatchUserAction(
      'toggleFullscreen',
      { entering: true, fillToFit: true },
      (payload) => {
        capturedPayload = payload;
      }
    );

    expect(capturedPayload.fillToFit).toBe(true);
  });

  it('does not alter fillToFit when exiting fullscreen', async () => {
    Object.defineProperty(video, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1280, configurable: true });

    const dispatcher = new VideoActionDispatcher(context, adapter);
    let capturedPayload: any = null;

    await dispatcher.dispatchUserAction(
      'toggleFullscreen',
      { entering: false, fillToFit: true },
      (payload) => {
        capturedPayload = payload;
      }
    );

    expect(capturedPayload.fillToFit).toBe(true);
  });

  it('enables pointer events on video activation', () => {
    video.style.pointerEvents = 'none';
    adapter.onVideoActivated(context);
    expect(video.style.pointerEvents).toBe('auto');
  });

  it('filters video and scores video using clean context objects or elements', () => {
    video.getBoundingClientRect = () =>
      ({ width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200 } as DOMRect);

    // Context call
    expect(adapter.filterVideo({ video, url: new URL('https://instagram.com/reels/1') })).toBe(true);

    // Direct element call
    expect(adapter.filterVideo(video)).toBe(true);

    // Score context call
    const score = adapter.scoreVideo({
      video,
      url: new URL('https://instagram.com/reels/1'),
      candidate: {
        isPlaying: true,
        intersectionRatio: 0.8,
        boundingRect: video.getBoundingClientRect(),
        isMuted: false,
        volume: 1
      }
    });
    expect(score).toBe(150);
  });
});

describe('GenericAdapter Universal Defaults', () => {
  let generic: GenericAdapter;
  let video: HTMLVideoElement;

  beforeEach(() => {
    generic = new GenericAdapter();
    video = document.createElement('video');
  });

  it('provides sensible universal defaults', () => {
    expect(generic.matches(new URL('https://any-site.com'))).toBe(true);
    expect(generic.getConfigOverrides()).toEqual({});
    expect(generic.filterVideo({ video, url: new URL('https://any-site.com') })).toBe(true);
    expect(
      generic.scoreVideo({
        video,
        url: new URL('https://any-site.com'),
        candidate: { isPlaying: true, intersectionRatio: 1, boundingRect: {} as any, isMuted: false, volume: 1 }
      })
    ).toBeNull();
  });

  it('provides universal vertical video fullscreen fix (fillToFit = false)', async () => {
    Object.defineProperty(video, 'videoWidth', { value: 600, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1200, configurable: true });

    const dispatcher = new VideoActionDispatcher(
      {
        video,
        controllerHost: document.createElement('div'),
        settings: { enabled: true },
        volumeState: new VolumeState(video),
        url: new URL('https://any-site.com'),
        updateSettings: vi.fn(),
        updateConfig: vi.fn()
      },
      generic
    );

    let capturedPayload: any = null;
    await dispatcher.dispatchUserAction(
      'toggleFullscreen',
      { entering: true, fillToFit: true },
      (payload) => {
        capturedPayload = payload;
      }
    );

    expect(capturedPayload.fillToFit).toBe(false);
  });
});

describe('VideoController Actions & Speed Controls', () => {
  let video: HTMLVideoElement;
  let config: ResolvedConfig;

  beforeEach(() => {
    video = document.createElement('video');
    video.playbackRate = 1.0;
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });

    config = {
      enabled: true,
      theme: 'classic-dark',
      controllerPosition: 'bottom-inside',
      controlsLayout: 'full',
      minWidth: 160,
      minHeight: 120,
      visibilityThreshold: 0.7,
      seekInterval: 5,
      allowMultiple: true,
      autoHideDelay: 2200,
      shortcuts: { ...DEFAULT_SHORTCUTS }
    };
  });

  it('exposes adapter context, dispatcher and adapter', () => {
    const adapter = new InstagramAdapter();
    const controller = new VideoController('test-c', video, config, undefined, adapter);

    expect(controller.getAdapter()).toBe(adapter);
    expect(controller.getAdapterContext().video).toBe(video);
    expect(controller.getDispatcher()).toBeDefined();

    controller.destroy();
  });

  it('steps playback speed down and up through SPEED_PRESETS', async () => {
    const controller = new VideoController('test-speed', video, config);
    video.playbackRate = 1.0;

    await controller.speedUp();
    expect(video.playbackRate).toBe(1.25);

    await controller.speedUp();
    expect(video.playbackRate).toBe(1.5);

    await controller.speedDown();
    expect(video.playbackRate).toBe(1.25);

    await controller.speedDown();
    expect(video.playbackRate).toBe(1.0);

    await controller.speedDown();
    expect(video.playbackRate).toBe(0.75);

    controller.destroy();
  });

  it('applies objectFit contain when entering fullscreen on Instagram vertical video', async () => {
    Object.defineProperty(video, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1280, configurable: true });
    video.requestFullscreen = vi.fn().mockResolvedValue(undefined);

    const adapter = new InstagramAdapter();
    const controller = new VideoController('test-fs', video, config, undefined, adapter);

    await controller.toggleFullscreen();

    expect(video.style.objectFit).toBe('contain');
    expect(video.requestFullscreen).toHaveBeenCalled();

    controller.destroy();
  });
});

describe('Keyboard Speed Shortcuts & Key Normalization', () => {
  it('normalizes BracketLeft and [ to bracketleft', () => {
    expect(normalizeKey('[')).toBe('bracketleft');
    expect(normalizeKey('BracketLeft')).toBe('bracketleft');
    expect(normalizeKey(']')).toBe('bracketright');
    expect(normalizeKey('BracketRight')).toBe('bracketright');
  });

  it('formats BracketLeft and BracketRight for display', () => {
    expect(formatShortcutForDisplay('BracketLeft')).toBe('[');
    expect(formatShortcutForDisplay('BracketRight')).toBe(']');
    expect(formatShortcutForDisplay('Ctrl+BracketLeft')).toBe('Ctrl + [');
  });

  it('matches keyboard event for BracketLeft and BracketRight', () => {
    const eventLeft = new KeyboardEvent('keydown', { code: 'BracketLeft', key: '[' });
    const eventRight = new KeyboardEvent('keydown', { code: 'BracketRight', key: ']' });

    expect(matchesShortcut(eventLeft, 'BracketLeft')).toBe(true);
    expect(matchesShortcut(eventLeft, '[')).toBe(true);
    expect(matchesShortcut(eventRight, 'BracketRight')).toBe(true);
    expect(matchesShortcut(eventRight, ']')).toBe(true);
  });

  it('triggers speedDown and speedUp on target controller and shows controls', () => {
    const mockController: any = {
      video: { paused: false, isConnected: true },
      speedDown: vi.fn(),
      speedUp: vi.fn(),
      showControls: vi.fn(),
      resetAutoHideTimer: vi.fn()
    };

    const mockManager: any = {
      getAllControllers: () => [mockController]
    };

    const shortcutMgr = new ShortcutManager(mockManager, {
      seekInterval: 5,
      shortcuts: { ...DEFAULT_SHORTCUTS }
    });

    shortcutMgr.start();

    // Trigger [ (BracketLeft)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', key: '[' }));
    expect(mockController.speedDown).toHaveBeenCalled();
    expect(mockController.showControls).toHaveBeenCalled();
    expect(mockController.resetAutoHideTimer).toHaveBeenCalled();

    // Trigger ] (BracketRight)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight', key: ']' }));
    expect(mockController.speedUp).toHaveBeenCalled();

    shortcutMgr.stop();
  });
});

describe('YouTubeAdapter Shorts Support & Layout Override', () => {
  let ytAdapter: YouTubeAdapter;

  beforeEach(() => {
    ytAdapter = new YouTubeAdapter();
  });

  it('allows YouTube Shorts videos in filterVideo', () => {
    const shortsVideo = document.createElement('video');
    const shortsContainer = document.createElement('ytd-shorts');
    shortsContainer.appendChild(shortsVideo);
    document.body.appendChild(shortsContainer);

    expect(ytAdapter.filterVideo(shortsVideo)).toBe(true);

    const shortsByUrl = document.createElement('video');
    expect(ytAdapter.filterVideo({ video: shortsByUrl, url: new URL('https://www.youtube.com/shorts/abcdef123') })).toBe(true);

    shortsContainer.remove();
  });

  it('excludes YouTube main watch player in filterVideo', () => {
    const watchVideo = document.createElement('video');
    const watchFlexy = document.createElement('ytd-watch-flexy');
    watchFlexy.appendChild(watchVideo);
    document.body.appendChild(watchFlexy);

    expect(ytAdapter.filterVideo(watchVideo)).toBe(false);

    watchFlexy.remove();
  });

  it('sets controlsLayout to minimal on Shorts page when controller is enabled', () => {
    const video = document.createElement('video');
    const updateSettings = vi.fn();

    const ctx: VideoAdapterContext = {
      video,
      controllerHost: document.createElement('div'),
      settings: { enabled: true, controlsLayout: 'full' },
      volumeState: new VolumeState(video),
      url: new URL('https://www.youtube.com/shorts/xyz789'),
      updateSettings,
      updateConfig: vi.fn()
    };

    ytAdapter.onVideoActivated(ctx);

    expect(updateSettings).toHaveBeenCalledWith({ controlsLayout: 'minimal' });
  });

  it('does not override controlsLayout to minimal if controller is disabled (enabled: false)', () => {
    const video = document.createElement('video');
    const updateSettings = vi.fn();

    const ctx: VideoAdapterContext = {
      video,
      controllerHost: document.createElement('div'),
      settings: { enabled: false },
      volumeState: new VolumeState(video),
      url: new URL('https://www.youtube.com/shorts/xyz789'),
      updateSettings,
      updateConfig: vi.fn()
    };

    ytAdapter.onVideoActivated(ctx);

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('VideoController updateSettings overrides layout to minimal at runtime', () => {
    const video = document.createElement('video');
    const controller = new VideoController('test-layout-override', video, {
      ...DEFAULT_SHORTCUTS,
      enabled: true,
      theme: 'classic-dark',
      controllerPosition: 'bottom-inside',
      controlsLayout: 'full',
      minWidth: 160,
      minHeight: 120,
      visibilityThreshold: 0.7,
      seekInterval: 5,
      allowMultiple: true,
      autoHideDelay: 2200,
      shortcuts: { ...DEFAULT_SHORTCUTS }
    });

    const ctx = controller.getAdapterContext();
    expect(controller.ui.container.classList.contains('minimal-mode')).toBe(false);

    ctx.updateSettings({ controlsLayout: 'minimal' });
    expect(controller.ui.container.classList.contains('minimal-mode')).toBe(true);

    // When global config update comes in (e.g. from storage change), runtime overrides are preserved
    controller.updateConfig({ controlsLayout: 'full', autoHideDelay: 3000 });
    expect(controller.ui.container.classList.contains('minimal-mode')).toBe(true);
    expect((controller as any).config.controlsLayout).toBe('minimal');

    controller.destroy();
  });
});

describe('Constant Speed (Per-Site Playback Rate Persistence & Lock)', () => {
  it('initializes with savedSpeed and overrides any external rate change when constantSpeed is enabled', () => {
    const video = document.createElement('video');
    video.playbackRate = 1.0;

    let currentTime = 1000;
    const onPersistRate = vi.fn();

    const rateState = new PlaybackRateState(video, {
      constantSpeed: true,
      initialRate: 1.75,
      onPersistRate,
      now: () => currentTime
    });

    // Initial rate applied immediately
    expect(rateState.rate).toBe(1.75);
    expect(video.playbackRate).toBe(1.75);

    // Even 60 seconds later (well outside 2s guard window), if site changes rate to 1.0 or 1.25, it overrides back to 1.75
    currentTime += 60000;
    video.playbackRate = 1.0;
    rateState.handleMediaRateChange();
    expect(video.playbackRate).toBe(1.75);
    expect(rateState.rate).toBe(1.75);

    video.playbackRate = 1.25;
    rateState.handleMediaRateChange();
    expect(video.playbackRate).toBe(1.75);

    // User changes speed to 2.0 -> updates DOM and calls onPersistRate(2.0)
    rateState.setRate(2.0);
    expect(video.playbackRate).toBe(2.0);
    expect(onPersistRate).toHaveBeenCalledWith(2.0);
  });

  it('re-applies user speed on play and loadedmetadata events via VideoController', () => {
    const video = document.createElement('video');
    video.playbackRate = 1.0;

    const controller = new VideoController('test-const-speed', video, {
      enabled: true,
      theme: 'classic-dark',
      controllerPosition: 'bottom-inside',
      controlsLayout: 'full',
      minWidth: 160,
      minHeight: 120,
      visibilityThreshold: 0.7,
      seekInterval: 5,
      allowMultiple: true,
      autoHideDelay: 2200,
      constantSpeed: true,
      savedSpeed: 1.5,
      shortcuts: { ...DEFAULT_SHORTCUTS }
    });

    expect(video.playbackRate).toBe(1.5);

    // Simulate video source change resetting playbackRate to 1.0 before loadedmetadata/play
    video.playbackRate = 1.0;
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(video.playbackRate).toBe(1.5);

    video.playbackRate = 1.0;
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.dispatchEvent(new Event('play'));
    expect(video.playbackRate).toBe(1.5);

    controller.destroy();
  });
});
