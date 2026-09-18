/**
 * Future Feature Plugin Architecture
 *
 * Provides a modular, decoupled contract for future video extensions such as:
 * - Subtitle generation / translation
 * - AI audio dubbing
 * - Video looper / A-B repeat
 * - Frame screenshot capture
 * - Audio equalizer / compressor
 * - Picture-in-Picture
 */

export interface VideoFeatureContext {
  readonly video: HTMLVideoElement;
  readonly controllerRoot: ShadowRoot;
  showToast(message: string, durationMs?: number): void;
}

export interface VideoFeaturePlugin {
  readonly id: string;
  readonly name: string;
  readonly iconSvg?: string;

  /**
   * Called when a floating controller is mounted for a video
   */
  initialize(context: VideoFeatureContext): void | Promise<void>;

  /**
   * Called when the user triggers the feature action
   */
  execute?(context: VideoFeatureContext): void | Promise<void>;

  /**
   * Cleanup resources when controller is unmounted
   */
  destroy(context: VideoFeatureContext): void;
}

export class FeaturePluginRegistry {
  private plugins = new Map<string, VideoFeaturePlugin>();

  register(plugin: VideoFeaturePlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  getAll(): VideoFeaturePlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const featurePluginRegistry = new FeaturePluginRegistry();
