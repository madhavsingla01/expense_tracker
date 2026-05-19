import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import {
  User, Mail, Phone, DollarSign, Tag, X, Shield,
  CheckCircle2, Save, Lock, Smartphone, AlertCircle, ChevronDown, Plus, Star, Trash2, AlertTriangle, Camera, Upload, LogOut, MessageSquare,
  MapPin, Globe, Briefcase, Calendar, FileText
} from 'lucide-react';
import API from '../config/api';
import Avatar from '../components/ui/Avatar';
import DeleteAccountModal from '../components/ui/DeleteAccountModal';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];

const UPI_PROVIDERS = ['Google Pay', 'PhonePe', 'Paytm', 'Amazon Pay', 'BHIM', 'Other'];

export default function ProfilePage() {
  const { user, updateProfile, uploadAvatar, fetchProfile, getSessions, revokeSession, logout } = useAuth();
  const { preferredCurrency, changeCurrency } = useCurrency();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [categories, setCategories] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [savedContacts, setSavedContacts] = useState([]);

  // Extended profile fields
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [timezone, setTimezone] = useState('');

  const [newCategory, setNewCategory] = useState('');
  const [newUpiId, setNewUpiId] = useState('');
  const [newProvider, setNewProvider] = useState('Google Pay');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); 
  const [passwordStatus, setPasswordStatus] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setCurrency(preferredCurrency || 'USD');
      setCategories(user.spendingCategories || []);
      setLinkedAccounts(user.linkedAccounts || []);
      setSavedContacts(user.savedContacts || []);
      setSessions(user.security?.activeSessions || []);
      setLoginHistory(user.security?.recentLoginHistory || []);
      if (!avatarFile) setAvatarPreview(user.avatar || '');
      // Extended profile fields
      setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
      setGender(user.gender || '');
      setBio(user.bio || '');
      setOccupation(user.occupation || '');
      setStreet(user.address?.street || '');
      setCity(user.address?.city || '');
      setAddrState(user.address?.state || '');
      setCountry(user.address?.country || '');
      setPostalCode(user.address?.postalCode || '');
      setPreferredLanguage(user.preferredLanguage || 'en');
      setTimezone(user.timezone || '');
    }
  }, [user, avatarFile]);

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const loadSecurity = async () => {
    if (!getSessions) return;
    try {
      const data = await getSessions();
      setSessions(data.activeSessions || []);
      setLoginHistory(data.recentLoginHistory || []);
    } catch (err) {
      console.error('Failed to load security sessions', err);
    }
  };

  useEffect(() => {
    if (user?.token) loadSecurity();
  }, [user?.token]);

  const prepareAvatarFile = (file) => new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxSize = 1024;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          resolve(blob ? new File([blob], 'profile-avatar.webp', { type: 'image/webp' }) : file);
        },
        'image/webp',
        0.82
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    image.src = objectUrl;
  });

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarStatus('Please choose a jpeg, png, or webp image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarStatus('Profile image must be 5 MB or smaller.');
      return;
    }

    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarStatus('');
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !uploadAvatar) return;
    setAvatarSaving(true);
    setAvatarStatus('');
    try {
      const optimizedFile = await prepareAvatarFile(avatarFile);
      await uploadAvatar(optimizedFile);
      setAvatarFile(null);
      setAvatarStatus('Profile picture updated successfully.');
      setTimeout(() => setAvatarStatus(''), 3000);
    } catch (err) {
      setAvatarStatus(err.response?.data?.message || err.message || 'Failed to update profile picture.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const cancelAvatarPreview = () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(user?.avatar || '');
    setAvatarStatus('');
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      await updateProfile({
        name, phone, preferredCurrency: currency,
        spendingCategories: categories, savedContacts,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        bio, occupation,
        address: { street, city, state: addrState, country, postalCode },
        preferredLanguage, timezone,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus('error');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordStatus('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordStatus('Passwords do not match'); return; }
    try {
      await updateProfile({ password: newPassword });
      setNewPassword(''); setConfirmPassword('');
      setPasswordStatus('Password updated successfully!');
      setTimeout(() => setPasswordStatus(''), 3000);
    } catch {
      setPasswordStatus('Failed to update password');
    }
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
    }
    setNewCategory('');
  };

  const addLinkedAccount = async () => {
    const trimmed = newUpiId.trim();
    if (trimmed && !linkedAccounts.find(a => a.upiId === trimmed)) {
      try {
        await API.post('/accounts', { provider: newProvider, upiId: trimmed });
        await fetchProfile();
        setNewUpiId('');
      } catch (err) {
        console.error('Failed to add account', err);
      }
    }
  };

  const removeLinkedAccount = async (id) => {
    try {
      await API.delete(`/accounts/${id}`);
      await fetchProfile();
    } catch (err) {
      console.error('Failed to remove account', err);
    }
  };

  const setDefaultAccount = async (id) => {
    try {
      await API.put(`/accounts/${id}/default`);
      await fetchProfile();
    } catch (err) {
      console.error('Failed to set default account', err);
    }
  };

  const removeContact = (upiId) => {
    setSavedContacts(savedContacts.filter(c => c.upiId !== upiId));
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '';

  const openDeleteModal = () => setShowDeleteModal(true);

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSession(sessionId);
      await loadSecurity();
    } catch (err) {
      console.error('Failed to revoke session', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 w-full">
      {/* Profile Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 relative z-10">
          <div className="relative w-max">
            <Avatar src={avatarPreview || user?.avatar} name={name} email={user?.email} size="xl" />
            {avatarSaving && (
              <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarSaving}
              className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 flex items-center justify-center shadow-lg transition disabled:opacity-60"
              aria-label="Choose profile picture"
            >
              <Camera size={18} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-zinc-100 truncate">{name || 'Your Name'}</h2>
            <p className="text-zinc-500 text-sm">{user?.email}</p>
            {memberSince && <p className="text-zinc-600 text-xs mt-1">Member since {memberSince}</p>}
            {avatarFile && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={avatarSaving}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  {avatarSaving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Upload size={16} />}
                  Save photo
                </button>
                <button
                  type="button"
                  onClick={cancelAvatarPreview}
                  disabled={avatarSaving}
                  className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
            {avatarStatus && (
              <p className={`mt-3 text-sm ${avatarStatus.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
                {avatarStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <User size={20} className="text-indigo-400" /> Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Full Name</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Email <span className="text-zinc-700">(read-only)</span></label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input type="email" value={user?.email || ''} readOnly
                className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-xl pl-11 pr-4 py-3 text-zinc-500 cursor-not-allowed" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Phone Number</label>
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Preferred Currency</label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <select value={currency} onChange={(e) => {
                setCurrency(e.target.value);
                changeCurrency(e.target.value);
              }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-10 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* About You */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <FileText size={20} className="text-indigo-400" /> About You
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Bio / Financial Goals</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write a short bio or your financial goals..." rows="3"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition resize-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Date of Birth</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 transition [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Gender</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <select value={gender} onChange={(e) => setGender(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-10 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Occupation</label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Software Engineer"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Preferred Language</label>
            <div className="relative">
              <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-10 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="hi">हिन्दी</option>
                <option value="ja">日本語</option>
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <MapPin size={20} className="text-indigo-400" /> Location
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Street Address</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">State / Province</label>
            <input type="text" value={addrState} onChange={(e) => setAddrState(e.target.value)} placeholder="State"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Country</label>
            <div className="relative">
              <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Postal Code</label>
            <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal Code"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
          </div>
        </div>
      </div>

      {/* Linked UPI Accounts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <Smartphone size={20} className="text-emerald-400" /> Linked UPI Accounts
        </h3>
        
        <div className="space-y-3 mb-6">
          {linkedAccounts.length === 0 ? (
            <p className="text-sm text-zinc-500">No UPI accounts linked yet.</p>
          ) : (
            linkedAccounts.map((account) => (
              <div key={account._id || account.upiId || Math.random()} className={`flex items-center justify-between p-4 rounded-xl border ${account.isDefault ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-zinc-950/50 border-zinc-800'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                    <Smartphone size={16} className={account.isDefault ? 'text-emerald-400' : 'text-zinc-500'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200">{account.provider}</p>
                      {account.isDefault && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold uppercase tracking-wider">Default</span>}
                    </div>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{account.upiId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!account.isDefault && (
                    <button onClick={() => setDefaultAccount(account._id)} className="p-2 text-zinc-500 hover:text-emerald-400 transition" title="Set as Default">
                      <Star size={18} />
                    </button>
                  )}
                  <button onClick={() => removeLinkedAccount(account._id)} className="p-2 text-zinc-500 hover:text-red-400 transition" title="Remove Account">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-shrink-0 md:w-48">
            <select value={newProvider} onChange={(e) => setNewProvider(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer text-sm">
              {UPI_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          <div className="relative flex-1">
            <input type="text" value={newUpiId} onChange={(e) => setNewUpiId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLinkedAccount(); } }}
              placeholder="name@bankupi"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-zinc-100 font-mono text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition" />
            <button onClick={addLinkedAccount} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Saved Contacts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <User size={20} className="text-blue-400" /> Saved Contacts
        </h3>
        {savedContacts.length === 0 ? (
          <p className="text-sm text-zinc-500">No saved contacts. You can save contacts from the UPI Pay page.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedContacts.map((contact, idx) => (
              <div key={`${contact.upiId}-${idx}`} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-zinc-200 truncate">{contact.name}</p>
                  <p className="text-xs font-mono text-zinc-500 truncate">{contact.upiId}</p>
                </div>
                <button onClick={() => removeContact(contact.upiId)} className="text-zinc-600 hover:text-red-400 transition p-2">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spending Categories */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <Tag size={20} className="text-fuchsia-400" /> Spending Categories
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-300 hover:border-red-500/30 transition group">
              <Tag size={12} className="text-indigo-400" />
              {cat}
              <button type="button" onClick={() => setCategories(categories.filter((c) => c !== cat))} className="text-zinc-600 group-hover:text-red-400 transition ml-1">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-3">
          <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
            placeholder="Add new category..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition" />
          <button onClick={addCategory} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition font-medium">
            Add
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <Shield size={20} className="text-amber-400" /> Security
        </h3>

        <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 mb-6">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-zinc-500" />
            <div>
              <p className="text-sm font-medium text-zinc-300">Two-Factor Authentication</p>
              <p className="text-xs text-zinc-600">Add an extra layer of security</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700">
            Coming Soon
          </span>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-zinc-400">Change Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition" />
            </div>
          </div>
          {passwordStatus && (
            <p className={`text-sm pl-1 ${passwordStatus.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
              {passwordStatus}
            </p>
          )}
          <button onClick={handleChangePassword} className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition text-sm font-medium">
            Update Password
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <Smartphone size={20} className="text-blue-400" /> Devices & Login History
        </h3>
        <div className="space-y-3 mb-6">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No active sessions found.</p>
          ) : sessions.map((session) => (
            <div key={session.sessionId} className="flex items-center justify-between gap-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{session.deviceName || 'Unknown device'}</p>
                <p className="text-xs text-zinc-500 mt-1">{session.ipAddress || 'Unknown IP'} · Last seen {session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : 'now'}</p>
                {session.suspicious && <p className="text-xs text-amber-400 mt-1">Marked as suspicious</p>}
              </div>
              <button onClick={() => handleRevokeSession(session.sessionId)} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-300 border border-zinc-700 hover:border-red-500/30 text-xs font-semibold transition">
                Revoke
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {loginHistory.slice(0, 5).map((entry, index) => (
            <div key={`${entry.createdAt}-${index}`} className="flex items-center justify-between gap-3 text-xs border-b border-zinc-800/60 py-2 last:border-0">
              <span className={entry.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>{entry.status}</span>
              <span className="text-zinc-500 truncate">{entry.deviceName || entry.browser || 'Unknown device'}</span>
              <span className="text-zinc-600">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Account Actions & Bento Grid */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">Account Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Save Changes (Spans 2 columns) */}
          <div className="col-span-2 md:col-span-2 relative group h-full">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 disabled:opacity-50 rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98]"
            >
              {saving ? (
                <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
              ) : (
                <Save size={32} className="group-hover:scale-110 transition-transform" />
              )}
              <div className="text-center">
                <span className="font-bold text-lg block text-indigo-300">Save Changes</span>
                <span className="text-xs text-indigo-500/70">Update your profile info</span>
              </div>
            </button>
            
            {/* Absolute positioning for status messages inside the button area */}
            <div className="absolute top-3 right-4 pointer-events-none">
              {saveStatus === 'success' && (
                <span className="text-emerald-400 text-xs flex items-center gap-1 animate-[fadeIn_0.3s_ease-out] bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">
                  <CheckCircle2 size={12} /> Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400 text-xs flex items-center gap-1 animate-[fadeIn_0.3s_ease-out] bg-red-400/10 px-2 py-1 rounded-md border border-red-400/20">
                  <AlertCircle size={12} /> Failed
                </span>
              )}
            </div>
          </div>

          {/* Feedback Button */}
          <button
            type="button"
            onClick={() => navigate('/feedback')}
            className="col-span-1 flex flex-col items-center justify-center gap-3 p-6 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-2xl transition-all active:scale-[0.98] group"
          >
            <MessageSquare size={28} className="text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-sm">Feedback</span>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => { logout(); navigate('/login'); }}
            className="col-span-1 flex flex-col items-center justify-center gap-3 p-6 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-2xl transition-all active:scale-[0.98] group"
          >
            <LogOut size={28} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-sm">Logout</span>
          </button>

          {/* Delete Account (Spans full width) */}
          <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-red-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 group hover:border-red-500/30 transition-colors">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-400">Danger Zone</h3>
                <p className="text-xs text-zinc-500">Once you delete your account, all data will be permanently removed.</p>
              </div>
            </div>
            <button
              onClick={openDeleteModal}
              className="w-full sm:w-auto shrink-0 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold rounded-xl transition-all active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2"><Trash2 size={16} /> Delete My Account</span>
            </button>
          </div>
        </div>
      </div>

      <DeleteAccountModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  );
}
