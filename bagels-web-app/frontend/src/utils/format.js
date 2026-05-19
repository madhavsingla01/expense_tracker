const LOCALES = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  AED: 'ar-AE',
  BRL: 'pt-BR',
};

export const getPreferredCurrency = () => {
  try {
    const storedCurrency = localStorage.getItem('preferredCurrency');
    if (storedCurrency) return storedCurrency;

    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    return userInfo.preferredCurrency || 'INR';
  } catch {
    return 'INR';
  }
};

export const setPreferredCurrency = (currency) => {
  if (currency) localStorage.setItem('preferredCurrency', currency);
};

export const fmt = (val, currency = getPreferredCurrency()) =>
  new Intl.NumberFormat(LOCALES[currency] || 'en-IN', { style: 'currency', currency }).format(Number(val || 0));
