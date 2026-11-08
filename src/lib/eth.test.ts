import { describe, expect, it } from 'vitest'
import { eth } from './eth'

describe('eth', () => {
  it('valida strings decimais', () => {
    expect(eth.isValid('0')).toBe(true)
    expect(eth.isValid('1.19')).toBe(true)
    expect(eth.isValid('0.000000000000000001')).toBe(true)
    expect(eth.isValid('0.0000000000000000001')).toBe(false)
    expect(eth.isValid('01.5')).toBe(false)
    expect(eth.isValid('-1')).toBe(false)
    expect(eth.isValid('1e3')).toBe(false)
    expect(eth.isValid('.5')).toBe(false)
    expect(eth.isValid(1.5)).toBe(false)
  })

  it('soma sem erro de ponto flutuante', () => {
    expect(eth.add('0.1', '0.2')).toBe('0.3')
    expect(eth.add('2.38', '8.34', '16.11')).toBe('26.83')
    expect(eth.add()).toBe('0')
  })

  it('multiplica por quantidade inteira', () => {
    expect(eth.times('1.19', 2)).toBe('2.38')
    expect(eth.times('1.39', 6)).toBe('8.34')
    expect(() => eth.times('1', 1.5)).toThrow()
    expect(() => eth.times('1', -1)).toThrow()
  })

  it('subtrai sem ficar negativo', () => {
    expect(eth.minus('1', '0.25')).toBe('0.75')
    expect(eth.minus('0.1', '1')).toBe('0')
  })

  it('aplica percentual em basis points arredondando para baixo', () => {
    expect(eth.percent('26.83', 1000)).toBe('2.683')
    expect(eth.percent('0.000000000000000001', 5000)).toBe('0')
  })

  it('compara valores com escalas diferentes', () => {
    expect(eth.compare('1.10', '1.1')).toBe(0)
    expect(eth.compare('0.99', '1')).toBe(-1)
    expect(eth.compare('12.3', '2.30')).toBe(1)
  })

  it('normaliza zeros', () => {
    expect(eth.normalize('1.1900')).toBe('1.19')
    expect(eth.normalize('3.000')).toBe('3')
  })

  it('formata com pelo menos duas casas e sem notação exponencial', () => {
    expect(eth.format('1.19')).toBe('1.19')
    expect(eth.format('3')).toBe('3.00')
    expect(eth.format('0.016')).toBe('0.016')
    expect(eth.format('0.000000000000000001')).toBe('0.000000000000000001')
  })

  it('converte a entrada do usuário com vírgula ou ponto', () => {
    expect(eth.parseInput('12,30')).toBe('12.3')
    expect(eth.parseInput(' 0.02 ')).toBe('0.02')
    expect(eth.parseInput('abc')).toBeNull()
  })
})
