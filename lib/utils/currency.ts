export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  PLN: 'zł',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

export const CURRENCY_POSITIONS: Record<string, 'before' | 'after'> = {
  USD: 'before',
  PLN: 'after',
  EUR: 'before',
  GBP: 'before',
  JPY: 'before',
  CAD: 'before',
  AUD: 'before',
};

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || '$';
  const position = CURRENCY_POSITIONS[currencyCode] || 'before';
  const formattedAmount = amount.toFixed(2);

  if (position === 'after') {
    return `${formattedAmount} ${symbol}`;
  }
  return `${symbol}${formattedAmount}`;
}

export function getCurrency(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('currency') || 'USD';
  }
  return 'USD';
}
