import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoController } from '../src/content/controller/video-controller';
import { ResolvedConfig } from '../src/storage/types';

describe('VideoController Context Menu & Download', () => {
  let video: HTMLVideoElement;
  let config: ResolvedConfig;

  beforeEach(() => {
    document.body.innerHTML = '';
    video = document.createElement('video');
    video.src = 'https://example.com/assets/video_sample.mp4';
    document.body.appendChild(video);

    config = {
      theme: 'classic-dark',
      controlsLayout: 'full',
      controllerPosition: 'bottom-inside',
      autoHideDelay: 2500,
      seekInterval: 5,
      volumeStep: 0.05,
      enableShortcuts: true,
      shortcuts: {
        togglePlay: 'Space',
        seekBack: 'ArrowLeft',
        seekForward: 'ArrowRight',
        volumeUp: 'ArrowUp',
        volumeDown: 'ArrowDown',
        toggleMute: 'KeyM',
        toggleFullscreen: 'KeyF'
      }
    };
  });

  it('renders context menu in Shadow DOM and opens on right-click', () => {
    const controller = new VideoController('test-1', video, config);
    const host = document.querySelector('.ufvc-controller-root') as HTMLElement;
    expect(host).toBeTruthy();

    const shadow = host.shadowRoot!;
    const bar = shadow.querySelector('.ufvc-bar') as HTMLElement;
    const contextMenu = shadow.querySelector('.ufvc-context-menu') as HTMLElement;
    const downloadBtn = shadow.querySelector('.ufvc-context-download') as HTMLButtonElement;

    expect(contextMenu).toBeTruthy();
    expect(downloadBtn).toBeTruthy();
    expect(contextMenu.classList.contains('open')).toBe(false);

    // Simulate right click on bar
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50
    });
    bar.dispatchEvent(event);

    expect(contextMenu.classList.contains('open')).toBe(true);

    // Pressing Escape closes context menu
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(contextMenu.classList.contains('open')).toBe(false);

    controller.destroy();
  });

  it('triggers download message to chrome.runtime when download item is clicked', () => {
    const sendMessageMock = vi.fn((msg, cb) => {
      if (cb) cb({ success: true });
    });
    (globalThis as any).chrome = {
      runtime: {
        sendMessage: sendMessageMock,
        lastError: null
      }
    };

    const controller = new VideoController('test-2', video, config);
    const host = document.querySelector('.ufvc-controller-root') as HTMLElement;
    const shadow = host.shadowRoot!;
    const bar = shadow.querySelector('.ufvc-bar') as HTMLElement;
    const contextMenu = shadow.querySelector('.ufvc-context-menu') as HTMLElement;
    const downloadBtn = shadow.querySelector('.ufvc-context-download') as HTMLButtonElement;

    // Open menu
    bar.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 30 }));
    expect(contextMenu.classList.contains('open')).toBe(true);

    // Click download
    downloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(contextMenu.classList.contains('open')).toBe(false);
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DOWNLOAD_VIDEO',
        url: 'https://example.com/assets/video_sample.mp4'
      }),
      expect.any(Function)
    );

    controller.destroy();
  });

  it('handles blob: URLs via stream recording or same-origin fetch without crashing', async () => {
    video.src = 'blob:https://www.youtube.com/mock-stream-id-123';

    // Mock captureStream
    const fakeStream = {} as MediaStream;
    (video as any).captureStream = vi.fn(() => fakeStream);

    // Mock MediaRecorder
    class MockMediaRecorder {
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported = vi.fn(() => true);

      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }
    (globalThis as any).MediaRecorder = MockMediaRecorder;

    const controller = new VideoController('test-3', video, config);
    const host = document.querySelector('.ufvc-controller-root') as HTMLElement;
    const shadow = host.shadowRoot!;
    const downloadBtn = shadow.querySelector('.ufvc-context-download') as HTMLButtonElement;
    const recIndicator = shadow.querySelector('.ufvc-rec-indicator') as HTMLElement;

    // Click download on blob video
    downloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Wait a tick for async download logic
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recIndicator.style.display).toBe('inline-flex');

    // Click again to stop & save
    downloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recIndicator.style.display).toBe('none');

    controller.destroy();
  });

  it('toggles popups-down class when controller is near top of viewport (< 250px)', async () => {
    // Mock getBoundingClientRect on video
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      bottom: 250,
      left: 100,
      right: 500,
      width: 400,
      height: 200,
      x: 100,
      y: 50,
      toJSON: () => {}
    });

    const controller = new VideoController('test-popups-top', video, config);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const host = document.querySelector('.ufvc-controller-root') as HTMLElement;
    const shadow = host.shadowRoot!;
    const bar = shadow.querySelector('.ufvc-bar') as HTMLElement;

    // pos.top will be bottom - 44 - 10 = 196 (< 300)
    expect(bar.classList.contains('popups-down')).toBe(true);

    controller.destroy();
  });

  it('does not toggle popups-down when controller is far from top (>= 300px)', async () => {
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      bottom: 800,
      left: 100,
      right: 500,
      width: 400,
      height: 300,
      x: 100,
      y: 500,
      toJSON: () => {}
    });

    const controller = new VideoController('test-popups-bottom', video, config);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const host = document.querySelector('.ufvc-controller-root') as HTMLElement;
    const shadow = host.shadowRoot!;
    const bar = shadow.querySelector('.ufvc-bar') as HTMLElement;

    // pos.top will be 800 - 44 - 10 = 746 (>= 250)
    expect(bar.classList.contains('popups-down')).toBe(false);

    controller.destroy();
  });
});

