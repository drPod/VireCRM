import type { DurableObjectStorage } from '@cloudflare/workers-types';
type WaitUntil = (promise: Promise<unknown>) => void;
/**
 * Instruments DurableObjectStorage methods with Sentry spans.
 *
 * Wraps the following async methods:
 * - get, put, delete, list (KV API)
 * - setAlarm, getAlarm, deleteAlarm (Alarm API)
 *
 * When setAlarm is called, it also stores the current span context so that when
 * the alarm fires later, it can link back to the trace that called setAlarm.
 *
 * @param storage - The DurableObjectStorage instance to instrument
 * @param waitUntil - Optional waitUntil function to defer span context storage
 * @returns An instrumented DurableObjectStorage instance
 */
export declare function instrumentDurableObjectStorage(storage: DurableObjectStorage, waitUntil?: WaitUntil): DurableObjectStorage;
export {};
//# sourceMappingURL=instrumentDurableObjectStorage.d.ts.map