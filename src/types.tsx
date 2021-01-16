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

export interface ExecProps {
  key: string;
  subscriptionCallback?: SubscriptionCallback;
}
export type Cache = ReturnType<typeof createCache>;

export type Loader = <T>(key: string) => Promise<T>;
