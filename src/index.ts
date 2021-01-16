import { useState, useLayoutEffect } from 'react';
import { Cache, ExecProps } from './types';

function useForceUpdate() {
  const forceUpdate = useState({})[1];
  return () => {
    forceUpdate({});
  };
}

export function createApi(
  fetch: typeof window.fetch,
  cache: Cache,
  modifier: <In, Out>(
    obj: In,
    get: <T>(url: string, options: ExecProps) => T
  ) => Out
) {
  function exec<Result>({
    method,
    url,
    body,
    headers,
    subscriptionCallback,
  }: ExecProps): Result {
    const cacheEntry = cache.get<Result>(url);
    if (cacheEntry) {
      if (subscriptionCallback) cache.subscribe(url, subscriptionCallback);
      if (cacheEntry.data) return cacheEntry.data;
      if (cacheEntry.promise) throw cacheEntry.promise;
      if (cacheEntry.error) throw cacheEntry.error;
    }

    const promise = cache.load({ fetch, url, headers, body, method });
    if (subscriptionCallback) cache.subscribe(url, subscriptionCallback);

    throw promise;
  }

  function get<Result>(url: string, options: ExecProps) {
    return exec<Result>({
      ...options,
      suspend: true,
      url,
    });
  }

  function useUrl() {
    const forceUpdate = useForceUpdate();
    const subscription = useState(() => forceUpdate)[0];
    const [previouslySubscribedUrls] = useState<Set<string>>(() => new Set());
    const dataMap = useState<WeakMap<object, unknown>>(() => new WeakMap())[0];
    const subscribedUrls = new Set<string>();

    const get = <Result>(url: string, options: ExecProps) => {
      const result = exec<any>({
        ...options,
        suspend: true,
        url,
        subscriptionCallback: subscription,
      });

      subscribedUrls.add(url);

      if (dataMap.has(result)) return dataMap.get(result) as Result;
      const modifiedResult: Result = modifier<any, Result>(result, get);
      dataMap.set(result, modifiedResult);

      return modifiedResult;
    };

    // unsubscribe from previously used urls
    useLayoutEffect(() => {
      Array.from(previouslySubscribedUrls)
        .filter(url => !subscribedUrls.has(url))
        .forEach(url => {
          previouslySubscribedUrls.delete(url);
          cache.unsubscribe(url, subscription);
        });

      subscribedUrls.forEach(url => {
        previouslySubscribedUrls.add(url);
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

  async function touch(url: string) {
    await cache.touch(url, fetch);
  }

  return { useUrl, preload, touch };
}
