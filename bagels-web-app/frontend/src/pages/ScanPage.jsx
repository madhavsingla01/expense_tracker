import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Activity, ZoomIn, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import Tesseract from 'tesseract.js';

const MAX_SCAN_EDGE = 1400;
const JPEG_QUALITY = 0.82;
const AMOUNT_LABEL_RE = /(grand\s*total|amount\s*due|total\s*amount|net\s*amount|balance\s*due|subtotal|total|amount)/i;
const IGNORE_PAYEE_RE = /(invoice|receipt|tax|gst|vat|bill|cashier|customer|phone|date|time|total|amount|qty|quantity|price|subtotal|change|payment)/i;

const cleanLine = (line) => line.replace(/\s+/g, ' ').trim();

const normalizeAmount = (value) => {
  const amount = parseFloat(value.replace(/[^\d.,]/g, '').replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const extractAmount = (text) => {
  const lines = text.split('\n').map(cleanLine).filter(Boolean);
  const labelledAmounts = [];
  const allAmounts = [];

  lines.forEach((line) => {
    const matches = line.match(/(?:rs\.?|inr|\u20b9|\$)?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})/gi) || [];
    matches.forEach((match) => {
      const amount = normalizeAmount(match);
      if (!amount) return;
      allAmounts.push(amount);
      if (AMOUNT_LABEL_RE.test(line)) labelledAmounts.push(amount);
    });
  });

  const candidates = labelledAmounts.length ? labelledAmounts : allAmounts;
  return candidates.length ? Math.max(...candidates).toFixed(2) : '';
};

const toIsoDate = (year, month, day) => {
  const fullYear = Number(year.length === 2 ? `20${year}` : year);
  const monthIndex = Number(month) - 1;
  const dayNum = Number(day);
  const parsed = new Date(fullYear, monthIndex, dayNum);

  if (
    parsed.getFullYear() !== fullYear ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== dayNum
  ) {
    return null;
  }

  return parsed.toISOString().split('T')[0];
};

const extractDate = (text) => {
  const numericDate = text.match(/\b(\d{1,4})[.\-/ ](\d{1,2})[.\-/ ](\d{2,4})\b/);
  if (numericDate) {
    const [, first, second, third] = numericDate;

    if (first.length === 4) {
      const iso = toIsoDate(first, second, third);
      if (iso) return iso;
    } else {
      const firstNum = Number(first);
      const secondNum = Number(second);
      const day = firstNum > 12 || secondNum <= 12 ? first : second;
      const month = firstNum > 12 || secondNum <= 12 ? second : first;
      const iso = toIsoDate(third, month, day);
      if (iso) return iso;
    }
  }

  const namedDate = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i);
  if (namedDate) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.indexOf(namedDate[2].slice(0, 3).toLowerCase()) + 1;
    const iso = toIsoDate(namedDate[3], String(month), namedDate[1]);
    if (iso) return iso;
  }

  return new Date().toISOString().split('T')[0];
};

