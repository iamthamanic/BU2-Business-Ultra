/** Decimal money helpers — net-basis, no silent FX. */

export const DEFAULT_CURRENCY = 'EUR'

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`)
    this.name = 'CurrencyMismatchError'
  }
}

export class Money {
  readonly amount: number
  readonly currency: string

  private constructor(amount: number, currency: string) {
    this.amount = amount
    this.currency = currency
  }

  static of(value: number | string, currency = DEFAULT_CURRENCY): Money {
    const n = typeof value === 'string' ? Number(value) : value
    if (!Number.isFinite(n)) throw new Error('invalid_money')
    return new Money(n, currency)
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new CurrencyMismatchError(this.currency, other.currency)
    return new Money(this.amount + other.amount, this.currency)
  }

  sub(other: Money): Money {
    if (this.currency !== other.currency) throw new CurrencyMismatchError(this.currency, other.currency)
    return new Money(this.amount - other.amount, this.currency)
  }

  mul(factor: number): Money {
    return new Money(this.amount * factor, this.currency)
  }

  /** HALF_UP to 2 decimal places for display (string-safe). */
  displayAmount(): string {
    return this.round2().toFixed(2)
  }

  round2(): number {
    // Avoid binary float traps around *.5 by scaling via integer string path
    const neg = this.amount < 0
    const abs = Math.abs(this.amount)
    const [whole, frac = ''] = abs.toFixed(6).split('.')
    const digits = (frac + '000000').slice(0, 3)
    let cents = Number(whole) * 100 + Number(digits.slice(0, 2))
    const third = Number(digits[2] ?? '0')
    if (third >= 5) cents += 1
    const n = cents / 100
    return neg ? -n : n
  }
}
