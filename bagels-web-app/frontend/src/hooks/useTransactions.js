import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import API, { PAYMENT_WS_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const TRANSACTION_SYNC_KEY = 'bagels.transactions.sync';

export default function useTransactions() {
  const { user, loading: authLoading } = useAuth();
  const { convert } = useCurrency();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const syncTimerRef = useRef(null);
  const [globalRange, setGlobalRange] = useState(() => {
    try {
      const saved = localStorage.getItem('bagels.dateRange.prefs');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    
    const d = new Date(); d.setDate(d.getDate() - 30); 
    return {
      start: d.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    };
  });

  useEffect(() => {
    if (globalRange) {
      localStorage.setItem('bagels.dateRange.prefs', JSON.stringify(globalRange));
    }
  }, [globalRange]);

  const clearAccountData = useCallback(() => {
    setTransactions([]);
    setBudgets({});
  }, []);

  const signalTransactionSync = useCallback(() => {
    localStorage.setItem(TRANSACTION_SYNC_KEY, JSON.stringify({ at: Date.now() }));
  }, []);

  const normalizeTransactions = useCallback((items) => {
    return items.map((t) => ({
      ...t,
      id: t._id,
      date: new Date(t.date).toISOString().split('T')[0],
    }));
  }, []);

  const refreshTransactions = useCallback(async () => {
    if (!user?.token) {
      setTransactions([]);
      return;
    }

    try {
      const { data } = await API.get('/transactions');
      setTransactions(normalizeTransactions(data));
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    }
  }, [normalizeTransactions, user?.token]);

  const refreshBudgets = useCallback(async () => {
    if (!user?.token) {
      setBudgets({});
      return;
    }

    try {
      const { data } = await API.get('/budgets');
      const nextBudgets = {};
      data.forEach((budget) => {
        nextBudgets[budget.category] = budget.limit;
      });
      setBudgets(nextBudgets);
    } catch (error) {
      console.error('Error refreshing budgets:', error);
    }
  }, [user?.token]);

  // Fetch account-scoped data whenever the authenticated user changes.
  useEffect(() => {
    const fetchId = fetchIdRef.current + 1;
    fetchIdRef.current = fetchId;

    clearAccountData();

    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!user?.token) {
      setIsLoading(false);
      return;
    }

    let isCurrentSession = true;

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [txRes, bRes] = await Promise.all([
          API.get('/transactions'),
          API.get('/budgets'),
        ]);

        if (!isCurrentSession || fetchIdRef.current !== fetchId) return;

        setTransactions(normalizeTransactions(txRes.data));

        const bMap = {};
        bRes.data.forEach((b) => (bMap[b.category] = b.limit));
        setBudgets(bMap);
      } catch (error) {
        if (!isCurrentSession || fetchIdRef.current !== fetchId) return;
        console.error('Error fetching data:', error);
        clearAccountData();
      } finally {
        if (isCurrentSession && fetchIdRef.current === fetchId) {
          setIsLoading(false);
        }
      }
    };

    fetchAll();
    return () => {
      isCurrentSession = false;
    };
  }, [authLoading, user?._id, user?.token, clearAccountData, normalizeTransactions]);

  useEffect(() => {
    if (!user?.token) return undefined;

    const ws = new WebSocket(`${PAYMENT_WS_URL}?token=${encodeURIComponent(user.token)}`);

    const scheduleSync = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = setTimeout(async () => {
        try {
          await Promise.all([
            refreshTransactions(),
            refreshBudgets(),
          ]);
        } finally {
          syncTimerRef.current = null;
        }
      }, 120);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'transactions.changed') {
          scheduleSync();
          return;
        }

        if (message.type === 'payment.updated' && message.payment?.status === 'success') {
          scheduleSync();
        }
      } catch (error) {
        console.error('Failed to parse realtime transaction message:', error);
      }
    };

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      ws.close();
    };
  }, [refreshBudgets, refreshTransactions, user?.token]);

  useEffect(() => {
    if (!user?.token) return undefined;

    const handleStorage = (event) => {
      if (event.key === TRANSACTION_SYNC_KEY) {
        Promise.all([refreshTransactions(), refreshBudgets()]).catch((error) => {
          console.error('Failed to sync transaction changes across tabs:', error);
        });
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshBudgets, refreshTransactions, user?.token]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (!globalRange || !globalRange.start || !globalRange.end) return true;

      const transactionDate = new Date(transaction.date);
      const start = new Date(globalRange.start);
      const end = new Date(globalRange.end);
      end.setHours(23, 59, 59, 999);

      return transactionDate >= start && transactionDate <= end;
    });
  }, [transactions, globalRange]);

  // Compute insights
  const insights = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let periodIncome = 0;
    let periodExpense = 0;
    let upiExpense = 0;
    const categoryTotals = {};
    const upiPayees = {};

    const dailyMap = {};
    const typeCompareMap = {};

    const daysDiff = globalRange && globalRange.start && globalRange.end ? 
      (new Date(globalRange.end) - new Date(globalRange.start)) / (1000 * 60 * 60 * 24) : 30;

    transactions.forEach((t) => {
      totalIncome += convert(parseFloat(t.credit || 0), t.currency);
      totalExpense += convert(parseFloat(t.debit || 0), t.currency);
    });

    filteredTransactions.forEach((t) => {
      const debit = convert(parseFloat(t.debit || 0), t.currency);
      const credit = convert(parseFloat(t.credit || 0), t.currency);

      periodIncome += credit;
      if (debit > 0) {
        periodExpense += debit;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + debit;
        
        if (t.source === 'payment' || t.source === 'upi_intent') {
          upiExpense += debit;
          upiPayees[t.payee] = (upiPayees[t.payee] || 0) + debit;
        }
      }

      if (!dailyMap[t.date]) dailyMap[t.date] = { expense: 0, income: 0, date: t.date };
      dailyMap[t.date].expense += debit;
      dailyMap[t.date].income += credit;

      const groupingKey = daysDiff <= 14 ? t.date : t.date.substring(0, 7);
      if (!typeCompareMap[groupingKey]) typeCompareMap[groupingKey] = { name: groupingKey, Income: 0, Expense: 0 };
      typeCompareMap[groupingKey].Expense += debit;
      typeCompareMap[groupingKey].Income += credit;
    });

    const topCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 5);

    let trendData = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    const avgDailyExpense = periodExpense / (trendData.length || 1);
    trendData = trendData.map((d) => ({
      ...d,
      anomaly: d.expense > avgDailyExpense * 2 && avgDailyExpense > 10,
    }));

    const compareData = Object.values(typeCompareMap).sort((a, b) => a.name.localeCompare(b.name));

    // --- New Calendar Month Insights ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let currentMonthExpense = 0;
    let lastMonthExpense = 0;
    const currentMonthCategoryTotals = {};

    transactions.forEach(t => {
      const debit = convert(parseFloat(t.debit || 0), t.currency);
      if (debit > 0) {
        const tDate = new Date(t.date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
          currentMonthExpense += debit;
          currentMonthCategoryTotals[t.category] = (currentMonthCategoryTotals[t.category] || 0) + debit;
        } else if (tDate.getMonth() === lastMonth && tDate.getFullYear() === lastMonthYear) {
          lastMonthExpense += debit;
        }
      }
    });

    const daysPassedInMonth = now.getDate();
    const dailyAverage = currentMonthExpense / daysPassedInMonth;

    let trendPercentage = 0;
    if (lastMonthExpense > 0) {
      trendPercentage = ((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100;
    }

    const currentMonthTopCategories = Object.entries(currentMonthCategoryTotals).sort(([, a], [, b]) => b - a);
    let topCategoryInfo = null;
    if (currentMonthTopCategories.length > 0) {
      const topCat = currentMonthTopCategories[0];
      topCategoryInfo = {
        name: topCat[0],
        amount: topCat[1],
        percentage: currentMonthExpense > 0 ? (topCat[1] / currentMonthExpense) * 100 : 0
      };
    }

    const topUpiPayeesList = Object.entries(upiPayees).sort(([, a], [, b]) => b - a);
    const topUpiPayee = topUpiPayeesList.length > 0 ? { name: topUpiPayeesList[0][0], amount: topUpiPayeesList[0][1] } : null;
    const upiPercentage = periodExpense > 0 ? (upiExpense / periodExpense) * 100 : 0;
    const upiInsights = { total: upiExpense, percentage: upiPercentage, topPayee: topUpiPayee };

    return { 
      income: periodIncome,
      expense: periodExpense,
      balance: transactions.length > 0 ? convert(transactions[0].balanceAfter, transactions[0].currency) : 0,
      lifetimeIncome: totalIncome,
      lifetimeExpense: totalExpense,
      periodIncome,
      periodExpense,
      categoryTotals, topCategories, trendData, compareData,
      currentMonthExpense, lastMonthExpense, dailyAverage, 
      trendPercentage, topCategoryInfo, upiInsights,
      filteredTransactionCount: filteredTransactions.length,
    };
  }, [filteredTransactions, globalRange, transactions, convert]);

  // Notifications
  const notifications = useMemo(() => {
    if (filteredTransactions.length === 0) return [];
    const notes = [];
    const expenseTransactions = filteredTransactions.filter((transaction) => transaction.type === 'expense');
    const avgExpense = insights.expense / (expenseTransactions.length || 1);

    filteredTransactions.slice(0, 5).forEach((t) => {
      const debit = convert(parseFloat(t.debit || 0), t.currency);
      if (debit > 0 && debit > avgExpense * 2.5 && avgExpense > 20) {
        notes.push({
          id: `high-spend-${t.id || t._id}`,
          title: 'High Spend Alert',
          message: `Unusual transaction: ${debit.toFixed(2)} at ${t.payee}.`,
          type: 'warning',
          transaction: t,
        });
      }
    });

    Object.keys(budgets).forEach((cat) => {
      const spent = insights.categoryTotals[cat] || 0;
      if (spent > budgets[cat]) {
        notes.push({
          id: `budget-exceeded-${cat}`,
          title: 'Budget Exceeded',
          message: `Crossed ${cat} budget. Limit: ${budgets[cat]}.`,
          type: 'danger',
          details: { category: cat, spent, limit: budgets[cat] },
        });
      } else if (spent > budgets[cat] * 0.85) {
        notes.push({
          id: `budget-warning-${cat}`,
          title: 'Budget Warning',
          message: `Nearing ${cat} budget limit.`,
          type: 'alert',
          details: { category: cat, spent, limit: budgets[cat] },
        });
      }
    });

    // Simple Intelligence Alert
    if (insights.topCategoryInfo && insights.topCategoryInfo.percentage > 40 && insights.currentMonthExpense > 500) {
      notes.push({
        id: `spending-pattern-${insights.topCategoryInfo.name}`,
        title: 'Spending Pattern Alert',
        message: `High spending on ${insights.topCategoryInfo.name}. It makes up ${insights.topCategoryInfo.percentage.toFixed(0)}% of this month's expenses.`,
        type: 'alert',
        details: {
          category: insights.topCategoryInfo.name,
          spent: insights.topCategoryInfo.amount,
          percentage: insights.topCategoryInfo.percentage,
        },
      });
    }

    return Array.from(new Map(notes.map((item) => [item.title + item.message, item])).values());
  }, [filteredTransactions, budgets, insights]);

  // Actions
  const addTransaction = useCallback(async (formData) => {
    const newTx = { ...formData, amount: parseFloat(formData.amount) };
    try {
      const { data: savedTx } = await API.post('/transactions', newTx);
      savedTx.id = savedTx._id;
      savedTx.date = new Date(savedTx.date).toISOString().split('T')[0];
      setTransactions((prev) => [savedTx, ...prev]);
      signalTransactionSync();
      return true;
    } catch (error) {
      console.error('Error adding transaction:', error);
      if (error.response?.status === 409) {
        return {
          duplicate: true,
          message: error.response?.data?.message || 'Duplicate transaction detected.',
          duplicateTransactionId: error.response?.data?.duplicateTransactionId,
        };
      }
      return false;
    }
  }, [signalTransactionSync]);

  const deleteTransaction = useCallback(async (id) => {
    try {
      await API.delete(`/transactions/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      signalTransactionSync();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }, [signalTransactionSync]);

  const duplicateTransaction = useCallback(async (id, overrides = {}) => {
    try {
      const { data: duplicatedTx } = await API.post(`/transactions/${id}/duplicate`, overrides);
      duplicatedTx.id = duplicatedTx._id;
      duplicatedTx.date = new Date(duplicatedTx.date).toISOString().split('T')[0];
      setTransactions((prev) => [duplicatedTx, ...prev]);
      signalTransactionSync();
      return duplicatedTx;
    } catch (error) {
      console.error('Error duplicating transaction:', error);
      return null;
    }
  }, [signalTransactionSync]);

  const saveBudget = useCallback(async (category, limit) => {
    try {
      await API.post('/budgets', { category, limit: parseFloat(limit) });
      setBudgets((prev) => ({ ...prev, [category]: parseFloat(limit) }));
      signalTransactionSync();
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  }, [signalTransactionSync]);

  const deleteBudget = useCallback(async (category) => {
    try {
      // Get budget list to find the _id for this category
      const { data: budgetList } = await API.get('/budgets');
      const match = budgetList.find((b) => b.category === category);
      if (!match) throw new Error('Budget not found');
      await API.delete(`/budgets/${match._id}`);
      setBudgets((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
      signalTransactionSync();
      return true;
    } catch (error) {
      console.error('Error deleting budget:', error);
      return false;
    }
  }, [signalTransactionSync]);

  const getPredictedCategory = useCallback(async (payee) => {
    try {
      const { data } = await API.get(`/predict?payee=${encodeURIComponent(payee)}`);
      return data; // { category, confidence, source, merchant, suggestions }
    } catch {
      return { category: 'General', confidence: 0.3, source: 'unknown', merchant: null, suggestions: [] };
    }
  }, []);

  const searchMerchants = useCallback(async (query = '') => {
    try {
      const { data } = await API.get(`/predict/merchants?q=${encodeURIComponent(query)}&limit=8`);
      return data;
    } catch (error) {
      console.error('Error searching merchants:', error);
      return [];
    }
  }, []);

  const previewStatement = useCallback(async (file, mapping = null) => {
    const form = new FormData();
    form.append('statement', file);
    if (mapping) {
      form.append('mapping', JSON.stringify(mapping));
    }
    const { data } = await API.post('/statements/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }, []);

  const importStatement = useCallback(async (file, mapping = null) => {
    const form = new FormData();
    form.append('statement', file);
    if (mapping) {
      form.append('mapping', JSON.stringify(mapping));
    }
    const { data } = await API.post('/statements/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refreshTransactions();
    signalTransactionSync();
    return data;
  }, [refreshTransactions, signalTransactionSync]);

  const listImports = useCallback(async (limit = 20) => {
    try {
      const { data } = await API.get(`/statements/imports?limit=${limit}`);
      return data;
    } catch (error) {
      console.error('Error fetching import history:', error);
      return [];
    }
  }, []);

  const getImportDetail = useCallback(async (batchId) => {
    try {
      const { data } = await API.get(`/statements/imports/${batchId}`);
      return data;
    } catch (error) {
      console.error('Error fetching import detail:', error);
      return null;
    }
  }, []);

  const deleteImport = useCallback(async (batchId) => {
    const { data } = await API.delete(`/statements/imports/${batchId}`);
    // Full refresh: cascade delete changes ledger, balance, analytics
    await Promise.all([refreshTransactions(), refreshBudgets()]);
    signalTransactionSync();
    return data;
  }, [refreshTransactions, refreshBudgets, signalTransactionSync]);

  const updateTransaction = useCallback(async (id, updates) => {
    try {
      const { data: updatedTx } = await API.put(`/transactions/${id}`, updates);
      updatedTx.id = updatedTx._id;
      updatedTx.date = new Date(updatedTx.date).toISOString().split('T')[0];
      setTransactions((prev) => prev.map((t) => t.id === id ? updatedTx : t));
      signalTransactionSync();
      return true;
    } catch (error) {
      console.error('Error updating transaction:', error);
      return false;
    }
  }, [signalTransactionSync]);

  return {
    transactions,
    filteredTransactions,
    budgets,
    isLoading,
    insights,
    notifications,
    globalRange,
    setGlobalRange,
    addTransaction,
    deleteTransaction,
    duplicateTransaction,
    updateTransaction,
    saveBudget,
    deleteBudget,
    getPredictedCategory,
    searchMerchants,
    previewStatement,
    importStatement,
    listImports,
    getImportDetail,
    deleteImport,
    refreshTransactions,
  };
}
