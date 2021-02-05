# `@synvox/loader`

```js
const cache = new Cache(url => {
  return [[url, fetch(url).then(r => r.json())]];
});

const { useKey, touch } = createLoader({ cache });
```
