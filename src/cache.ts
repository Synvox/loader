import { CacheStorage, CacheEntry, Loader } from './types';

export default class Cache<Key> {
  private loader: Loader<Key>;
  private cacheStorage: CacheStorage<Key>;
  private removalTimeout: number = 1000 * 60 * 3;
  constructor(loader: Loader<Key>) {
    this.loader = loader;
    this.cacheStorage = new Map();
  }

  get<Result>(key: Key) {
    return this.cacheStorage.get(key) as CacheEntry<Result>;
  }

  set<Result>(key: Key, patch: Partial<CacheEntry<Result>>) {
    const cacheEntry = this.cacheStorage.get(key) ?? {
      subscribers: new Set(),
    };
    Object.assign(cacheEntry, patch);
    this.cacheStorage.set(key, cacheEntry);
    cacheEntry.subscribers.forEach(fn => fn());
  }

  async load(key: Key) {
    try {
      const promise = this.loader(key);
      this.set(key, { promise });

      const data = await promise;

      return () => {
        this.set(key, { data, promise: undefined, error: undefined });
      };
    } catch (error) {
      return () => {
        this.set(key, { error, promise: undefined, data: undefined });
      };
    }
  }

  subscribe(key: Key, callback: () => void) {
    const cacheEntry = this.cacheStorage.get(key)!;
    if (cacheEntry.subscribers.has(callback)) return;

    clearTimeout(cacheEntry.destroyTimeout);
    cacheEntry.subscribers.add(callback);
  }

  unsubscribe(key: Key, callback: () => void) {
    const cacheEntry = this.cacheStorage.get(key)!;

    cacheEntry.subscribers.delete(callback);

    if (cacheEntry.subscribers.size === 0) this.scheduleRemoval(key);
  }

  scheduleRemoval(key: Key) {
    const cacheEntry = this.cacheStorage.get(key)!;

    window.clearTimeout(cacheEntry.destroyTimeout);
    cacheEntry.destroyTimeout = window.setTimeout(() => {
      this.delete(key);
    }, this.removalTimeout);
  }

  delete(key: Key) {
    this.cacheStorage.delete(key);
  }

  async touch(filter: (key: Key) => boolean) {
    const keys = this.cacheStorage.keys();
    const touchedKeys: Key[] = [];
    for (let key of keys) {
      if (filter(key)) {
        touchedKeys.push(key);
      }
    }

    const promises: Promise<() => void>[] = [];
    for (let key of touchedKeys) {
      const entry = this.cacheStorage.get(key)!;

      if (entry.subscribers.size === 0) {
        window.clearTimeout(entry.destroyTimeout);
        this.delete(key);
        continue;
      }

      const promise = this.load(key);
      promises.push(promise);
    }

    const commitFns = await Promise.all(promises);
    commitFns.forEach(fn => fn());
  }
}
