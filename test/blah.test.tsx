import { renderHook } from '@testing-library/react-hooks';
import { act } from 'react-dom/test-utils';
import { createApi, Cache } from '../src';

jest.useFakeTimers();

it('suspends and loads', async () => {
  let divideBy = 2;
  const cache = new Cache(async (num: number) => {
    if (divideBy === 0) throw new Error('Cannot divide by zero');
    return {
      value: num / divideBy,
      divideBy,
      num,
    };
  });

  const { useKey: useDivide, touch } = createApi({ cache });
  let error: Error | null = null;

  const { result, rerender, unmount, waitForNextUpdate } = renderHook(
    ({ num }: { num: number }) => {
      try {
        error = null;
        const divide = useDivide();
        const result = divide<{ value: string; a: number; b: number }>(num);
        return result;
      } catch (e) {
        if (e instanceof Error) {
          error = e;
          return null;
        } else throw e;
      }
    },
    { initialProps: { num: 4 } }
  );

  // suspends
  expect(result.current).toMatchInlineSnapshot(`undefined`);
  await waitForNextUpdate();

  // first load
  expect(result.current).toMatchInlineSnapshot(`
    Object {
      "divideBy": 2,
      "num": 4,
      "value": 2,
    }
  `);

  // change to another
  rerender({ num: 8 });
  await waitForNextUpdate();
  expect(result.current).toMatchInlineSnapshot(`
    Object {
      "divideBy": 2,
      "num": 8,
      "value": 4,
    }
  `);

  // remote change causing error
  divideBy = 0;
  await act(async () => await touch(() => true));
  expect(error).toMatchInlineSnapshot(`[Error: Cannot divide by zero]`);

  // remote change
  divideBy = 4;
  await act(async () => await touch(() => true));
  expect(result.current).toMatchInlineSnapshot(`
    Object {
      "divideBy": 4,
      "num": 8,
      "value": 2,
    }
  `);

  // change to another (stale) route
  rerender({ num: 4 });
  await waitForNextUpdate();
  expect(result.current).toMatchInlineSnapshot(`
    Object {
      "divideBy": 4,
      "num": 4,
      "value": 1,
    }
  `);

  // cached values look good
  expect(cache.get(4)).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "divideBy": 4,
        "num": 4,
        "value": 1,
      },
      "error": undefined,
      "promise": undefined,
      "subscribers": Set {
        [Function],
      },
    }
  `);

  // cached value should disappear
  unmount();
  jest.runOnlyPendingTimers();
  expect(cache.get(4)).toMatchInlineSnapshot(`undefined`);
});
