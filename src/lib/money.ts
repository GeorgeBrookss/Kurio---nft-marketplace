import Big from 'big.js'
import type { EthString } from '@/api/contracts'

Big.DP = 18
Big.RM = Big.roundHalfEven

export const eth = (v: EthString | number) => new Big(v)
export const add = (...vals: EthString[]): EthString => vals.reduce((acc, v) => acc.plus(v), new Big(0)).toFixed()
export const mul = (v: EthString, qty: number): EthString => new Big(v).times(qty).toFixed()
export const sub = (a: EthString, b: EthString): EthString => new Big(a).minus(b).toFixed()
export const pct = (v: EthString, percent: number): EthString => new Big(v).times(percent).div(100).round(6, Big.roundDown).toFixed()
export const cmp = (a: EthString, b: EthString) => new Big(a).cmp(b)

export function formatEth(v: EthString, opts: { suffix?: boolean } = {}) {
  const b = new Big(v)
  const fixed = b.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, '$1')
  return opts.suffix === false ? fixed : `${fixed} ETH`
}
