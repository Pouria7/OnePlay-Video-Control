import { SiteAdapter } from '../adapters/site-adapter';
import {
  ActionExecutionContext,
  ActionPayloadMap,
  ChangeSource,
  VideoActionType,
  VideoAdapterContext
} from '../adapters/action-types';

export class VideoActionDispatcher {
  constructor(
    private readonly baseContext: VideoAdapterContext | (() => VideoAdapterContext),
    private readonly adapter: SiteAdapter
  ) {}

  private getContext(): VideoAdapterContext {
    return typeof this.baseContext === 'function' ? this.baseContext() : this.baseContext;
  }

  /**
   * Executes a user-initiated controller action sequentially:
   * 1. `await hook.before(ctx)` (allows payload mutation, short delays, or cancellation)
   * 2. `await coreAction(ctx.payload)`
   * 3. `await hook.after(ctx)`
   */
  public async dispatchUserAction<K extends VideoActionType>(
    action: K,
    initialPayload: ActionPayloadMap[K],
    coreAction: (payload: ActionPayloadMap[K]) => void | Promise<void>
  ): Promise<void> {
    const hook = this.adapter.actions?.[action];
    let cancelled = false;

    const ctx: ActionExecutionContext<K> = {
      ...this.getContext(),
      action,
      source: 'user',
      payload: initialPayload,
      cancel: () => {
        cancelled = true;
      },
      get isCancelled() {
        return cancelled;
      }
    };

    if (hook?.before) {
      await hook.before(ctx);
    }

    if (ctx.isCancelled) {
      return;
    }

    await coreAction(ctx.payload);

    if (hook?.after) {
      await hook.after(ctx);
    }
  }

  /**
   * Invokes the `after` hook when a legitimate external media change is detected by a GuardedState/listener.
   */
  public async notifyExternalAfter<K extends VideoActionType>(
    action: K,
    payload: ActionPayloadMap[K],
    source: ChangeSource = 'external'
  ): Promise<void> {
    if (source === 'user') return; // Already handled sequentially at the end of dispatchUserAction
    const hook = this.adapter.actions?.[action];
    if (!hook?.after) return;

    const ctx: ActionExecutionContext<K> = {
      ...this.getContext(),
      action,
      source: 'external',
      payload,
      cancel: () => {},
      isCancelled: false
    };

    await hook.after(ctx);
  }
}
