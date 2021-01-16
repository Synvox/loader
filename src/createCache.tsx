import { CacheStorage, CacheEntry, Loader } from './types';

export class FetchError extends Error {
  response: Response;
  constructor(response: Response) {
    super(response.statusText);
    this.response = response;
  }
}

export function createCache(loader: Loader) {
  const cache: CacheStorage = {};
  return {
    get<Result>(key: string) {
      return cache[key] as CacheEntry<Result>;
    },

    set<Result>(key: string, patch: Partial<CacheEntry<Result>>) {
      const entry = cache[key] ?? {
        subscribers: new Set(),
      };
      Object.assign(entry, patch);
      cache[key] = entry;
      entry.subscribers.forEach(fn => fn());
      if (entry.subscribers.size === 0) this.scheduleRemoval(key);
    },

    async load(key: string) {
      return loader(key);
    },

    subscribe(key: string, callback: () => void) {
      const cacheEntry = cache[key];
      if (!cacheEntry) return;

      clearTimeout(cacheEntry.destroyTimeout);
      cacheEntry.subscribers.add(callback);
    },

    unsubscribe(key: string, callback: () => void) {
      const cacheEntry = cache[key];
      if (!cacheEntry) return;

      cacheEntry.subscribers.delete(callback);
    },

    scheduleRemoval(key: string) {
      const cacheEntry = cache[key];
      if (!cacheEntry) return;

      window.clearTimeout(cacheEntry.destroyTimeout);
      cacheEntry.destroyTimeout = window.setTimeout(() => {
        this.delete(key);
      }, 3 * 60 * 1000);
    },

    delete(key: string) {
      delete cache[key];
    },

    async touch(searchKey: string) {
      const keys = Object.keys(cache);
      const touchedKeys: string[] = [];
      for (let key of keys) {
        if (key.includes(searchKey)) {
          touchedKeys.push(key);
        }
      }

      const promises: Promise<unknown>[] = [];
      for (let key of touchedKeys) {
        const entry = cache[key];

        if (entry.subscribers.size === 0) {
          window.clearTimeout(entry.destroyTimeout);
          this.delete(key);
          continue;
        }

        const promise = this.load(key).then(data => {
          this.set(key, { data });
        });

        this.set(key, { promise });
        promises.push(promise);
      }

      await Promise.all(promises);
    },
  };
}
