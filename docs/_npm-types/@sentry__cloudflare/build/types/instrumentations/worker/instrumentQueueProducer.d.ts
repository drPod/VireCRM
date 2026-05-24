import type { Queue } from '@cloudflare/workers-types';
/**
 * Wraps a Queue producer binding to create `queue.publish` spans on
 * `send` and `sendBatch` calls.
 *
 * The queue's own name is not available on the binding object, so we use
 * the env binding key (e.g. `MY_QUEUE`) as `messaging.destination.name`.
 */
export declare function instrumentQueueProducer<T extends Queue>(queue: T, bindingName: string): T;
//# sourceMappingURL=instrumentQueueProducer.d.ts.map