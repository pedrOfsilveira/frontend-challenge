import { describe, expect, it } from 'vitest'
import { catalogSearchSchema } from '@/features/catalog/search'
import { parseSearch, stringifySearch } from './search-params'

describe('search params', () => {
  it('mantém preço como string (sem float) e ida e volta estável', () => {
    const parsed = parseSearch('?max=11.76&min=0.10&page=2&category=music,photography')
    expect(parsed).toEqual({ max: '11.76', min: '0.10', page: '2', category: 'music,photography' })
    const search = catalogSearchSchema.parse(parsed)
    expect(search).toEqual({ max: '11.76', min: '0.1', page: 2, category: 'music,photography' })
    expect(stringifySearch(search)).toBe('?category=music,photography&min=0.1&max=11.76&page=2')
  })

  it('valor inválido cai no padrão em vez de quebrar', () => {
    expect(catalogSearchSchema.parse(parseSearch('?max=abc&page=-3&sort=nope&category=x,music'))).toEqual({ category: 'music' })
  })
})
