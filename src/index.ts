import { useState, useLayoutEffect } from 'react';
import { Cache, ExecProps } from './types';

function useForceUpdate() {
  const forceUpdate = useState({})[1];
  return () => {
    forceUpdate({});
  };
}

export function createApi(
  cache: Cache,
  modifier: <In, Out>(
    obj: In,
    get: <T>(key: string, options: ExecProps) => T
  ) => Out
) {
  function exec<Result>({ key, subscriptionCallback }: ExecProps): Result {
    const cacheEntry = cache.get<Result>(key);
    if (cacheEntry) {
      if (subscriptionCallback) cache.subscribe(key, subscriptionCallback);
      if (cacheEntry.data) return cacheEntry.data;
      if (cacheEntry.promise) throw cacheEntry.promise;
      if (cacheEntry.error) throw cacheEntry.error;
    }

    const promise = cache.load(key);
    if (subscriptionCallback) cache.subscribe(key, subscriptionCallback);

    throw promise;
  }

  function get<Result>(key: string) {
    return exec<Result>({ key });
  }

  function useKey() {
    const forceUpdate = useForceUpdate();
    const subscription = useState(() => forceUpdate)[0];
    const [previouslySubscribedKeys] = useState<Set<string>>(() => new Set());
    const dataMap = useState<WeakMap<object, unknown>>(() => new WeakMap())[0];
    const subscribedKeys = new Set<string>();

    const get = <Result>(key: string) => {
      const result = exec<any>({
        key,
        subscriptionCallback: subscription,
      });

      subscribedKeys.add(key);

      if (dataMap.has(result)) return dataMap.get(result) as Result;
      const modifiedResult: Result = modifier<any, Result>(result, get);
      dataMap.set(result, modifiedResult);

      return modifiedResult;
    };

    // unsubscribe from previously used keys
    useLayoutEffect(() => {
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

    return get;
  }

  async function preload(fn: (g: typeof get) => void) {
    while (true) {
      try {
        return fn(get);
      } catch (e) {
        if (e instanceof Error) throw e;
      }
    }
  }

  async function touch(key: string) {
    await cache.touch(key);
  }

  return { useKey, preload, touch };
}
