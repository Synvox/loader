# `@synvox/loader`

```js
const cache = new Cache(url => fetch(url).then(r => r.json()));

const { useKey: useDivide, touch } = createLoader({ cache });
```
