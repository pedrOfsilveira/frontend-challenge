/**
 * Valores em ETH trafegam como strings decimais (até 18 casas, a precisão do wei).
 * Toda a aritmética acontece em wei com bigint: nenhum valor monetário passa por `number`.
 */
export type EthAmount = string

const DECIMALS = 18
const WEI = 10n ** BigInt(DECIMALS)
const PATTERN = /^(0|[1-9]\d*)(\.\d{1,18})?$/

function isValid(value: unknown): value is EthAmount {
  return typeof value === 'string' && PATTERN.test(value)
}

function toWei(value: EthAmount): bigint {
  if (!isValid(value)) throw new RangeError(`Valor ETH inválido: ${String(value)}`)
  const [whole = '0', fraction = ''] = value.split('.')
  return BigInt(whole) * WEI + BigInt(fraction.padEnd(DECIMALS, '0'))
}

function fromWei(wei: bigint): EthAmount {
  if (wei < 0n) throw new RangeError('Valor ETH negativo')
  const whole = wei / WEI
  const fraction = (wei % WEI).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

function assertQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantidade inválida: ${quantity}`)
  }
}

export const eth = {
  isValid,
  toWei,
  fromWei,
  normalize: (value: EthAmount) => fromWei(toWei(value)),
  add: (...values: EthAmount[]) => fromWei(values.reduce((sum, v) => sum + toWei(v), 0n)),
  /** `a - b`, com piso em zero: desconto nunca deixa valor negativo. */
  minus: (a: EthAmount, b: EthAmount) => {
    const diff = toWei(a) - toWei(b)
    return fromWei(diff > 0n ? diff : 0n)
  },
  times: (value: EthAmount, quantity: number) => {
    assertQuantity(quantity)
    return fromWei(toWei(value) * BigInt(quantity))
  },
  /** Percentual em basis points (1000 = 10%), truncado no wei. */
  percent: (value: EthAmount, basisPoints: number) => {
    assertQuantity(basisPoints)
    return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
  },
  compare: (a: EthAmount, b: EthAmount): -1 | 0 | 1 => {
    const x = toWei(a)
    const y = toWei(b)
    return x === y ? 0 : x < y ? -1 : 1
  },
  min: (a: EthAmount, b: EthAmount) => (eth.compare(a, b) <= 0 ? eth.normalize(a) : eth.normalize(b)),
  isZero: (value: EthAmount) => toWei(value) === 0n,
  /** Exibição: ponto decimal, mínimo de duas casas, todas as casas significativas. */
  format: (value: EthAmount) => {
    const [whole, fraction = ''] = eth.normalize(value).split('.')
    return `${whole}.${fraction.padEnd(2, '0')}`
  },
  /** Entrada digitada (aceita vírgula). Devolve `null` se não for um valor válido. */
  parseInput: (raw: string): EthAmount | null => {
    const candidate = raw.trim().replace(',', '.')
    return isValid(candidate) ? eth.normalize(candidate) : null
  },
}
