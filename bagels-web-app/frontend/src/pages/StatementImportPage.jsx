import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ChevronUp, FileText, Trash2, Upload, XCircle, Undo2, Loader2, Settings, ListChecks, Sparkles } from 'lucide-react';
import { fmt } from '../utils/format';
import { useContextMenu } from '../context/ContextMenuContext';

function StatusPill({ status }) {
  const className = status === 'created'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : status === 'duplicate'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : status === 'failed'
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : 'border-zinc-700 bg-zinc-800 text-zinc-400';
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${className}`}>{status}</span>;
}

function BatchStatusBadge({ status }) {
  const map = {
    completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    failed: 'border-red-500/30 bg-red-500/10 text-red-300',
    reverted: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    processing: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  };
  const className = map[status] || map.processing;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{status === 'reverted' ? '↺ reverted' : status}</span>;
}

function ConfirmDialog({ title, message, onConfirm, onCancel, isProcessing }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-[scaleIn_0.15s_ease-out]">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 flex-shrink-0"><Trash2 size={20} /></div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
            <p className="text-sm text-zinc-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 mb-5">
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <Undo2 size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
            <span>Ledger reversal entries will be created for each transaction. Account balance will be restored. This action is audited.</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 bg-transparent hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium py-3 rounded-xl transition disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isProcessing} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
            {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Reverting...</> : <><Trash2 size={16} /> Revert Import</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportDetailPanel({ batch, onClose }) {
  if (!batch || !batch.transactions) return null;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0c] p-5 shadow-xl animate-[slideDown_0.2s_ease-out]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-200">Transactions from <span className="text-emerald-400">{batch.fileName}</span> <span className="ml-2 text-zinc-500 font-normal">({batch.liveTransactionCount} active)</span></h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 transition"><ChevronUp size={14} /> Collapse</button>
      </div>
      {batch.transactions.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-zinc-500 bg-zinc-950">
              <tr className="border-b border-zinc-800"><th className="p-3">Date</th><th className="p-3">Payee</th><th className="p-3">Category</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {batch.transactions.map((tx) => (
                <tr key={tx.id || tx._id} className="text-zinc-300">
                  <td className="p-3 font-mono text-zinc-400">{tx.date}</td><td className="p-3 text-zinc-200 font-medium">{tx.payee}</td>
                  <td className="p-3"><span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs border border-zinc-700">{tx.category}</span></td>
                  <td className={`p-3 font-mono font-bold text-right ${tx.credit ? 'text-emerald-400' : 'text-red-400'}`}>{tx.credit ? '+' : '-'}{fmt(tx.credit || tx.debit)}</td>
                  <td className="p-3"><StatusPill status={tx.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-zinc-500 text-sm text-center py-6">No active transactions remain for this import.</p>}
    </div>
  );
}



export default function StatementImportPage({ previewStatement, importStatement, listImports, getImportDetail, deleteImport, refreshTransactions }) {
  const inputRef = useRef(null);
  
  // Wizard state: 1 = Upload, 2 = Map, 3 = Processed Preview (Final Check), 4 = Result
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [processedPreviewData, setProcessedPreviewData] = useState(null);
  
  // Mapping States
  const [mapping, setMapping] = useState({ date: -1, description: [], debit: -1, credit: -1, amount: -1, type: -1 });
  const [mappingMode, setMappingMode] = useState(null); // 'amount_type', 'debit_credit', null
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [localPreviewRows, setLocalPreviewRows] = useState([]);
  const [viewMode, setViewMode] = useState('raw'); // 'raw', 'preview', 'split'
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importHistory, setImportHistory] = useState([]);

  const summary = result?.summary || {};

  // Cascade delete state
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

  // Detail view state
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [expandedBatchDetail, setExpandedBatchDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const { bindContextMenu } = useContextMenu();

  const fetchHistory = useCallback(async () => { if (!listImports) return; setImportHistory(await listImports(15)); }, [listImports]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  
  useEffect(() => {
    if (previewData && !previewData.isPdf && previewData.headers?.length > 0) {
      const templateKey = `mapping_template_${previewData.headers.join(',')}`;
      const saved = localStorage.getItem(templateKey);
      
      let newMapping = { date: -1, description: -1, debit: -1, credit: -1, amount: -1, type: -1 };
      let newAi = {};

      // AI Suggestion Logic
      previewData.headers.forEach((h, i) => {
        const lower = String(h).toLowerCase();
        if (lower.includes('date')) { newAi[i] = { field: 'date', conf: 'high' }; newMapping.date = i; }
        else if (lower.includes('desc') || lower.includes('particulars') || lower.includes('narration') || lower.includes('remark')) { newAi[i] = { field: 'description', conf: 'high' }; newMapping.description = [i]; }
        else if (lower === 'dr' || lower.includes('withdrawal') || lower.includes('debit')) { newAi[i] = { field: 'debit', conf: 'high' }; newMapping.debit = i; }
        else if (lower === 'cr' || lower.includes('deposit') || lower.includes('credit')) { newAi[i] = { field: 'credit', conf: 'high' }; newMapping.credit = i; }
        else if (lower === 'amount' || lower === 'rs.') { newAi[i] = { field: 'amount', conf: 'high' }; newMapping.amount = i; }
        else if (lower.includes('type') || lower.includes('dr/cr')) { newAi[i] = { field: 'type', conf: 'medium' }; newMapping.type = i; }
      });

      if (saved) {
        try { newMapping = { ...newMapping, ...JSON.parse(saved) }; } catch(e) {}
      }

      setAiSuggestions(newAi);
      setMapping(newMapping);
      
      if (newMapping.amount !== -1 || newMapping.type !== -1) setMappingMode('amount_type');
      else if (newMapping.debit !== -1 || newMapping.credit !== -1) setMappingMode('debit_credit');
      else setMappingMode(null);
    }
  }, [previewData]);

  useEffect(() => {
    if (!previewData || previewData.isPdf || !mapping) return;
    
    const extractValue = (row, mappingValue) => {
      if (mappingValue === undefined || mappingValue === null || mappingValue === -1 || (Array.isArray(mappingValue) && mappingValue.length === 0)) return null;
      if (Array.isArray(mappingValue)) return mappingValue.map(idx => row[idx]).filter(Boolean).join(' ');
      return row[mappingValue] || null;
    };

    const parseAmount = (val) => {
      if (!val) return null;
      const clean = String(val).replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? null : parsed;
    };

    const computed = (previewData.previewRows || []).slice(0, 5).map(row => {
      const dateStr = extractValue(row, mapping.date);
      const desc = extractValue(row, mapping.description);
      const debitStr = extractValue(row, mapping.debit);
      const creditStr = extractValue(row, mapping.credit);
      const amountStr = extractValue(row, mapping.amount);
      const typeStr = extractValue(row, mapping.type);

      const dVal = parseAmount(debitStr);
      const cVal = parseAmount(creditStr);
      const aVal = parseAmount(amountStr);

      let debit = null;
      let credit = null;

      if (mappingMode === 'debit_credit') {
        if (dVal && dVal > 0) debit = dVal;
        if (cVal && cVal > 0) credit = cVal;
      } else if (mappingMode === 'amount_type' && aVal !== null) {
        if (typeStr) {
          const isInc = /\b(cr|credit|deposit|refund|salary)\b/i.test(String(typeStr));
          if (isInc) credit = Math.abs(aVal);
          else debit = Math.abs(aVal);
        } else {
          if (aVal < 0) debit = Math.abs(aVal);
          else credit = Math.abs(aVal); // simplistic inference
        }
      }

      const isComplete = Boolean(dateStr && desc && (debit !== null || credit !== null));

      return {
        date: dateStr || '',
        description: desc || '',
        debit,
        credit,
        isComplete
      };
    });
    setLocalPreviewRows(computed);
  }, [previewData, mapping, mappingMode]);

  const handleSetMapping = (columnIndex, fieldKey) => {
    let newMode = mappingMode;
    if (fieldKey === 'amount' || fieldKey === 'type') newMode = 'amount_type';
    if (fieldKey === 'debit' || fieldKey === 'credit') newMode = 'debit_credit';

    let newMapping = { ...mapping };

    if (mappingMode !== newMode && newMode !== null) {
      if (newMode === 'amount_type') {
         newMapping.debit = -1; newMapping.credit = -1;
      } else {
         newMapping.amount = -1; newMapping.type = -1;
      }
    }

    // Always clear this column from previous assignments first
    Object.keys(newMapping).forEach(k => {
      if (Array.isArray(newMapping[k])) newMapping[k] = newMapping[k].filter(idx => idx !== columnIndex);
      else if (newMapping[k] === columnIndex) newMapping[k] = -1;
    });

    if (fieldKey) {
      if (fieldKey === 'description') {
        // Description always an array
        if (!Array.isArray(newMapping.description)) newMapping.description = newMapping.description === -1 ? [] : [newMapping.description];
        newMapping.description.push(columnIndex);
      } else {
        // Others are singular
        newMapping[fieldKey] = columnIndex;
      }
    }

    setMapping(newMapping);
    
    // Check if mode reverted to null
    const hasAmtType = newMapping.amount !== -1 || newMapping.type !== -1;
    const hasDrCr = newMapping.debit !== -1 || newMapping.credit !== -1;
    if (!hasAmtType && !hasDrCr) setMappingMode(null);
    else setMappingMode(newMode);
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile); setError(''); setIsLoading(true); setStep(1);
    try {
      const data = await previewStatement(selectedFile);
      setPreviewData(data); setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to preview file'); setFile(null);
    } finally { setIsLoading(false); }
  };

  const handleFinalCheck = async () => {
    if (!file || isLoading) return;
    
    // Validation
    const hasDescription = Array.isArray(mapping.description)
      ? mapping.description.length > 0
      : mapping.description !== -1;
    if (mapping.date === -1 || !hasDescription) {
      setError('Date and Description columns are strictly required.');
      return;
    }
    if (mappingMode === null) {
      setError('Please map either Amount/Type OR Debit/Credit columns.');
      return;
    }

    setError(''); setIsLoading(true);
    try {
      if (previewData && !previewData.isPdf && previewData.headers?.length > 0) {
        localStorage.setItem(`mapping_template_${previewData.headers.join(',')}`, JSON.stringify(mapping));
      }
      const data = await previewStatement(file, previewData?.isPdf ? null : mapping);
      setProcessedPreviewData(data); setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to process mapping');
    } finally { setIsLoading(false); }
  };

  const handleImport = async () => {
    if (!file || isLoading) return;
    setError(''); setResult(null); setIsLoading(true);
    try {
      const data = await importStatement(file, previewData?.isPdf ? null : mapping);
      setResult(data); setStep(4);
      await refreshTransactions?.(); await fetchHistory();
    } catch (uploadError) {
      setError(uploadError.response?.data?.message || uploadError.message || 'Statement import failed');
    } finally { setIsLoading(false); }
  };

  const resetFlow = () => {
    setStep(1); setFile(null); setPreviewData(null); setProcessedPreviewData(null); setResult(null); setError('');
    setMapping({ date: -1, description: [], debit: -1, credit: -1, amount: -1, type: -1 });
    setMappingMode(null);
    setViewMode('raw');
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete || !deleteImport) return;
    setIsDeleting(true); setDeleteResult(null);
    try {
      const result = await deleteImport(confirmDelete);
      setDeleteResult(result);
      // Refresh both the import history AND the global transaction list
      // so that dashboard, ledger, and insights all re-sync
      await Promise.all([
        fetchHistory(),
        refreshTransactions?.(),
      ]);
      if (expandedBatchId === confirmDelete) { setExpandedBatchId(null); setExpandedBatchDetail(null); }
    } catch (err) { setDeleteResult({ error: err.response?.data?.message || err.message || 'Failed to revert import' }); }
    finally { setIsDeleting(false); setConfirmDelete(null); }
  };

  const toggleDetail = async (batchId) => {
    if (expandedBatchId === batchId) { setExpandedBatchId(null); setExpandedBatchDetail(null); return; }
    setExpandedBatchId(batchId); setLoadingDetail(true);
    try { setExpandedBatchDetail(await getImportDetail(batchId)); }
    catch { setExpandedBatchDetail(null); } finally { setLoadingDetail(false); }
  };

  const [isDragging, setIsDragging] = useState(false);
  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragIn = (e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer?.items?.length > 0) setIsDragging(true); };
  const handleDragOut = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const droppedFile = e.dataTransfer?.files?.[0]; if (droppedFile) handleFileSelect(droppedFile); };

  return (
    <div className="max-w-6xl mx-auto w-full h-full flex flex-col overflow-y-auto custom-scrollbar pb-4">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-2xl font-bold text-zinc-100">Statement Import</h2>
        <p className="text-sm text-zinc-500 mt-1">Smart import mapping system with dual preview.</p>
      </div>

      {/* Wizard Section */}
      <section className="flex-shrink-0 rounded-2xl md:rounded-3xl border border-zinc-800 bg-[#0a0a0c] p-4 md:p-6 shadow-xl max-h-[72vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar">
        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <div>
            <input ref={inputRef} type="file" accept=".csv,.pdf,.xlsx,.xls,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0])} />
            <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }} onDragEnter={handleDragIn} onDragOver={handleDrag} onDragLeave={handleDragOut} onDrop={handleDrop} className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 px-6 cursor-pointer transition-all ${isDragging ? 'border-emerald-400 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900/50'}`}>
              {isLoading ? (
                <div className="flex flex-col items-center"><Loader2 size={32} className="animate-spin text-emerald-400 mb-4" /><p className="text-sm font-medium text-zinc-200">Analyzing file structure...</p></div>
              ) : (
                <><div className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition ${isDragging ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}><Upload size={26} /></div><p className="text-sm font-medium text-zinc-200">{isDragging ? 'Drop your file here' : 'Drop file here or click to browse'}</p><p className="text-xs text-zinc-500 mt-1">Supports Excel, CSV and PDF bank statements (max 10 MB)</p></>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 2 && previewData && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0"><Settings size={22} /></div>
                <div><h3 className="text-lg font-bold text-zinc-100">Inline Column Mapping</h3><p className="text-xs text-zinc-400">{file?.name}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={resetFlow} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition">Cancel</button>
                <button onClick={handleFinalCheck} disabled={isLoading} className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <>Next: Final Check</>}
                </button>
              </div>
            </div>

            {previewData.isPdf ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <FileText size={40} className="mx-auto text-zinc-600 mb-3" /><h4 className="text-zinc-200 font-semibold mb-1">PDF Detected</h4><p className="text-sm text-zinc-500">We will extract text and infer transactions automatically. Column mapping is not required for PDF.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Mode Active Alert and View Toggles */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {mappingMode ? (
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${mappingMode === 'amount_type' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                      <Sparkles size={16} />
                      <span>Mode: {mappingMode === 'amount_type' ? 'Amount + Type' : 'Debit / Credit'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 text-sm font-medium">
                      <span>Select mapping to detect mode</span>
                    </div>
                  )}

                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                    <button onClick={() => setViewMode('raw')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'raw' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Raw Data</button>
                    <button onClick={() => setViewMode('preview')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'preview' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Mapped Preview</button>
                    <button onClick={() => setViewMode('split')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'split' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Split View</button>
                  </div>
                </div>

                {/* Unified Table View */}
                <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                  
                  {/* Raw Data Column */}
                  {(viewMode === 'raw' || viewMode === 'split') && (
                    <div className="flex flex-col">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText size={14} /> 1. Map Columns <span className="normal-case font-normal text-zinc-500 ml-2">(Use the dropdowns or header menu)</span>
                      </h4>
                      <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950 shadow-inner custom-scrollbar pb-4 flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                          <thead className="bg-zinc-900 border-b border-zinc-800">
                            <tr>
                              {previewData.headers.map((h, i) => {
                                const isMappedField = Object.keys(mapping).find(k => Array.isArray(mapping[k]) ? mapping[k].includes(i) : mapping[k] === i);
                                const ai = aiSuggestions[i];
                                
                                const menuOptions = [
                                  { label: 'Map to Date', onClick: () => handleSetMapping(i, 'date') },
                                  { label: 'Map to Description', onClick: () => handleSetMapping(i, 'description') },
                                  { divider: true },
                                  { label: 'Map to Amount', onClick: () => handleSetMapping(i, 'amount'), disabled: mappingMode === 'debit_credit' },
                                  { label: 'Map to Type (Dr/Cr)', onClick: () => handleSetMapping(i, 'type'), disabled: mappingMode === 'debit_credit' },
                                  { divider: true },
                                  { label: 'Map to Debit', onClick: () => handleSetMapping(i, 'debit'), disabled: mappingMode === 'amount_type' },
                                  { label: 'Map to Credit', onClick: () => handleSetMapping(i, 'credit'), disabled: mappingMode === 'amount_type' },
                                  { divider: true },
                                  { label: 'Ignore (Unmap)', danger: true, onClick: () => handleSetMapping(i, null) }
                                ];

                                return (
                                  <th key={i} className="p-0 border-r border-zinc-800 last:border-0 relative align-top min-w-[120px]">
                                    <div 
                                      {...bindContextMenu(menuOptions)}
                                      className={`p-3 cursor-context-menu hover:bg-zinc-800 transition group flex flex-col gap-1.5 h-full ${isMappedField ? 'bg-indigo-500/5' : ''}`}
                                    >
                                      <div className="flex items-center justify-between gap-4">
                                        <span className={`font-medium text-xs ${isMappedField ? 'text-indigo-400' : 'text-zinc-500'}`}>{h || `Column ${i+1}`}</span>
                                      </div>
                                      <div className="min-h-[24px]">
                                        {isMappedField ? (
                                          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded uppercase tracking-widest">{isMappedField}</span>
                                        ) : ai ? (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 w-max ${ai.conf === 'high' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                            <Sparkles size={10} /> Suggest: {ai.field}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-zinc-600">Unmapped</span>
                                        )}
                                      </div>
                                      <select
                                        value={isMappedField || ''}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => handleSetMapping(i, event.target.value || null)}
                                        className="mt-1 w-full min-h-[36px] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                                      >
                                        <option value="">Ignore</option>
                                        <option value="date">Date</option>
                                        <option value="description">Description</option>
                                        <option value="amount" disabled={mappingMode === 'debit_credit'}>Amount</option>
                                        <option value="type" disabled={mappingMode === 'debit_credit'}>Type</option>
                                        <option value="debit" disabled={mappingMode === 'amount_type'}>Debit</option>
                                        <option value="credit" disabled={mappingMode === 'amount_type'}>Credit</option>
                                      </select>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {previewData.previewRows.slice(0, 5).map((row, i) => (
                              <tr key={i}>{previewData.headers.map((_, colIdx) => (
                                <td 
                                  key={colIdx} 
                                  {...bindContextMenu([{ label: 'Auto-detect Mapping from cell', icon: Sparkles, onClick: () => {} }])} 
                                  className="p-3 text-zinc-400 text-xs border-r border-zinc-800/50 last:border-0 cursor-context-menu hover:bg-zinc-800/30"
                                >
                                  {row[colIdx] || ''}
                                </td>
                              ))}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Final Mapped Preview Column */}
                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div className="flex flex-col">
                      <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ListChecks size={14} /> 2. Final Mapped Preview
                      </h4>
                      <div className="overflow-x-auto border border-emerald-500/20 rounded-xl bg-zinc-950 shadow-inner pb-4 flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                          <thead className="bg-emerald-500/5 border-b border-emerald-500/20">
                            <tr>
                              <th className="p-3 font-medium text-xs text-emerald-200 h-[64px] align-top pt-3">Date</th>
                              <th className="p-3 font-medium text-xs text-emerald-200 h-[64px] align-top pt-3">Description</th>
                              <th className="p-3 font-medium text-xs text-emerald-200 text-right h-[64px] align-top pt-3">Debit</th>
                              <th className="p-3 font-medium text-xs text-emerald-200 text-right h-[64px] align-top pt-3">Credit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {localPreviewRows.map((row, i) => (
                              <tr key={i} className={!row.isComplete ? 'bg-red-500/5' : ''}>
                                <td className={`p-3 text-xs font-mono ${!row.date ? 'text-red-400 italic' : 'text-zinc-300'}`}>{row.date || 'Missing'}</td>
                                <td className={`p-3 text-xs max-w-[200px] truncate ${!row.description ? 'text-red-400 italic' : 'text-zinc-300'}`} title={row.description}>{row.description || 'Missing'}</td>
                                <td className="p-3 text-xs font-mono text-right text-red-400/90">{row.debit !== null ? fmt(row.debit) : '-'}</td>
                                <td className="p-3 text-xs font-mono text-right text-emerald-400">{row.credit !== null ? fmt(row.credit) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
                <p className="text-[10px] text-zinc-500 mt-2 italic">* Showing first 5 rows instantly computed based on your column mapping.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PROCESSED PREVIEW (FINAL CHECK) */}
        {step === 3 && processedPreviewData && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 flex-shrink-0"><ListChecks size={22} /></div>
                <div><h3 className="text-lg font-bold text-zinc-100">Final Verification</h3><p className="text-xs text-zinc-400">Review processed data before saving</p></div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(2)} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition">Back to Mapping</button>
                <button onClick={handleImport} disabled={isLoading || processedPreviewData.processedPreview?.length === 0} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={16} className="animate-spin" /> Importing...</> : <><Upload size={16} /> Import Now</>}
                </button>
              </div>
            </div>

            {processedPreviewData.warnings?.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300 flex flex-col gap-2">
                {processedPreviewData.warnings.map((w, i) => <div key={i} className="flex gap-2"><AlertTriangle size={16} className="shrink-0" />{w}</div>)}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Processed Transactions Preview</h4>
                {processedPreviewData.processedPreview?.length === 0 && <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-1 rounded">No valid transactions found. Please check your mapping.</span>}
              </div>
              
              <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                    <tr><th className="p-3">Parsed Date</th><th className="p-3">Derived Merchant</th><th className="p-3">Full Description</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {(processedPreviewData.processedPreview || []).map((row, i) => (
                      <tr key={i}>
                        <td className="p-3 text-zinc-300 font-mono">{row.date ? new Date(row.date).toLocaleDateString() : <span className="text-red-400">Invalid</span>}</td>
                        <td className="p-3 text-zinc-200 font-medium">{row.merchant || <span className="text-red-400">Missing</span>}</td>
                        <td className="p-3 text-zinc-400 max-w-xs truncate" title={row.description}>{row.description || <span className="text-red-400">Missing</span>}</td>
                        <td className="p-3 font-mono font-bold text-right text-red-400/90">{row.type === 'expense' && row.amount ? `-${fmt(row.amount)}` : '-'}</td>
                        <td className="p-3 font-mono font-bold text-right text-emerald-400">{row.type === 'income' && row.amount ? `+${fmt(row.amount)}` : '-'}</td>
                      </tr>
                    ))}
                    {(!processedPreviewData.processedPreview || processedPreviewData.processedPreview.length === 0) && (
                      <tr><td colSpan="5" className="p-8 text-center text-zinc-500">No transactions could be parsed from the first few rows. Adjust your mapping.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 italic">* Showing up to 5 processed rows</p>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT */}
        {step === 4 && result && (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={32} /></div>
            <h3 className="text-xl font-bold text-white mb-2">Import Complete</h3>
            <p className="text-zinc-400 mb-6 max-w-md">Successfully processed <span className="text-emerald-400 font-semibold">{summary.created}</span> new transactions. {summary.duplicates > 0 && ` Skipped ${summary.duplicates} duplicates.`}</p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-6">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl"><p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">New</p><p className="text-2xl font-mono text-emerald-400 font-bold mt-1">{summary.created}</p></div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl"><p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Failed</p><p className={`text-2xl font-mono font-bold mt-1 ${summary.failed > 0 ? 'text-red-400' : 'text-zinc-500'}`}>{summary.failed}</p></div>
            </div>
            <button onClick={resetFlow} className="px-6 py-2.5 rounded-xl bg-zinc-800 text-white font-semibold hover:bg-zinc-700 transition">Import Another</button>
          </div>
        )}
        
        {error && step !== 1 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"><XCircle size={18} className="mt-0.5 flex-shrink-0" /><span>{error}</span></div>
        )}
      </section>

      {deleteResult && (
        <section className={`rounded-2xl border p-4 text-sm flex items-start gap-3 ${deleteResult.error ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-purple-500/20 bg-purple-500/10 text-purple-200'}`}>
          {deleteResult.error ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" /> : <Undo2 size={18} className="mt-0.5 flex-shrink-0" />}
          <div><p className="font-semibold">{deleteResult.error ? 'Revert Failed' : 'Import Reverted Successfully'}</p><p className="mt-0.5 opacity-80">{deleteResult.error || `Restored account balance by ${fmt(deleteResult.balanceImpact)}. ${deleteResult.transactionsDeleted} transactions removed.`}</p></div>
        </section>
      )}

      {/* Import History */}
      <section className="mt-4">
        <div className="flex items-center gap-2 mb-4"><Clock size={18} className="text-zinc-500" /><h3 className="text-lg font-bold text-zinc-200">Import History</h3></div>
        {importHistory.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800/50 bg-[#0a0a0c]/50 p-8 text-center"><p className="text-sm text-zinc-500">No previous imports found.</p></div>
        ) : (
          <div className="space-y-3 pb-6">
            {importHistory.map((batch) => (
              <div key={batch._id} className="space-y-3">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-[#111113] p-4 transition hover:border-zinc-700 cursor-context-menu"
                  {...bindContextMenu([
                    { label: 'View Details', icon: ListChecks, onClick: () => toggleDetail(batch._id) },
                    { divider: true },
                    batch.status === 'completed' ? { label: 'Revert Import', icon: Undo2, danger: true, onClick: () => setConfirmDelete(batch._id) } : null
                  ])}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 flex-shrink-0"><FileText size={18} /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5"><p className="text-sm font-semibold text-zinc-100 truncate">{batch.fileName}</p><BatchStatusBadge status={batch.status} /></div>
                      <p className="text-xs text-zinc-500">{new Date(batch.createdAt).toLocaleString()} • {batch.liveTransactionCount > 0 ? `${batch.liveTransactionCount} active records` : 'All records removed'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-12 sm:pl-0 border-t border-zinc-800/50 sm:border-t-0 pt-3 sm:pt-0">
                    <button onClick={() => toggleDetail(batch._id)} className="px-3 py-1.5 text-[11px] font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition">{expandedBatchId === batch._id ? 'Hide' : 'Details'}</button>
                    {batch.status === 'completed' && <button onClick={() => setConfirmDelete(batch._id)} className="px-3 py-1.5 text-[11px] font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 rounded-lg transition">Revert</button>}
                  </div>
                </div>
                {expandedBatchId === batch._id && (
                  <div className="pl-4 sm:pl-12">
                    {loadingDetail ? <div className="flex items-center justify-center p-6 bg-[#0a0a0c] rounded-2xl border border-zinc-800"><Loader2 size={24} className="animate-spin text-zinc-600" /></div> : <ImportDetailPanel batch={expandedBatchDetail} onClose={() => { setExpandedBatchId(null); setExpandedBatchDetail(null); }} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {confirmDelete && <ConfirmDialog title="Revert Statement Import?" message="This will delete all transactions created from this statement. Do you want to proceed?" isProcessing={isDeleting} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}
