import { useState } from 'react'

/**
 * Quantas vezes `value` mudou desde a montagem. Serve de `key` para remontar um elemento
 * e reiniciar a animação CSS só quando o valor muda de verdade (0 = primeiro render, sem animar).
 * `direction` compara o valor novo com o anterior quando há uma ordem (preço, quantidade).
 */
export function useChangeCount<T>(value: T, compare?: (next: T, prev: T) => number) {
  const [state, setState] = useState({ value, count: 0, direction: 'up' as 'up' | 'down' })
  if (!Object.is(state.value, value)) {
    const direction = compare && compare(value, state.value) < 0 ? 'down' : 'up'
    setState({ value, count: state.count + 1, direction })
    return { count: state.count + 1, direction, changed: true }
  }
  return { count: state.count, direction: state.direction, changed: state.count > 0 }
}
