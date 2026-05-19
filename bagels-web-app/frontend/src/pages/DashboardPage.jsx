import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, Clock, PieChart as PieIcon, Activity } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import SpendingTrends from '../components/dashboard/SpendingTrends';
import IncomeExpenseChart from '../components/dashboard/IncomeExpenseChart';
import CategoryPie from '../components/dashboard/CategoryPie';
import AnalyticsDrilldown from '../components/dashboard/AnalyticsDrilldown';

export default function DashboardPage({ insights, transactions, allTransactions, onDrilldown, globalRange, onDelete, onUpdate }) {
  const { format, preferredCurrency } = useCurrency();
  const isTrendUp = insights.trendPercentage > 0;
  const absTrend = Math.abs(insights.trendPercentage || 0).toFixed(1);

  // Drill-down state — supports both 'category' and 'date' modes
  const [drillState, setDrillState] = useState(null);
  // drillState = { mode: 'category', category: '...' } | { mode: 'date', date: '...', dateInfo: {...} } | null

  const categoryNames = useMemo(() => {
    return (insights.topCategories || []).map(([name]) => name);
  }, [insights.topCategories]);

  // ─── PRIMARY ACTIONS (Click → Modal) ──────────────────────────

  const handleCategoryDrill = (categoryName) => {
    setDrillState({ mode: 'category', category: categoryName });
  };

  const handleDateDrill = (pointData) => {
    // pointData = { date, expense, income } from the line chart click
    if (pointData?.date) {
      setDrillState({ mode: 'date', date: pointData.date, dateInfo: pointData });
    }
  };

  const handleSwitchToCategory = (cat) => {
    setDrillState({ mode: 'category', category: cat });
  };

  const handleFilterLedger = (categoryName) => {
    // onDrilldown navigates to /ledger with the category filter applied
    if (onDrilldown) onDrilldown(categoryName);
  };

  return (
    <>
      <div className="h-full min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-0 md:pr-1">
        {/* TOP STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 auto-rows-min">
          
          {/* 1. HERO TILE */}
          <div className="sm:col-span-2 md:row-span-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-[#3A3A3A] hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-10 -right-10 opacity-5 text-[#4285F4]"><Wallet size={200} /></div>
            <div>
              <h3 className="text-[#B0B0B0] text-xs sm:text-sm font-semibold uppercase tracking-wider relative z-10 flex items-center gap-2">
                 Net Balance
              </h3>
              <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-mono text-white mt-3 relative z-10 break-all">{format(insights.balance, preferredCurrency)}</p>
              <p className="text-[11px] text-[#7A7A7A] mt-2 relative z-10">Lifetime balance across all transactions</p>
            </div>
            <div className="mt-6 relative z-10 flex items-center gap-4 bg-[#121212] border border-[#2A2A2A] rounded-2xl p-3 md:p-4">
              <div className={`p-2.5 rounded-xl ${isTrendUp ? 'bg-red-500/10 text-[#EA4335]' : 'bg-emerald-500/10 text-[#34A853]'}`}>
                {isTrendUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              <div>
                <p className="text-[10px] text-[#7A7A7A] uppercase tracking-wider font-semibold">vs Last Month</p>
                <p className={`text-base md:text-lg font-bold ${isTrendUp ? 'text-[#EA4335]' : 'text-[#34A853]'}`}>
                  {isTrendUp ? '+' : '-'}{absTrend}%
                </p>
              </div>
            </div>
          </div>

          {/* 2. PERIOD INFLOW */}
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 shadow-xl relative overflow-hidden hover:border-emerald-500/20 hover:shadow-emerald-500/5 hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#34A853]"><TrendingUp size={48} /></div>
            <h3 className="text-[#B0B0B0] text-xs font-semibold uppercase tracking-wider relative z-10">Period Inflow</h3>
            <p className="text-xl md:text-2xl font-bold font-mono text-[#34A853] mt-2 relative z-10">{format(insights.income, preferredCurrency)}</p>
          </div>

          {/* 3. PERIOD OUTFLOW */}
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 shadow-xl relative overflow-hidden hover:border-red-500/20 hover:shadow-red-500/5 hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#EA4335]"><TrendingDown size={48} /></div>
            <h3 className="text-[#B0B0B0] text-xs font-semibold uppercase tracking-wider relative z-10">Period Outflow</h3>
            <p className="text-xl md:text-2xl font-bold font-mono text-white mt-2 relative z-10">{format(insights.expense, preferredCurrency)}</p>
          </div>

          {/* 4. TOP SPEND — display only, no redirect */}
          <div
            className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 shadow-xl relative overflow-hidden hover:border-[#3A3A3A] hover:shadow-2xl transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#4285F4]"><PieIcon size={48} /></div>
            <h3 className="text-[#B0B0B0] text-xs font-semibold uppercase tracking-wider relative z-10">Top Category</h3>
            <p className="text-base md:text-lg font-bold text-white mt-2 relative z-10 truncate">
              {insights.topCategoryInfo ? insights.topCategoryInfo.name : 'N/A'}
            </p>
            {insights.topCategoryInfo && (
              <p className="text-xs font-mono text-[#7A7A7A] mt-1 relative z-10">
                {format(insights.topCategoryInfo.amount, preferredCurrency)} ({insights.topCategoryInfo.percentage.toFixed(0)}%)
              </p>
            )}
          </div>

          {/* 5. DAILY AVERAGE */}
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 shadow-xl relative overflow-hidden hover:border-amber-500/20 hover:shadow-amber-500/5 hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#FB8C00]"><Clock size={48} /></div>
            <h3 className="text-[#B0B0B0] text-xs font-semibold uppercase tracking-wider relative z-10">Daily Average</h3>
            <p className="text-xl md:text-2xl font-bold font-mono text-white mt-2 relative z-10">{format(insights.dailyAverage, preferredCurrency)}</p>
            <p className="text-[11px] text-[#7A7A7A] mt-1 relative z-10">This Month</p>
          </div>

          {/* 6. UPI SPEND */}
          <div className="md:col-span-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 shadow-xl relative overflow-hidden hover:border-indigo-500/20 hover:shadow-indigo-500/5 hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#8B5CF6]"><Activity size={48} /></div>
            <h3 className="text-[#B0B0B0] text-xs font-semibold uppercase tracking-wider relative z-10">Digital Spend (UPI)</h3>
            <p className="text-xl md:text-2xl font-bold font-mono text-white mt-2 relative z-10">{format(insights.upiInsights?.total || 0, preferredCurrency)}</p>
            <p className="text-[11px] text-[#7A7A7A] mt-1 relative z-10">{(insights.upiInsights?.percentage || 0).toFixed(0)}% of total period outflow</p>
          </div>

          {/* 7. TOP UPI PAYEE */}
          <div className="md:col-span-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-5 shadow-xl relative overflow-hidden hover:border-[#3A3A3A] hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#10B981]"><Wallet size={48} /></div>
            <h3 className="text-[#B0B0B0] text-xs font-semibold uppercase tracking-wider relative z-10">Top Digital Payee</h3>
            <p className="text-base md:text-lg font-bold text-white mt-2 relative z-10 truncate">
              {insights.upiInsights?.topPayee ? insights.upiInsights.topPayee.name : 'N/A'}
            </p>
            {insights.upiInsights?.topPayee && (
              <p className="text-xs font-mono text-[#7A7A7A] mt-1 relative z-10">
                {format(insights.upiInsights.topPayee.amount, preferredCurrency)} via UPI
              </p>
            )}
          </div>
        </div>

        {/* CHARTS — Row 1: Line + Pie */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 6. SPENDING TRENDS LINE CHART */}
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl hover:border-[#3A3A3A] hover:shadow-2xl transition-all duration-300 min-h-[340px] md:min-h-[400px] min-w-0">
            <SpendingTrends trendData={insights.trendData} onPointClick={handleDateDrill} />
          </div>

          {/* 7. CATEGORY PIE */}
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl hover:border-[#3A3A3A] hover:shadow-2xl transition-all duration-300 min-h-[340px] md:min-h-[400px] min-w-0">
            <CategoryPie topCategories={insights.topCategories} onDrilldown={handleCategoryDrill} onFilterLedger={handleFilterLedger} />
          </div>
        </div>

        {/* CHARTS — Row 2: Income vs Expense bar chart (full width) */}
        <div className="pb-6">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl hover:border-[#3A3A3A] hover:shadow-2xl transition-all duration-300 min-h-[330px] md:min-h-[380px] min-w-0">
            <IncomeExpenseChart
              transactions={transactions}
              globalRange={globalRange}
              onBarClick={(barData) => {
                if (barData.grouping === 'daily') {
                  handleDateDrill({ date: barData.key, expense: barData.expense, income: barData.income });
                } else {
                  handleCategoryDrill(insights.topCategories?.[0]?.[0] || 'General');
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Analytics Drill-down Modal */}
      {drillState && (
        <AnalyticsDrilldown
          mode={drillState.mode}
          category={drillState.category}
          date={drillState.date}
          dateInfo={drillState.dateInfo}
          transactions={transactions}
          allTransactions={allTransactions}
          totalExpense={insights.expense}
          categories={categoryNames}
          onClose={() => setDrillState(null)}
          onSwitchCategory={(newCat) => setDrillState({ mode: 'category', category: newCat })}
          onSwitchToCategory={handleSwitchToCategory}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
