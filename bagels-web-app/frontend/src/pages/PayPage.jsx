import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, QrCode, Camera, CheckCircle2, Delete, User, ShoppingBag, EyeOff, Pencil, PlusCircle, Search, Trash2, Info, X, Wallet } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import API, { PAYMENT_WS_URL } from '../config/api';
import TransactionDetailsModal from '../components/ui/TransactionDetailsModal';
import { useContextMenu } from '../context/ContextMenuContext';

const ACTIVE_PAYMENT_KEY = 'bagels.activeUpiReferenceId';
const QUICK_PAY_BUSINESS_PREFS_KEY_PREFIX = 'bagels.quickPayBusinessPrefs';
const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const UPI_RESPONSE_KEYS = [
  'Status',
  'status',
  'txnId',
  'txnid',
  'responseCode',
  'ResponseCode',
  'ApprovalRefNo',
  'approvalRefNo',
  'txnRef',
  'txnref',
  'tr',
];

function sortAttempts(items) {
  return [...items].sort((a, b) => {
    const first = new Date(b.updatedAt || b.createdAt || 0).getTime();
    const second = new Date(a.updatedAt || a.createdAt || 0).getTime();
    return first - second;
  });
}

let checkoutScriptPromise = null;

function loadCheckoutScript() {
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (checkoutScriptPromise) {
    return checkoutScriptPromise;
  }

  checkoutScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
}

function buildUpiPreviewLink(receiverUpi, amountStr, note, referenceId = 'preview') {
  const payee = (receiverUpi || '').trim();
  const parsedAmount = parseFloat(amountStr);

  if (!/.+@.+/.test(payee) || !parsedAmount || parsedAmount <= 0) {
    return '';
  }

  const params = new URLSearchParams({
    pa: payee,
    pn: 'CASH CLAIR',
    am: parsedAmount.toFixed(2),
    cu: 'INR',
    tr: referenceId,
  });

  const trimmedNote = (note || '').trim();
  if (trimmedNote) {
    params.set('tn', trimmedNote.slice(0, 80));
  }

  return `upi://pay?${params.toString()}`;
}

function buildMerchantUpi(name) {
  return `${(name || '').toLowerCase().replace(/\s/g, '')}@merchant`;
}

function normalizeBusinessPrefs(value) {
  if (!value || typeof value !== 'object') {
    return { hiddenIds: [], overrides: {} };
  }

  return {
    hiddenIds: Array.isArray(value.hiddenIds) ? value.hiddenIds.filter(Boolean) : [],
    overrides: value.overrides && typeof value.overrides === 'object' ? value.overrides : {},
  };
}