const extractPayee = (text) => {
  const lines = text
    .split('\n')
    .map((line) => cleanLine(line.replace(/[^a-zA-Z0-9&().,' -]/g, '')))
    .filter((line) => /[a-zA-Z]/.test(line) && line.length >= 3 && line.length <= 48);

  return lines.find((line) => !IGNORE_PAYEE_RE.test(line)) || lines[0] || 'Unknown Vendor';
};

export default function ScanPage({ onScanComplete, getPredictedCategory }) {
  const [image, setImage] = useState(null); // Now stores { url, width, height }
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [scanWords, setScanWords] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const workerRef = useRef(null);
  const workerPromiseRef = useRef(null);

  useEffect(() => () => {
    if (workerRef.current) workerRef.current.terminate();
  }, []);

  const prepareWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;

    if (!workerPromiseRef.current) {
      setStatus((current) => current || 'Preparing OCR engine...');
      workerPromiseRef.current = Tesseract.createWorker('eng', 1, {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
        logger: (message) => {
          if (message.status === 'recognizing text') {
            const nextProgress = Math.round(message.progress * 100);
            setProgress(nextProgress);
            setStatus(`Reading bill... ${nextProgress}%`);
          } else if (message.status) {
            setStatus(message.status);
          }
        },
      })
        .then(async (worker) => {
          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            preserve_interword_spaces: '1',
            user_defined_dpi: '150',
          });
          workerRef.current = worker;
          return worker;
        })
        .catch((error) => {
          workerPromiseRef.current = null;
          throw error;
        });
    }

    return workerPromiseRef.current;
  }, []);

  const preprocessImage = async (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the selected image.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, MAX_SCAN_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const grey = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          const adjusted = Math.max(0, Math.min(255, (grey - 128) * 1.18 + 128));
          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
          data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        resolve({ url: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width: w, height: h });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  const startScan = useCallback(async (imageToScan = image) => {
    if (!imageToScan || isScanning) return;

    setIsScanning(true);
    setStatus('Preparing OCR engine...');
    setProgress(0);

    try {
      const worker = await prepareWorker();
      const { data: { text, confidence, words } } = await worker.recognize(imageToScan.url);
      setStatus('Processing extracted data...');

      const extractedPayee = extractPayee(text);
      const prediction = await getPredictedCategory(extractedPayee);
      
      setScanWords(words || []);

      setExtractedData({
        amount: extractAmount(text),
        payee: extractedPayee,
        date: extractDate(text),
        time: new Date().toTimeString().slice(0, 5),
        category: prediction?.category || 'General',
        notes: '',
        confidence: Math.round(confidence || 0),
      });
    } catch (error) {
      console.error('OCR extraction failed:', error);
      setStatus('Failed extraction. Try a clearer, well-lit photo.');
    } finally {
      setIsScanning(false);
    }
  }, [getPredictedCategory, image, isScanning, prepareWorker]);

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('Preparing image...');
    setProgress(0);
    setExtractedData(null);
    setScanWords([]);

    try {
      const processedImage = await preprocessImage(file);
      setImage(processedImage);
      await startScan(processedImage);
    } catch (error) {
      console.error('Image preparation failed:', error);
      setStatus('Could not read that image.');
      setIsScanning(false);
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirm = () => {
    onScanComplete({
      payee: extractedData.payee,
      amount: extractedData.amount,
      date: extractedData.date,
      category: extractedData.category,
      notes: extractedData.notes,
      receiptImage: image.url,
    });
  };

  const resetScan = () => {
    setImage(null);
    setExtractedData(null);
    setScanWords([]);
    setProgress(0);
    setStatus('');
  };

  return (
    <div className="max-w-7xl mx-auto pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-100 mb-1">Bill Scanner</h2>
        <p className="text-zinc-500 text-sm">Review extracted data before saving.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        <div className="bg-[#111113] border border-zinc-800/60 rounded-3xl p-6 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-zinc-200 font-medium text-sm">Source Document</h3>
            <div className="flex gap-2">
              <button className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 transition">
                <ZoomIn size={16} />
              </button>
              <button className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 transition">
                <RotateCw size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-black/40 rounded-2xl border border-zinc-800/50 flex flex-col items-center justify-center overflow-hidden relative">
            {!image ? (
              <div className="w-full h-full flex flex-col items-center justify-center hover:bg-zinc-900/50 transition p-6">
                <Camera className="w-12 h-12 text-zinc-600 mb-4" />
                <p className="text-zinc-400 font-medium text-center">Capture or upload a receipt</p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current.click()}
                    className="inline-flex items-center justify-center gap-2 bg-[#34d399] hover:bg-[#10b981] text-black font-semibold px-5 py-3 rounded-xl transition"
                  >
                    <Camera size={18} /> Open Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-5 py-3 rounded-xl transition"
                  >
                    Upload Bill
                  </button>
                </div>
                <input
                  type="file"
                  ref={cameraInputRef}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelected}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileSelected}
                />
              </div>
            ) : (
              <div className="relative w-full flex items-center justify-center bg-black/50 overflow-hidden">
                <img src={image.url} className="max-h-[500px] w-full h-full object-contain opacity-90" alt="Scanned Bill" />
                
                {/* Overlay for Bounding Boxes */}
                {scanWords.length > 0 && !isScanning && (
                  <svg 
                    viewBox={`0 0 ${image.width} ${image.height}`} 
                    preserveAspectRatio="xMidYMid meet"
                    className="absolute inset-0 w-full h-full max-h-[500px] pointer-events-none"
                  >
                    {scanWords.map((word, idx) => (
                      <rect 
                        key={idx}
                        x={word.bbox.x0}
                        y={word.bbox.y0}
                        width={word.bbox.x1 - word.bbox.x0}
                        height={word.bbox.y1 - word.bbox.y0}
                        className="fill-[#5eead4]/10 stroke-[#5eead4]/50 stroke-1"
                      />
                    ))}
                  </svg>
                )}

                <div className="absolute inset-4 sm:inset-8 border-2 border-[#5eead4]/40 pointer-events-none rounded-xl overflow-hidden z-10">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#5eead4]" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#5eead4]" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#5eead4]" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#5eead4]" />
                  {isScanning && <div className="absolute w-full h-0.5 bg-[#5eead4] shadow-[0_0_15px_#5eead4] animate-[scan_2s_ease-in-out_infinite]" />}
                </div>

                {isScanning && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-6 backdrop-blur-sm z-10">
                    <Activity className="w-10 h-10 text-[#5eead4] animate-spin mb-4" />
                    <p className="text-zinc-200 font-medium text-center">{status}</p>
                    {progress > 0 && (
                      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full bg-[#5eead4] transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            {image && !isScanning && (
              <button onClick={resetScan} className="text-zinc-400 hover:text-zinc-200 text-sm flex items-center gap-2 transition">
                <RotateCw size={14} /> Retake Scan
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#111113] border border-zinc-800/60 rounded-3xl p-6 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-zinc-200 font-medium text-lg">Extracted Data</h3>
            {extractedData && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                extractedData.confidence && extractedData.confidence < 60
                  ? 'bg-amber-500/10 border border-amber-500/40 text-amber-300'
                  : 'bg-[#064e3b]/30 border border-[#059669]/50 text-[#34d399]'
              }`}>
                <CheckCircle2 size={12} /> {extractedData.confidence ? `${extractedData.confidence}% OCR` : 'OCR Complete'}
              </div>
            )}
          </div>

          {!extractedData ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
              <Activity size={32} className="mb-4 opacity-50" />
              <p>{status || 'Upload a bill to see extracted data.'}</p>
              {image && !isScanning && (
                <button onClick={() => startScan()} className="mt-6 bg-[#34d399] hover:bg-[#10b981] text-black font-semibold py-3 px-8 rounded-xl transition shadow-[0_0_20px_rgba(52,211,153,0.2)]">
                  Analyze Bill Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5 flex-1 flex flex-col">
              {extractedData.confidence && extractedData.confidence < 60 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
                  <span>Low OCR confidence ({extractedData.confidence}%). Please double-check the extracted values.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Total Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium text-lg">₹</span>
                  <input type="text" value={extractedData.amount} onChange={(e) => setExtractedData({ ...extractedData, amount: e.target.value })} className="w-full bg-[#1e1e20] border border-zinc-800 rounded-xl pl-10 pr-4 py-4 text-[#5eead4] text-xl font-medium focus:outline-none focus:border-[#5eead4]/50" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Merchant Name</label>
                <input type="text" value={extractedData.payee} onChange={(e) => setExtractedData({ ...extractedData, payee: e.target.value })} className="w-full bg-[#1e1e20] border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date</label>
                  <div className="relative">
                    <input type="date" value={extractedData.date} onChange={(e) => setExtractedData({ ...extractedData, date: e.target.value })} className="w-full bg-[#1e1e20] border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 [color-scheme:dark]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Time</label>
                  <input type="time" value={extractedData.time} onChange={(e) => setExtractedData({ ...extractedData, time: e.target.value })} className="w-full bg-[#1e1e20] border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Category</label>
                <select value={extractedData.category} onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value })} className="w-full bg-[#1e1e20] border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600">
                  {['General', 'Food & Dining', 'Food & Delivery', 'Groceries', 'Shopping',
                    'Transport', 'Travel', 'Utilities', 'Healthcare', 'Subscriptions',
                    'Fuel', 'Bills & EMI', 'Health & Fitness', 'Education', 'Personal Care',
                    'Donations', 'Cash Withdrawal', 'Transfer', 'Entertainment', 'Income'
                  ].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes</label>
                <textarea value={extractedData.notes} onChange={(e) => setExtractedData({ ...extractedData, notes: e.target.value })} placeholder="Add context, corrections, or details..." className="w-full bg-[#1e1e20] border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 resize-none h-20" />
              </div>

              <div className="mt-auto pt-6 flex gap-4 border-t border-zinc-800/50">
                <button onClick={() => setExtractedData(null)} className="flex-1 bg-transparent hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium py-3 rounded-full transition">Discard</button>
                <button onClick={handleConfirm} className="flex-1 bg-[#5eead4] hover:bg-[#34d399] text-black font-semibold py-3 rounded-full transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(94,234,212,0.2)]">
                  <CheckCircle2 size={16} /> Confirm & Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}