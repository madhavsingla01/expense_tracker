import React, { useMemo, useState, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import useTransactions from './hooks/useTransactions';
import { ContextMenuProvider } from './context/ContextMenuContext';
import { CurrencyProvider } from './context/CurrencyContext';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LedgerPage from './pages/LedgerPage';
import AddRecordPage from './pages/AddRecordPage';
import BudgetsPage from './pages/BudgetsPage';
import ScanPage from './pages/ScanPage';
import PayPage from './pages/PayPage';
import StatementImportPage from './pages/StatementImportPage';
import ProfilePage from './pages/ProfilePage';
import FeedbackPage from './pages/FeedbackPage';

function AppRoutes() {
  const {
    transactions,
    filteredTransactions,
    budgets,
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
  } = useTransactions();

  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);
  const [ledgerFilters, setLedgerFilters] = useState({ search: '', type: 'All', category: 'All' });
  const [categoryLocked, setCategoryLocked] = useState(false);
  const categoryLockedRef = useRef(false);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedNotificationIds.includes(notification.id)),
    [dismissedNotificationIds, notifications]
  );

  const recentMerchants = useMemo(() => {
    const seen = new Map();
    transactions
      .filter((transaction) => transaction.payee)
      .slice(0, 20)
      .forEach((transaction) => {
        const key = transaction.payee.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            name: transaction.payee,
            normalizedName: key,
            category: transaction.category,
            source: 'recent_transaction',
          });
        }
      });
    return Array.from(seen.values()).slice(0, 6);
  }, [transactions]);

  const dismissNotification = (id) => {
    setDismissedNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    payee: '', category: '', subCategory: '', amount: '',
    type: 'expense', account: 'Checking', notes: '', source: 'manual', receiptImage: null,
    subType: 'cash', // expense sub-type: upi, card, cash, bank, wallet
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'category') {
      setCategoryLocked(true);
      categoryLockedRef.current = true;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'payee' && value.length > 2) {
      if (!categoryLockedRef.current) {
        getPredictedCategory(value).then(prediction => {
          if (!categoryLockedRef.current) {
            setFormData(prev => ({ ...prev, category: prediction.category }));
          }
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (formData.type === 'expense' && parsedAmount > insights.balance && formData.source === 'payment') {
      alert('Insufficient balance for this payment!');
      return;
    }
    const success = await addTransaction({ ...formData, amount: parsedAmount });
    if (success?.duplicate) {
      alert(success.message);
      return;
    }
    if (success) {
      setFormData({ ...formData, payee: '', amount: '', notes: '', source: 'manual', subCategory: '', receiptImage: null });
      setCategoryLocked(false);
      categoryLockedRef.current = false;
      navigate('/ledger');
    }
  };

  const navigateToLedger = (categoryTarget) => {
    setLedgerFilters((prev) => ({ ...prev, category: categoryTarget }));
    navigate('/ledger');
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout
              globalRange={globalRange}
              setGlobalRange={setGlobalRange}
              notifications={visibleNotifications}
              showNotifications={showNotifications}
              setShowNotifications={setShowNotifications}
              onDismissNotification={dismissNotification}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage insights={insights} transactions={filteredTransactions} allTransactions={transactions} onDrilldown={navigateToLedger} globalRange={globalRange} onDelete={deleteTransaction} onUpdate={updateTransaction} />} />
        <Route path="ledger" element={<LedgerPage transactions={filteredTransactions} filters={ledgerFilters} setFilters={setLedgerFilters} onDelete={deleteTransaction} onDuplicate={duplicateTransaction} onUpdate={updateTransaction} />} />
        <Route path="add" element={<AddRecordPage formData={formData} handleInputChange={handleInputChange} handleSubmit={handleSubmit} getPredictedCategory={getPredictedCategory} searchMerchants={searchMerchants} recentMerchants={recentMerchants} />} />
        <Route path="budgets" element={<BudgetsPage budgets={budgets} saveBudget={saveBudget} deleteBudget={deleteBudget} insights={insights} transactions={transactions} globalRange={globalRange} />} />
        <Route path="scan" element={<ScanPage onScanComplete={async (d) => { const prediction = await getPredictedCategory(d.payee); setFormData({ ...formData, ...d, category: d.category || prediction.category, source: 'scan' }); navigate('/add'); }} getPredictedCategory={getPredictedCategory} transactions={transactions} />} />
        <Route path="import" element={<StatementImportPage previewStatement={previewStatement} importStatement={importStatement} listImports={listImports} getImportDetail={getImportDetail} deleteImport={deleteImport} refreshTransactions={refreshTransactions} />} />
        <Route path="pay" element={<PayPage transactions={transactions} balance={insights.balance} refreshTransactions={refreshTransactions} onUpdate={updateTransaction} />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <CurrencyProvider>
      <ContextMenuProvider>
        <AppRoutes />
      </ContextMenuProvider>
    </CurrencyProvider>
  );
}
