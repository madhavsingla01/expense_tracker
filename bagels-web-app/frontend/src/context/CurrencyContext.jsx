import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import API from '../config/api';

const CurrencyContext = createContext(null);

export const useCurrency = () => useContext(CurrencyContext);

const EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.50,
  JPY: 155.20,
  CAD: 1.36,
  AUD: 1.51,
  SGD: 1.35,
  AED: 3.67,
  BRL: 5.15
};

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

export const CurrencyProvider = ({ children }) => {
  const { user, updateProfile } = useAuth();
  const [preferredCurrency, setPreferredCurrency] = useState('INR');

  useEffect(() => {
    if (user?.preferredCurrency) {
      setPreferredCurrency(user.preferredCurrency);
    } else {
      const stored = localStorage.getItem('preferredCurrency');
      if (stored) setPreferredCurrency(stored);
    }
  }, [user]);

  const changeCurrency = async (newCurrency) => {
    setPreferredCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
    if (user) {
      try {
        await updateProfile({ preferredCurrency: newCurrency });
      } catch (err) {
        console.error('Failed to save preferred currency to profile:', err);
      }
    }
  };

  /**
   * Convert an amount from its original currency to the preferred display currency.
   */
  const convert = (amount, originalCurrency = 'INR') => {
    const amountNum = Number(amount || 0);
    if (!originalCurrency || originalCurrency === preferredCurrency) return amountNum;
    
    const rateFrom = EXCHANGE_RATES[originalCurrency] || EXCHANGE_RATES['INR'];
    const rateTo = EXCHANGE_RATES[preferredCurrency] || EXCHANGE_RATES['INR'];
    
    // Convert to USD base, then to target
    const inUSD = amountNum / rateFrom;
    return inUSD * rateTo;
  };

  /**
   * Format an amount using the preferred currency locale and symbol.
   */
  const format = (amount, originalCurrency = 'INR') => {
    const converted = convert(amount, originalCurrency);
    return new Intl.NumberFormat(LOCALES[preferredCurrency] || 'en-IN', {
      style: 'currency',
      currency: preferredCurrency,
    }).format(converted);
  };

  return (
    <CurrencyContext.Provider value={{ preferredCurrency, changeCurrency, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
};
