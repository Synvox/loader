import { createCache } from './createCache';

type SubscriptionCallback = () => void;
export type Json = boolean | number | string | null | JsonArray | JsonObject;
interface JsonObject {
  [key: string]: Json;
}
interface JsonArray extends Array<Json> {}
export type CacheEntry<Result> = {
  subscribers: Set<SubscriptionCallback>;
  data?: Result;
  promise?: Promise<Result>;
  error?: Error;
  destroyTimeout?: number;
};
export type CacheStorage = Record<string, CacheEntry<unknown>>;

export type Fetch = typeof window.fetch;
export interface FetchOptions {
  fetch: Fetch;
  method: string;
  url: string;
  body?: Json;
  headers?: Headers;
}
export interface ExecProps extends FetchOptions {
  suspend?: boolean;
  subscriptionCallback?: SubscriptionCallback;
}
export type Cache = ReturnType<typeof createCache>;
