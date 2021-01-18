import { useState, useEffect, useRef, useCallback } from 'react';
import Cache from './cache';
import { SubscriptionCallback } from '.';

function useForceUpdate() {
  const forceUpdateInner = useState({})[1];
  const mountedStateRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedStateRef.current = false;
    };
  }, []);

  const forceUpdate = useCallback(() => {
    if (mountedStateRef.current) forceUpdateInner({});
  }, []);

  return forceUpdate;
}

function isPromise(value: any): value is Promise<unknown> {
  return (
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof value.then === 'function'
  );
}

export function createApi<Key>({
  cache,
  modifier = (x: any) => x,
}: {
  cache: Cache<Key>;
  modifier?: <In, Out>(obj: In, get: <T>(key: Key) => T) => Out;
}) {
  function get<Result>(key: Key) {
    const cacheEntry = cache.get<Result>(key);
    if (cacheEntry) {
      if (cacheEntry.data) return cacheEntry.data;
      if (cacheEntry.promise) throw cacheEntry.promise;
      throw cacheEntry.error;
    }

    throw cache.load(key).then(commit => commit());
  }

  function useKey() {
    const forceUpdate = useForceUpdate();
    const subscription = useRef<SubscriptionCallback>(forceUpdate).current;
    const previouslySubscribedKeys = useRef<Set<Key>>(new Set()).current;
    const dataMap = useState<WeakMap<object, unknown>>(() => new WeakMap())[0];
    const subscribedKeys = new Set<Key>();

    const hookGet = <Result>(key: Key) => {
      subscribedKeys.add(key);
      try {
        const result = get<any>(key);

        if (dataMap.has(result)) return dataMap.get(result) as Result;
        const modifiedResult: Result = modifier<any, Result>(result, get);
        dataMap.set(result, modifiedResult);
        cache.subscribe(key, subscription);

        return modifiedResult;
      } catch (e) {
        const thrown = e as Error | Promise<Result>;

        if (!isPromise(thrown)) {
          cache.subscribe(key, subscription);
          throw e;
        }

        if (!previouslySubscribedKeys.has(key)) thrown.finally(subscription);
        throw thrown;
      }
    };

    // unsubscribe from previously used keys
    useEffect(() => {
      Array.from(previouslySubscribedKeys)
        .filter(key => !subscribedKeys.has(key))
        .forEach(key => {
          previouslySubscribedKeys.delete(key);
          cache.unsubscribe(key, subscription);
        });

      subscribedKeys.forEach(key => {
        previouslySubscribedKeys.add(key);
      });
    });

    useEffect(() => {
      return () => {
        previouslySubscribedKeys.forEach(key =>
          cache.unsubscribe(key, subscription)
        );
      };
    }, []);

    return hookGet;
  }

  async function preload<T>(fn: (g: typeof get) => T) {
    while (true) {
      try {
        return fn(get);
      } catch (e) {
        if (!isPromise(e)) throw e;
        await e;
      }
    }
  }

  async function touch(filter: (key: Key) => boolean) {
    await cache.touch(filter);
  }

  return {
    get,
    useKey,
    preload,
    touch,
  };
}
