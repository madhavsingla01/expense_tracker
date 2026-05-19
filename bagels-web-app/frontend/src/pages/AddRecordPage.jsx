import React, { useEffect, useRef, useState } from 'react';
import { PlusCircle, Paperclip, X, Sparkles } from 'lucide-react';

export default function AddRecordPage({
  formData,
  handleInputChange,
  handleSubmit,
  getPredictedCategory,
  searchMerchants,
  recentMerchants = [],
}) {
  const fileInputRef = useRef(null);
  const [merchantSuggestions, setMerchantSuggestions] = useState([]);
  const [prediction, setPrediction] = useState(null);

  const isExpense = formData.type === 'expense';

  useEffect(() => {
    let cancelled = false;
    const payee = formData.payee?.trim() || '';

    // Only fetch AI suggestions for expenses
    if (!isExpense || !payee) {
      setMerchantSuggestions(isExpense ? recentMerchants : []);
      setPrediction(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      const [suggestions, nextPrediction] = await Promise.all([
        searchMerchants ? searchMerchants(payee) : Promise.resolve([]),
        payee.length > 2 && getPredictedCategory ? getPredictedCategory(payee) : Promise.resolve(null),
      ]);

      if (cancelled) return;
      setMerchantSuggestions(suggestions.length ? suggestions : recentMerchants);
      setPrediction(nextPrediction);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.payee, formData.type, getPredictedCategory, recentMerchants, searchMerchants, isExpense]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange({ target: { name: 'receiptImage', value: reader.result } });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceipt = () => {
    handleInputChange({ target: { name: 'receiptImage', value: null } });
  };

  const useMerchantSuggestion = (merchant) => {
    handleInputChange({ target: { name: 'payee', value: merchant.name } });
    if (merchant.category) {
      handleInputChange({ target: { name: 'category', value: merchant.category } });
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-xl mx-auto bg-[#111113] border border-zinc-800/60 shadow-2xl rounded-2xl p-6 md:p-8 relative text-sm">
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full mb-6">
            <button
              type="button"
              onClick={() => handleInputChange({ target: { name: 'type', value: 'expense' } })}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${isExpense ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleInputChange({ target: { name: 'type', value: 'income' } })}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${!isExpense ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Income
            </button>
          </div>

          {/* Receipt Preview */}
          {formData.receiptImage && (
            <div className="relative mb-5 bg-zinc-950 border border-zinc-800 rounded-xl p-2">
              <div className="flex justify-between items-center px-2 mb-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                  <Paperclip size={12} /> Attached Receipt
                </span>
                <button type="button" onClick={removeReceipt} className="text-zinc-500 hover:text-red-400 transition">
                  <X size={16} />
                </button>
              </div>
              <img src={formData.receiptImage} alt="Receipt Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <input
              name="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={handleInputChange}
              placeholder="Amount ₹"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 font-mono text-lg focus:outline-none focus:border-zinc-600 transition"
              required
            />
            <input
              name="date"
              type="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 focus:outline-none focus:border-zinc-600 transition [color-scheme:dark]"
              required
            />
          </div>
          <input
            name="payee"
            type="text"
            value={formData.payee}
            onChange={handleInputChange}
            placeholder={isExpense ? "Vendor or merchant" : "Source (e.g. Salary, Freelance)"}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 focus:outline-none focus:border-zinc-600 transition"
            required
          />

          {/* AI suggestions — expense only */}
          {isExpense && merchantSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 -mt-2">
              {merchantSuggestions.slice(0, 6).map((merchant) => (
                <button
                  key={`${merchant.normalizedName}-${merchant.name}`}
                  type="button"
                  onClick={() => useMerchantSuggestion(merchant)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition"
                >
                  <Sparkles size={11} className="text-zinc-500" />
                  <span>{merchant.name}</span>
                  {merchant.category && <span className="text-zinc-600">({merchant.category})</span>}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <input
                name="category"
                list="category-options"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Category"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 focus:outline-none focus:border-zinc-600 transition"
                required
              />
              <datalist id="category-options">
                {['General', 'Food & Dining', 'Food & Delivery', 'Groceries', 'Shopping',
                  'Transport', 'Travel', 'Utilities', 'Healthcare', 'Subscriptions',
                  'Fuel', 'Bills & EMI', 'Health & Fitness', 'Education', 'Personal Care',
                  'Donations', 'Cash Withdrawal', 'Transfer', 'Entertainment', 'Income'
                ].map(c => <option key={c} value={c} />)}
              </datalist>
              {isExpense && formData.category && formData.category !== 'General' && formData.payee?.length > 2 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">
                  {prediction?.confidence ? `${Math.round(prediction.confidence * 100)}%` : 'AI'}
                </span>
              )}
            </div>
            {isExpense && (
              <select
                name="subType"
                value={formData.subType || 'cash'}
                onChange={handleInputChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 focus:outline-none focus:border-zinc-600 text-zinc-300 transition"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
                <option value="wallet">Wallet</option>
              </select>
            )}
            {!isExpense && (
              <input
                name="account"
                type="text"
                value={formData.account}
                onChange={handleInputChange}
                placeholder="Account"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 focus:outline-none focus:border-zinc-600 transition"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            {!formData.receiptImage && isExpense && (
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-medium py-3.5 rounded-xl transition flex justify-center items-center gap-2 border border-zinc-800"
              >
                <Paperclip size={16} /> Attach Bill
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />

            <button
              type="submit"
              className="flex-[2] bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-3.5 rounded-xl transition flex justify-center items-center gap-2"
            >
              <PlusCircle size={16} /> {isExpense ? 'Add Expense' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