function getEntityInitials(name) {
  return name?.split(/[@.\s]/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('') || '?';
}

function extractIntentPayloadFromLocation() {
  const candidates = [window.location.search, window.location.hash];

  for (const candidate of candidates) {
    const trimmed = (candidate || '').replace(/^[?#]/, '').trim();
    if (!trimmed) continue;

    const params = new URLSearchParams(trimmed);
    const payload = Object.fromEntries(params.entries());
    if (UPI_RESPONSE_KEYS.some((key) => payload[key])) {
      return payload;
    }
  }

  return null;
}

function getAttemptStatusMeta(status) {
  if (status === 'success') {
    return {
      label: 'Confirmed',
      chipClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
      dotClass: 'bg-emerald-400',
    };
  }

  if (status === 'failed') {
    return {
      label: 'Failed',
      chipClass: 'border-red-500/20 bg-red-500/10 text-red-400',
      dotClass: 'bg-red-400',
    };
  }

  return {
    label: 'Awaiting confirmation',
    chipClass: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    dotClass: 'bg-amber-400',
  };
}

function getPaymentStatusCopy(payment) {
  if (!payment) return '';

  if (payment.status === 'success') {
    return 'You manually confirmed this UPI payment. It is saved as unverified until you reconcile it outside the app.';
  }

  if (payment.status === 'failed') {
    return payment.failedReason || 'This payment attempt was marked failed.';
  }

  return 'Open the UPI app, complete payment there, then confirm it here. The app switch alone is not treated as success.';
}

function formatAttemptDate(value) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function QRDisplay({ value, size = 180 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const s = size;
    canvas.width = s;
    canvas.height = s;

    let hash = 0;
    const str = value || 'upi://pay';
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }

    const cellSize = 6;
    const grid = Math.floor(s / cellSize);
    const margin = 3;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);

    const rng = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let row = 0; row < grid; row += 1) {
      for (let col = 0; col < grid; col += 1) {
        const isCornerMarker =
          (row < 7 && col < 7) ||
          (row < 7 && col >= grid - 7) ||
          (row >= grid - 7 && col < 7);

        if (isCornerMarker) {
          const cornerRow = row < 7 ? row : row - (grid - 7);
          const cornerCol = col < 7 ? col : col - (grid - 7);
          const isOuter = cornerRow === 0 || cornerRow === 6 || cornerCol === 0 || cornerCol === 6;
          const isInner = cornerRow >= 2 && cornerRow <= 4 && cornerCol >= 2 && cornerCol <= 4;

          if (isOuter || isInner) {
            ctx.fillStyle = '#09090b';
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
          continue;
        }

        if (row < margin || col < margin || row >= grid - margin || col >= grid - margin) continue;

        const seed = hash + row * 100 + col;
        if (rng(seed) > 0.55) {
          ctx.fillStyle = '#09090b';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }

    const centerSize = 24;
    const cx = (s - centerSize) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 4, cx - 4, centerSize + 8, centerSize + 8);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(cx, cx, centerSize, centerSize, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', s / 2, s / 2 + 1);
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl shadow-sm border border-zinc-200"
      style={{ width: size, height: size }}
    />
  );
}

function ContactBubble({ name, upiId, onClick, type = 'person' }) {
  const initials = getEntityInitials(name);
  const colors = ['from-indigo-500 to-blue-500', 'from-fuchsia-500 to-pink-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-violet-500 to-purple-500'];
  const colorIdx = (name?.charCodeAt(0) || 0) % colors.length;

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group min-w-[64px] flex-shrink-0">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm group-hover:scale-105 transition-transform duration-200 ${type === 'business' ? 'bg-zinc-800 border border-zinc-700' : `bg-gradient-to-br ${colors[colorIdx]}`}`}>
        {type === 'business' ? <ShoppingBag size={20} className="text-zinc-300" /> : initials}
      </div>
      <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition truncate max-w-[72px] font-medium">
        {name?.split('@')[0] || 'Unknown'}
      </span>
    </button>
  );
}



const parseUpiQr = (rawValue) => {
  const value = (rawValue || '').trim();
  if (!value) return null;

  if (value.startsWith('upi://pay')) {
    const query = value.split('?')[1] || '';
    const params = new URLSearchParams(query);
    return {
      payee: params.get('pa') || '',
      name: params.get('pn') || '',
      amount: params.get('am') || '',
      note: params.get('tn') || params.get('tr') || '',
    };
  }

  if (/.+@.+/.test(value)) {
    return { payee: value, amount: '', note: '' };
  }

  return null;
};

export default function PayPage({ transactions = [], balance = 0, refreshTransactions, onUpdate }) {
  const { user, updateProfile, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const savedContacts = user?.savedContacts || [];
  const businessPrefsKey = useMemo(() => {
    const identity = user?._id || user?.email || 'guest';
    return `${QUICK_PAY_BUSINESS_PREFS_KEY_PREFIX}.${identity}`;
  }, [user?._id, user?.email]);

  const [payee, setPayee] = useState('');
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [isSavingQR, setIsSavingQR] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const qrScannerRef = useRef(null);
  const qrHandledRef = useRef(false);
  const qrClosingRef = useRef(false);

  const [showAllContacts, setShowAllContacts] = useState(false);
  const [showAllBusinesses, setShowAllBusinesses] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [draftUpi, setDraftUpi] = useState('');
  const [draftName, setDraftName] = useState('');
  const [editorError, setEditorError] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [businessSearch, setBusinessSearch] = useState('');
  const [detailsItem, setDetailsItem] = useState(null);
  const { openMenu, bindContextMenu } = useContextMenu();
  const [businessPrefs, setBusinessPrefs] = useState({ hiddenIds: [], overrides: {} });
  const [businessPrefsReady, setBusinessPrefsReady] = useState(false);

  const [paymentAttempts, setPaymentAttempts] = useState([]);
  const [activeReferenceId, setActiveReferenceId] = useState(() => sessionStorage.getItem(ACTIVE_PAYMENT_KEY) || '');
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(true);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const upiPreviewLink = useMemo(() => buildUpiPreviewLink(payee, amountStr, note), [payee, amountStr, note]);

  useEffect(() => {
    setBusinessPrefsReady(false);

    try {
      const stored = localStorage.getItem(businessPrefsKey);
      setBusinessPrefs(normalizeBusinessPrefs(stored ? JSON.parse(stored) : null));
    } catch (error) {
      console.warn('Failed to load business preferences', error);
      setBusinessPrefs({ hiddenIds: [], overrides: {} });
    } finally {
      setBusinessPrefsReady(true);
    }
  }, [businessPrefsKey]);

  useEffect(() => {
    if (!businessPrefsReady) return;
    localStorage.setItem(businessPrefsKey, JSON.stringify(businessPrefs));
  }, [businessPrefs, businessPrefsKey, businessPrefsReady]);

  const topContacts = useMemo(() => savedContacts.slice(0, 2), [savedContacts]);

  const businesses = useMemo(() => {
    const payees = transactions
      .filter((tx) => (tx.source === 'payment' || tx.source === 'upi_intent') && tx.type === 'expense')
      .map((tx) => tx.payee);
    const hiddenIds = new Set(businessPrefs.hiddenIds || []);
    const overrides = businessPrefs.overrides || {};

    return Array.from(new Set(payees))
      .filter((entry) => !savedContacts.some((contact) => contact.upiId === entry || contact.name === entry))
      .filter((entry) => !hiddenIds.has(entry))
      .map((entry) => {
        const override = overrides[entry];
        return {
          id: entry,
          sourceName: entry,
          name: (override?.name || entry).trim() || entry,
          upiId: (override?.upiId || buildMerchantUpi(entry)).trim() || buildMerchantUpi(entry),
        };
      });
  }, [transactions, savedContacts, businessPrefs]);

  const previewBusinesses = useMemo(() => businesses.slice(0, 4), [businesses]);

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return savedContacts;

    return savedContacts.filter((contact) => (
      `${contact.name || ''} ${contact.upiId || ''}`.toLowerCase().includes(query)
    ));
  }, [contactSearch, savedContacts]);

  const filteredBusinesses = useMemo(() => {
    const query = businessSearch.trim().toLowerCase();
    if (!query) return businesses;

    return businesses.filter((business) => (
      `${business.name || ''} ${business.upiId || ''}`.toLowerCase().includes(query)
    ));
  }, [businessSearch, businesses]);

  const recentAttempts = useMemo(() => paymentAttempts.slice(0, 5), [paymentAttempts]);

  const activeAttempt = useMemo(() => {
    if (activeReferenceId) {
      return paymentAttempts.find((attempt) => attempt.referenceId === activeReferenceId)
        || paymentAttempts.find((attempt) => ['created', 'pending', 'initiated'].includes(attempt.status))
        || paymentAttempts[0]
        || null;
    }

    return paymentAttempts.find((attempt) => ['created', 'pending', 'initiated'].includes(attempt.status)) || paymentAttempts[0] || null;
  }, [activeReferenceId, paymentAttempts]);

  const findLinkedTransaction = useCallback((attempt) => {
    if (!attempt) return null;

    return transactions.find((tx) => {
      const transactionKey = tx.id || tx._id;
      return (
        (attempt.transactionId && transactionKey === attempt.transactionId) ||
        (attempt.referenceId && tx.referenceId === attempt.referenceId) ||
        (attempt.gatewayPaymentId && tx.txnId === attempt.gatewayPaymentId)
      );
    }) || null;
  }, [transactions]);

  const editorTitle = editorState?.mode === 'edit-business'
    ? 'Edit Business'
    : editorState?.mode === 'edit-contact'
      ? 'Edit Contact'
      : 'Save Contact';

  const upsertAttempt = useCallback((nextAttempt) => {
    if (!nextAttempt?.referenceId) return;

    setPaymentAttempts((prev) => {
      const rest = prev.filter((attempt) => attempt.referenceId !== nextAttempt.referenceId);
      return sortAttempts([nextAttempt, ...rest]);
    });
    setActiveReferenceId(nextAttempt.referenceId);
  }, []);

  const resetComposer = useCallback(() => {
    setPayee('');
    setAmountStr('0');
    setNote('');
    setShowQR(false);
  }, []);

  const handleSettledPayment = useCallback(async (payment) => {
    if (payment?.status !== 'success') return;

    if (payment.referenceId === activeReferenceId) {
      resetComposer();
    }

    try {
      await refreshTransactions?.();
    } catch (error) {
      console.error('Failed to refresh transactions after settlement', error);
    }
  }, [activeReferenceId, refreshTransactions, resetComposer]);

  const loadAttempts = useCallback(async () => {
    setIsLoadingAttempts(true);
    try {
      const { data } = await API.get('/payments/intent?limit=12');
      const sorted = sortAttempts(data);
      const storedReference = sessionStorage.getItem(ACTIVE_PAYMENT_KEY);

      setPaymentAttempts(sorted);

      if (storedReference && sorted.some((attempt) => attempt.referenceId === storedReference)) {
        setActiveReferenceId(storedReference);
      } else if (sorted.find((attempt) => ['created', 'pending', 'initiated'].includes(attempt.status))) {
        setActiveReferenceId(sorted.find((attempt) => ['created', 'pending', 'initiated'].includes(attempt.status)).referenceId);
      } else if (sorted[0]) {
        setActiveReferenceId(sorted[0].referenceId);
      }
    } catch (error) {
      console.error('Failed to load payment attempts', error);
    } finally {
      setIsLoadingAttempts(false);
    }
  }, []);

  const saveContactIfNeeded = useCallback((upiId) => {
    if (!upiId || savedContacts.find((contact) => contact.upiId === upiId) || upiId.includes('@merchant')) {
      return;
    }

    const nextContact = { name: upiId.split('@')[0], upiId };
    updateProfile({ savedContacts: [...savedContacts, nextContact] })
      .then(() => fetchProfile())
      .catch((error) => console.error('Failed to auto-save contact', error));
  }, [fetchProfile, savedContacts, updateProfile]);

  const openGatewayCheckout = useCallback(async (attempt = activeAttempt) => {
    if (!attempt?.referenceId || !attempt?.checkout?.orderId) {
      setErrorMsg('No active gateway order is available for this payment.');
      return;
    }

    try {
      setErrorMsg('');
      const Razorpay = await loadCheckoutScript();

      if (!Razorpay) {
        throw new Error('Razorpay checkout is unavailable in this browser.');
      }

      const instance = new Razorpay({
        key: attempt.checkout.keyId,
        amount: attempt.checkout.amount,
        currency: attempt.checkout.currency,
        name: attempt.checkout.name,
        description: attempt.checkout.description,
        order_id: attempt.checkout.orderId,
        notes: attempt.checkout.notes,
        theme: { color: attempt.checkout.themeColor || '#10b981' },
        handler: async (response) => {
          try {
            const { data } = await API.post(`/payments/${attempt.referenceId}/verify`, response);
            upsertAttempt(data);
            await handleSettledPayment(data);
          } catch (error) {
            console.error('Failed to verify gateway payment', error);
            setErrorMsg(error.response?.data?.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            API.post(`/payments/${attempt.referenceId}/reconcile`)
              .then(async ({ data }) => {
                upsertAttempt(data);
                await handleSettledPayment(data);
              })
              .catch(() => {});
          },
        },
      });

      instance.open();
    } catch (error) {
      console.error('Failed to open gateway checkout', error);
      setErrorMsg(error.message || 'Failed to open gateway checkout');
    }
  }, [activeAttempt, handleSettledPayment, upsertAttempt]);

  const handleReconcileAttempt = useCallback(async (referenceId = activeAttempt?.referenceId, { silent = false } = {}) => {
    if (!referenceId) return;

    setErrorMsg('');
    setIsConfirmingPayment(true);

    try {
      const { data } = await API.post(`/payments/${referenceId}/reconcile`);
      upsertAttempt(data);
      await handleSettledPayment(data);

      if (!silent && data.status === 'pending') {
        setErrorMsg('Gateway still reports this payment as pending.');
      }
    } catch (error) {
      console.error('Failed to reconcile payment', error);
      setErrorMsg(error.response?.data?.message || 'Failed to check payment status');
    } finally {
      setIsConfirmingPayment(false);
    }
  }, [activeAttempt?.referenceId, handleSettledPayment, upsertAttempt]);

  const stopQRScanner = useCallback(async ({ hide = true } = {}) => {
    if (qrClosingRef.current && hide) return;

    qrClosingRef.current = true;
    qrHandledRef.current = true;
    setScannerStatus('Closing camera...');

    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;

    if (scanner) {
      try {
        const state = scanner.getState?.();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scanner.stop();
        }
      } catch (error) {
        console.warn('QR scanner stop skipped:', error);
      }

      try {
        scanner.clear();
      } catch (error) {
        console.warn('QR scanner clear skipped:', error);
      }
    }

    const reader = document.getElementById('upi-qr-reader');
    if (reader) reader.innerHTML = '';

    qrClosingRef.current = false;
    if (hide) setShowQRScanner(false);
  }, []);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  useEffect(() => {
    if (!user?.token) return undefined;

    const ws = new WebSocket(`${PAYMENT_WS_URL}?token=${encodeURIComponent(user.token)}`);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'payment.updated' || !message.payment) return;

        upsertAttempt(message.payment);
        handleSettledPayment(message.payment).catch((error) => {
          console.error('Failed to handle realtime payment update', error);
        });
      } catch (error) {
        console.error('Failed to parse payment websocket message', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [handleSettledPayment, upsertAttempt, user?.token]);

  useEffect(() => {
    const pendingReference = ['created', 'pending'].includes(activeAttempt?.status)
      ? activeAttempt.referenceId
      : paymentAttempts.find((attempt) => ['created', 'pending'].includes(attempt.status))?.referenceId;

    if (pendingReference) {
      sessionStorage.setItem(ACTIVE_PAYMENT_KEY, pendingReference);
    } else {
      sessionStorage.removeItem(ACTIVE_PAYMENT_KEY);
    }
  }, [activeAttempt, paymentAttempts]);

  useEffect(() => {
    if (!showQRScanner) return undefined;

    qrHandledRef.current = false;
    qrClosingRef.current = false;
    setScannerStatus('Starting camera...');

    const scanner = new Html5Qrcode('upi-qr-reader');
    qrScannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText) => {
        if (qrHandledRef.current) return;

        const parsed = parseUpiQr(decodedText);
        if (!parsed?.payee) {
          setScannerStatus('QR found, but it is not a UPI payment code.');
          return;
        }

        qrHandledRef.current = true;
        setPayee(parsed.payee);
        if (parsed.amount) setAmountStr(parsed.amount);
        if (parsed.note) setNote(parsed.note);
        setShowQR(false);
        setErrorMsg('');
        setScannerStatus('Payment QR scanned.');

        await stopQRScanner();
      },
      () => {}
    ).then(async () => {
      if (qrHandledRef.current || qrScannerRef.current !== scanner) {
        try {
          await scanner.stop();
        } catch {
          // Scanner may have been stopped before startup completed.
        }

        try {
          scanner.clear();
        } catch {
          // Reader may already be gone.
        }
        return;
      }

      setScannerStatus('Point your camera at a UPI QR code.');
    }).catch((error) => {
      if (qrHandledRef.current || qrScannerRef.current !== scanner) return;
      console.error('QR scanner failed:', error);
      setScannerStatus('Camera unavailable. Check browser camera permission.');
    });

    return () => {
      stopQRScanner({ hide: false });
    };
  }, [showQRScanner, stopQRScanner]);



  const handleToggleQR = async () => {
    setShowQR(false);
    setErrorMsg('Payment opens through a UPI intent. Confirm here only after completing it in your UPI app.');
  };

  const handleInitiatePayment = async () => {
    const trimmedPayee = payee.trim();
    if (!/.+@.+/.test(trimmedPayee)) {
      setErrorMsg('Invalid UPI address. Use format: name@bank');
      return;
    }

    const numericAmount = parseFloat(amountStr);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }

    if (Number.isFinite(balance) && balance > 0 && numericAmount > balance) {
      setErrorMsg('Insufficient balance for this payment');
      return;
    }

    setErrorMsg('');
    setIsInitiatingPayment(true);

    try {
      const { data } = await API.post('/payments/intent/initiate', {
        amount: numericAmount,
        note,
        receiverUpi: trimmedPayee,
      });

      const nextAttempt = data.payment;
      upsertAttempt(nextAttempt);
      sessionStorage.setItem(ACTIVE_PAYMENT_KEY, data.referenceId);
      saveContactIfNeeded(trimmedPayee);
      if (nextAttempt.upiLink) {
        window.location.href = nextAttempt.upiLink;
      }
    } catch (error) {
      console.error('Failed to initiate payment', error);
      setErrorMsg(error.response?.data?.message || 'Failed to start UPI payment');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const handleOpenAttempt = () => {
    if (!activeAttempt?.upiLink) {
      setErrorMsg('No UPI link is available for this attempt.');
      return;
    }
    window.location.href = activeAttempt.upiLink;
  };

  const handleConfirmAttempt = async () => {
    if (!activeAttempt?.referenceId) return;

    setErrorMsg('');
    setIsConfirmingPayment(true);

    try {
      const { data } = await API.post(`/payments/intent/${activeAttempt.referenceId}/confirm`, {
        confirmedAt: new Date().toISOString(),
      });
      upsertAttempt(data);
      await handleSettledPayment(data);
    } catch (error) {
      console.error('Failed to confirm UPI intent payment', error);
      setErrorMsg(error.response?.data?.message || 'Failed to confirm payment');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleFailAttempt = async () => {
    if (!activeAttempt?.referenceId) return;

    setErrorMsg('');
    try {
      const { data } = await API.post(`/payments/intent/${activeAttempt.referenceId}/fail`, {
        reason: 'User marked payment failed',
      });
      upsertAttempt(data);
    } catch (error) {
      console.error('Failed to mark UPI intent payment failed', error);
      setErrorMsg(error.response?.data?.message || 'Failed to update payment attempt');
    }
  };

  const handleSaveContact = async () => {
    if (!editorState) return;

    if (!draftUpi || !/.+@.+/.test(draftUpi)) {
      setEditorError('Invalid UPI format');
      return;
    }

    const trimmedUpi = draftUpi.trim();
    const displayName = draftName.trim() || trimmedUpi.split('@')[0];

    try {
      if (editorState.mode === 'add-contact' || editorState.mode === 'edit-contact') {
        const duplicate = savedContacts.find((contact) => (
          contact.upiId === trimmedUpi && contact.upiId !== editorState.originalUpiId
        ));

        if (duplicate) {
          setEditorError('Contact already exists');
          return;
        }

        const nextContacts = editorState.mode === 'add-contact'
          ? [...savedContacts, { name: displayName, upiId: trimmedUpi }]
          : savedContacts.map((contact) => (
            contact.upiId === editorState.originalUpiId
              ? { name: displayName, upiId: trimmedUpi }
              : contact
          ));

        await updateProfile({ savedContacts: nextContacts });
        await fetchProfile();

        if (editorState.originalUpiId && payee === editorState.originalUpiId) {
          setPayee(trimmedUpi);
          setShowQR(false);
        }

        setEditorState(null);
        setDraftUpi('');
        setDraftName('');
        setEditorError('');
        return;
      }

      if (editorState.mode === 'edit-business') {
        setBusinessPrefs((prev) => {
          const nextHiddenIds = (prev.hiddenIds || []).filter((id) => id !== editorState.id);
          return {
            hiddenIds: nextHiddenIds,
            overrides: {
              ...(prev.overrides || {}),
              [editorState.id]: { name: displayName, upiId: trimmedUpi },
            },
          };
        });

        if (payee === editorState.originalUpiId) {
          setPayee(trimmedUpi);
          setShowQR(false);
        }

        setEditorState(null);
        setDraftUpi('');
        setDraftName('');
        setEditorError('');
      }
    } catch (error) {
      console.error('Failed to save quick pay entry', error);
      setEditorError('Failed to save changes');
    }
  };

  const openEditor = (mode, item = null) => {

    if (mode === 'add-contact') {
      setEditorState({ mode });
      setDraftUpi('');
      setDraftName('');
    }

    if (mode === 'edit-contact' && item) {
      setEditorState({ mode, originalUpiId: item.upiId });
      setDraftUpi(item.upiId);
      setDraftName(item.name || '');
    }

    if (mode === 'edit-business' && item) {
      setEditorState({ mode, id: item.id, originalUpiId: item.upiId });
      setDraftUpi(item.upiId);
      setDraftName(item.name || '');
    }

    setEditorError('');
  };

  const closeEditor = () => {
    setEditorState(null);
    setDraftUpi('');
    setDraftName('');
    setEditorError('');
  };

  const handleOpenContextMenu = (event, type, item) => {
    let items = [];
    if (type === 'contact') {
      items = [
        { label: 'Pay Now', icon: Wallet, onClick: () => setPayee(item.upiId) },
        { label: 'Edit Contact', icon: Pencil, onClick: () => { setDraftUpi(item.upiId); setDraftName(item.name); setEditorState({ mode: 'edit-contact', ref: item }); } },
        { divider: true },
        { label: 'Remove Contact', icon: Trash2, danger: true, onClick: () => deleteContact(item.upiId) }
      ];
    } else if (type === 'business') {
      items = [
        { label: 'Pay Now', icon: Wallet, onClick: () => setPayee(item.upiId) },
        { label: 'Edit Business', icon: Pencil, onClick: () => { setDraftUpi(item.upiId); setDraftName(item.name); setEditorState({ mode: 'edit-business', ref: item }); } },
        { divider: true },
        { label: 'Hide Business', icon: EyeOff, danger: true, onClick: () => hideBusiness(item.id) }
      ];
    }
    openMenu(event, items);
  };

  const handleRemoveContact = async (contact) => {

    try {
      await updateProfile({ savedContacts: savedContacts.filter((entry) => entry.upiId !== contact.upiId) });
      await fetchProfile();

      if (payee === contact.upiId) {
        setPayee('');
        setShowQR(false);
      }
    } catch (error) {
      console.error('Failed to remove contact', error);
      setErrorMsg('Failed to remove contact');
    }
  };

  const handleRemoveBusiness = (business) => {
    setBusinessPrefs((prev) => ({
      hiddenIds: Array.from(new Set([...(prev.hiddenIds || []), business.id])),
      overrides: prev.overrides || {},
    }));

    if (payee === business.upiId) {
      setPayee('');
      setShowQR(false);
    }
  };

  const handleShowMore = (type, item) => {
    setDetailsItem({ ...item, type });
  };

  const handleRecentAttemptClick = (attempt) => {
    setActiveReferenceId(attempt.referenceId);
    const linkedTransaction = findLinkedTransaction(attempt);
    if (linkedTransaction) {
      setSelectedTransaction(linkedTransaction);
    }
  };

  const activeAttemptStatus = getAttemptStatusMeta(activeAttempt?.status);

  return (
    <div className="max-w-6xl mx-auto flex flex-col pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 flex flex-col bg-[#0a0a0c] border border-zinc-800/80 rounded-3xl p-6 md:p-8 relative shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="w-full relative z-10 mb-8 flex items-center">
            <span className="absolute left-4 text-zinc-400 font-bold">@</span>
            <input
              type="text"
              placeholder="Enter UPI ID or Number"
              value={payee}
              onChange={(event) => {
                setPayee(event.target.value);
                setShowQR(false);
              }}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-10 pr-20 lg:pr-12 py-3.5 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500/50 transition"
            />
            <button
              onClick={() => setShowQRScanner(true)}
              className="absolute right-11 lg:hidden p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition"
              title="Scan UPI QR"
              aria-label="Scan UPI QR"
            >
              <Camera size={18} />
            </button>
            <button
              onClick={handleToggleQR}
              className="absolute right-3 p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition"
              title="UPI payment info"
            >
              <Info size={18} />
            </button>
          </div>

          {errorMsg && (
            <div className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl animate-[fadeIn_0.3s_ease-out] text-center">
              {errorMsg}
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center w-full z-10 my-8">
            <div className="relative w-full max-w-[280px] mx-auto mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-zinc-400">Rs</span>
              <input
                type="number"
                inputMode="decimal"
                value={amountStr === '0' ? '' : amountStr}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.includes('.')) {
                    const parts = val.split('.');
                    if (parts[1].length > 2) val = `${parts[0]}.${parts[1].slice(0, 2)}`;
                  }
                  setAmountStr(val || '0');
                }}
                placeholder="0"
                className="w-full bg-transparent border-none text-[56px] font-bold text-zinc-100 tracking-tight leading-none text-center focus:outline-none pl-12 pr-4 placeholder-zinc-800"
              />
            </div>

            <input
              type="text"
              placeholder="Add a note (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-center text-zinc-300 text-sm w-full max-w-[280px] focus:outline-none focus:border-emerald-500/50 placeholder-zinc-600 mb-8 transition"
            />

            <p className="text-center text-xs text-zinc-500 mb-2 max-w-[280px] leading-relaxed px-4">
              UPI handoff opens your payment app. A ledger entry is created only after you confirm completion here.
            </p>
          </div>

          <button
            onClick={handleInitiatePayment}
            disabled={isInitiatingPayment}
            className="w-full bg-[#0d5942] hover:bg-[#0f6b4f] disabled:opacity-60 disabled:cursor-not-allowed text-emerald-50 font-medium py-4 rounded-full shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-lg z-10"
          >
            {isInitiatingPayment ? (
              <>
                <div className="w-5 h-5 border-2 border-emerald-50/30 border-t-emerald-50 rounded-full animate-spin" />
                Opening UPI
              </>
            ) : (
              <>
                Pay via UPI <Shield size={18} className="opacity-80" />
              </>
            )}
          </button>

          {activeAttempt && (
            <div className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 z-10 animate-[fadeIn_0.25s_ease-out]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">UPI Intent</p>
                  <h4 className="text-sm font-semibold text-zinc-100 mt-1 truncate">{activeAttempt.receiverUpi}</h4>
                  <p className="text-xs text-zinc-500 mt-1 break-all">{activeAttempt.referenceId}</p>
                </div>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap ${activeAttemptStatus.chipClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${activeAttemptStatus.dotClass}`} />
                  {activeAttemptStatus.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Amount</p>
                  <p className="text-sm font-semibold text-zinc-100 mt-1">Rs {parseFloat(activeAttempt.amount || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Started</p>
                  <p className="text-sm font-semibold text-zinc-100 mt-1">{formatAttemptDate(activeAttempt.createdAt)}</p>
                </div>
              </div>

              {activeAttempt.note && (
                <p className="mt-3 text-xs text-zinc-400">Note: {activeAttempt.note}</p>
              )}

              <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
                {getPaymentStatusCopy(activeAttempt)}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                {['created', 'pending', 'initiated'].includes(activeAttempt.status) && activeAttempt.canResume && (
                  <button
                    onClick={handleOpenAttempt}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition"
                  >
                    Open UPI App
                  </button>
                )}
                {['created', 'pending', 'initiated'].includes(activeAttempt.status) && (
                  <button
                    onClick={handleConfirmAttempt}
                    disabled={isConfirmingPayment}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-sm font-medium transition"
                  >
                    {isConfirmingPayment ? 'Saving...' : 'I Completed Payment'}
                  </button>
                )}
                {['created', 'pending', 'initiated'].includes(activeAttempt.status) && (
                  <button
                    onClick={handleFailAttempt}
                    className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm border border-red-500/20 transition"
                  >
                    Mark Failed
                  </button>
                )}
                {activeAttempt.status === 'success' && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20">
                    <CheckCircle2 size={15} /> Added as unverified
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 flex flex-col space-y-6">
          <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-sm font-semibold text-zinc-200">People</h4>
                <button
                  onClick={() => {
                    setContactSearch('');
                    setShowAllContacts(true);
                  }}
                  className="text-xs font-medium text-emerald-500 hover:text-emerald-400"
                >
                  View All
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {topContacts.length > 0 ? (
                  topContacts.map((contact, index) => (
                    <div key={index} {...bindContextMenu([{ label: 'Pay Now', icon: Wallet, onClick: () => setPayee(contact.upiId) }, { label: 'More Info', icon: Info, onClick: () => handleShowMore('contact', contact) }, { label: 'Edit Contact', icon: Pencil, onClick: () => { setDraftUpi(contact.upiId); setDraftName(contact.name); setEditorState({ mode: 'edit-contact', ref: contact }); } }, { divider: true }, { label: 'Remove', icon: Trash2, danger: true, onClick: () => handleRemoveContact(contact) }])}>
                      <ContactBubble
                        name={contact.name}
                        upiId={contact.upiId}
                        onClick={() => setPayee(contact.upiId)}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-600 py-4 text-center w-full border border-dashed border-zinc-800 rounded-xl">No saved contacts</div>
                )}
                <button
                  onClick={() => openEditor('add-contact')}
                  className="flex flex-col items-center gap-2 group min-w-[64px]"
                >
                  <div className="w-14 h-14 rounded-full border border-zinc-800 border-dashed flex items-center justify-center text-zinc-500 group-hover:text-emerald-400 group-hover:border-emerald-500/50 transition-colors bg-zinc-900/50">
                    <PlusCircle size={20} />
                  </div>
                  <span className="text-[11px] text-zinc-500">Add</span>
                </button>
              </div>
            </div>

            <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-sm font-semibold text-zinc-200">Businesses</h4>
                <button
                  onClick={() => {
                    setBusinessSearch('');
                    setShowAllBusinesses(true);
                  }}
                  className="text-xs font-medium text-emerald-500 hover:text-emerald-400"
                >
                  Explore
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {previewBusinesses.length > 0 ? (
                  previewBusinesses.map((business, index) => (
                    <div key={index} {...bindContextMenu([{ label: 'Pay Now', icon: Wallet, onClick: () => setPayee(business.upiId) }, { label: 'More Info', icon: Info, onClick: () => handleShowMore('business', business) }, { label: 'Edit Business', icon: Pencil, onClick: () => { setDraftUpi(business.upiId); setDraftName(business.name); setEditorState({ mode: 'edit-business', ref: business }); } }, { divider: true }, { label: 'Hide', icon: EyeOff, danger: true, onClick: () => handleRemoveBusiness(business) }])}>
                      <ContactBubble
                        name={business.name}
                        upiId={business.upiId}
                        type="business"
                        onClick={() => setPayee(business.upiId)}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-600 py-4 text-center w-full border border-dashed border-zinc-800 rounded-xl">No recent merchants</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h4 className="text-sm font-semibold text-zinc-200">Recent Activity</h4>
              <button className="p-1.5 hover:bg-zinc-800 rounded-md transition text-zinc-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
              </button>
            </div>

            {isLoadingAttempts ? (
              <div className="flex flex-1 items-center justify-center py-10 text-zinc-500 text-sm gap-3">
                <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                Loading payment attempts...
              </div>
            ) : recentAttempts.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm flex-1 flex items-center justify-center">
                No recent activity.
              </div>
            ) : (
              <div className="pr-2 space-y-4 pb-4">
                {recentAttempts.map((attempt) => {
                  const statusMeta = getAttemptStatusMeta(attempt.status);
                  return (
                    <button
                      key={attempt.referenceId}
                      onClick={() => handleRecentAttemptClick(attempt)}
                      className={`w-full flex items-center justify-between group rounded-2xl border px-3 py-3 text-left transition ${activeAttempt?.referenceId === attempt.referenceId ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-transparent hover:border-zinc-800 hover:bg-zinc-900/60'}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-300 font-bold text-sm">
                          {(attempt.receiverUpi || '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">{attempt.receiverUpi}</p>
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                            {formatAttemptDate(attempt.createdAt)} · {attempt.referenceId}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-sm font-medium text-zinc-200">
                          -Rs {parseFloat(attempt.amount || 0).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-medium flex items-center gap-1 px-2 py-1 rounded-full border ${statusMeta.chipClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                          {statusMeta.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => navigate('/ledger')}
              className="w-full mt-6 py-3.5 border border-zinc-800 rounded-2xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
            >
              View All Transactions
            </button>
          </div>
        </div>
      </div>

      {showQRScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-5 w-full max-w-md shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Camera size={20} className="text-emerald-500" /> Scan UPI QR
              </h3>
              <button onClick={() => stopQRScanner()} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
              <div id="upi-qr-reader" className="w-full min-h-[300px]" />
            </div>
            <p className="text-center text-xs text-zinc-500 mt-4">{scannerStatus}</p>
          </div>
        </div>
      )}

      {editorState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                {editorState.mode === 'edit-business'
                  ? <ShoppingBag size={20} className="text-emerald-500" />
                  : <User size={20} className="text-emerald-500" />}
                {' '}
                {editorTitle}
              </h3>
              <button onClick={closeEditor} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">UPI ID</label>
                <input
                  type="text"
                  placeholder="e.g. name@bank"
                  value={draftUpi}
                  onChange={(event) => {
                    setDraftUpi(event.target.value);
                    setEditorError('');
                  }}
                  className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder={editorState.mode === 'edit-business' ? 'e.g. Grocery Hub' : 'e.g. John Doe'}
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value);
                    setEditorError('');
                  }}
                  className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {editorError && <p className="text-xs text-red-400">{editorError}</p>}

              <button
                onClick={handleSaveContact}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl transition-colors mt-2"
              >
                {editorState.mode === 'add-contact' ? 'Save Contact' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAllContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <User size={20} className="text-emerald-500" /> All Saved Contacts
              </h3>
              <button onClick={() => setShowAllContacts(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search by name or UPI ID"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {savedContacts.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">No contacts saved yet.</div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">No contacts match that search.</div>
              ) : (
                filteredContacts.map((contact, index) => (
                  <button
                    key={index}
                    {...bindContextMenu([{ label: 'Pay Now', icon: Wallet, onClick: () => setPayee(contact.upiId) }, { label: 'More Info', icon: Info, onClick: () => handleShowMore('contact', contact) }, { label: 'Edit Contact', icon: Pencil, onClick: () => { setDraftUpi(contact.upiId); setDraftName(contact.name); setEditorState({ mode: 'edit-contact', ref: contact }); } }, { divider: true }, { label: 'Remove', icon: Trash2, danger: true, onClick: () => handleRemoveContact(contact) }])}
                    onClick={() => {
                      setPayee(contact.upiId);
                      setShowAllContacts(false);
                    }}
                    className="w-full flex items-center gap-4 p-3 hover:bg-zinc-900 rounded-2xl transition group border border-transparent hover:border-zinc-800/50 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition">
                      {getEntityInitials(contact.name)}
                    </div>
                    <div>
                      <p className="text-zinc-200 font-medium">{contact.name}</p>
                      <p className="text-zinc-500 text-xs">{contact.upiId}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showAllBusinesses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <ShoppingBag size={20} className="text-emerald-500" /> Recent Businesses
              </h3>
              <button onClick={() => setShowAllBusinesses(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={businessSearch}
                onChange={(event) => setBusinessSearch(event.target.value)}
                placeholder="Search by name or UPI ID"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {businesses.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">No recent merchants found.</div>
              ) : filteredBusinesses.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">No businesses match that search.</div>
              ) : (
                filteredBusinesses.map((business, index) => {
                  const upiId = business.upiId;
                  return (
                    <button
                      key={index}
                      {...bindContextMenu([{ label: 'Pay Now', icon: Wallet, onClick: () => setPayee(upiId) }, { label: 'More Info', icon: Info, onClick: () => handleShowMore('business', business) }, { label: 'Edit Business', icon: Pencil, onClick: () => { setDraftUpi(upiId); setDraftName(business.name); setEditorState({ mode: 'edit-business', ref: business }); } }, { divider: true }, { label: 'Hide', icon: EyeOff, danger: true, onClick: () => handleRemoveBusiness(business) }])}
                      onClick={() => {
                        setPayee(upiId);
                        setShowAllBusinesses(false);
                      }}
                      className="w-full flex items-center gap-4 p-3 hover:bg-zinc-900 rounded-2xl transition group border border-transparent hover:border-zinc-800/50 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition">
                        <ShoppingBag size={16} className="text-zinc-400 group-hover:text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-zinc-200 font-medium">{business.name}</p>
                        <p className="text-zinc-500 text-xs">{upiId}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {detailsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                {detailsItem.type === 'business'
                  ? <ShoppingBag size={20} className="text-emerald-500" />
                  : <User size={20} className="text-emerald-500" />}
                More Options
              </h3>
              <button onClick={() => setDetailsItem(null)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  {detailsItem.type === 'business' ? 'Business' : 'Person'}
                </p>
                <p className="text-lg font-semibold text-zinc-100">{detailsItem.name}</p>
                <p className="text-sm text-zinc-500 mt-1 break-all">{detailsItem.upiId}</p>
                {detailsItem.sourceName && detailsItem.sourceName !== detailsItem.name && (
                  <p className="text-xs text-zinc-600 mt-3">Recent name: {detailsItem.sourceName}</p>
                )}
              </div>

              <button
                onClick={() => {
                  setPayee(detailsItem.upiId);
                  setShowQR(false);
                  setDetailsItem(null);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl transition-colors"
              >
                Use in Quick Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onUpdate={onUpdate}
        />
      )}



      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
