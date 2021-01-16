import { CacheStorage, CacheEntry, FetchOptions, Fetch } from './types';

export class FetchError extends Error {
  response: Response;
  constructor(response: Response) {
    super(response.statusText);
    this.response = response;
  }
}

export function createCache() {
  const cache: CacheStorage = {};
  return {
    get<Result>(url: string) {
      return cache[url] as CacheEntry<Result>;
    },

    set<Result>(url: string, patch: Partial<CacheEntry<Result>>) {
      const entry = cache[url] ?? {
        subscribers: new Set(),
      };
      Object.assign(entry, patch);
      cache[url] = entry;
      entry.subscribers.forEach(fn => fn());
      if (entry.subscribers.size === 0) this.scheduleRemoval(url);
    },

    async load({
      fetch,
      method,
      url,
      body,
      headers = new Headers(),
    }: FetchOptions) {
      headers.append('Content-Type', 'application/json');
      return fetch(url, {
        method,
        body: typeof body !== 'undefined' ? JSON.stringify(body) : undefined,
        headers: headers,
      }).then(async res => {
        if (!res.ok) throw new FetchError(res);
        return res.json();
      });
    },

    subscribe(url: string, callback: () => void) {
      const cacheEntry = cache[url];
      if (!cacheEntry)
        throw new Error(`Cannot subscribe to ${url} because it does not exist`);

      clearTimeout(cacheEntry.destroyTimeout);
      cacheEntry.subscribers.add(callback);
    },

    unsubscribe(url: string, callback: () => void) {
      const cacheEntry = cache[url];
      if (!cacheEntry)
        throw new Error(
          `Cannot unsubscribe from ${url} because it does not exist`
        );

      cacheEntry.subscribers.delete(callback);
    },

    scheduleRemoval(url: string) {
      const cacheEntry = cache[url];
      if (!cacheEntry)
        throw new Error(
          `Cannot unsubscribe from ${url} because it does not exist`
        );

      window.clearTimeout(cacheEntry.destroyTimeout);
      cacheEntry.destroyTimeout = window.setTimeout(() => {
        this.delete(url);
      }, 3 * 60 * 1000);
    },

    delete(url: string) {
      delete cache[url];
    },

    async touch(url: string, fetch: Fetch) {
      const keys = Object.keys(cache);
      const touchedKeys: string[] = [];
      for (let key of keys) {
        if (key.includes(url)) {
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

        const promise = this.load({ fetch, url: key, method: 'get' }).then(
          data => {
            this.set(url, { data });
          }
        );

        this.set(url, { promise });
        promises.push(promise);
      }

      await Promise.all(promises);
    },
  };
}
