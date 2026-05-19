import React, { createContext, useState, useContext, useEffect } from 'react';
import API from '../config/api';
import { setPreferredCurrency } from '../utils/format';

const AuthContext = createContext(null);
const AUTH_SYNC_KEY = 'bagels.auth.sync';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = (nextUser, broadcast = true) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem('userInfo', JSON.stringify(nextUser));
      setPreferredCurrency(nextUser.preferredCurrency);
    } else {
      localStorage.removeItem('userInfo');
      localStorage.removeItem('preferredCurrency');
    }
    if (broadcast) {
      localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ at: Date.now(), hasUser: Boolean(nextUser) }));
    }
  };

  // On mount, restore session from localStorage and fetch fresh profile from server
  useEffect(() => {
    const restore = async () => {
      const stored = localStorage.getItem('userInfo');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          persistUser(parsed, false); // Set immediately for fast UI

          // Fetch fresh profile from server to get latest MongoDB data
          if (parsed.token) {
            try {
              const { data } = await API.get('/auth/profile');
              const merged = { ...data, token: parsed.token };
              persistUser(merged, false);
            } catch {
              // If token is invalid, keep localStorage version (login will handle re-auth)
            }
          }
        } catch {
          localStorage.removeItem('userInfo');
        }
      }
      setLoading(false);
    };
    restore();
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== AUTH_SYNC_KEY && event.key !== 'userInfo') return;
      const stored = localStorage.getItem('userInfo');
      if (!stored) {
        persistUser(null, false);
        return;
      }
      try {
        persistUser(JSON.parse(stored), false);
      } catch {
        persistUser(null, false);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    persistUser(data);
    return data;
  };

  const register = async (formData) => {
    const { data } = await API.post('/auth/register', formData);
    persistUser(data);
    return data;
  };

  const updateProfile = async (updates) => {
    const { data } = await API.put('/auth/profile', updates);
    const merged = { ...data, token: user?.token };
    persistUser(merged);
    return merged;
  };

  const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await API.post('/auth/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const merged = { ...data, token: user?.token };
    persistUser(merged);
    return merged;
  };

  const logout = () => {
    API.post('/auth/logout').catch(() => {});
    persistUser(null);
  };

  const getDeletionPreview = async () => {
    const { data } = await API.get('/auth/delete-preview');
    return data;
  };

  const deleteAccount = async (password, confirmText) => {
    const { data } = await API.post('/auth/delete-account', { password, confirmText });
    // Clear all app-specific localStorage keys
    localStorage.removeItem('bagels.dateRange.prefs');
    localStorage.removeItem('bagels.transactions.sync');
    logout();
    return data;
  };

  const fetchProfile = async () => {
    try {
      const { data } = await API.get('/auth/profile');
      if (user && user.token) {
        const merged = { ...data, token: user.token };
        persistUser(merged);
        return merged;
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch profile', err);
      return null;
    }
  };

  const getSessions = async () => {
    const { data } = await API.get('/auth/sessions');
    return data;
  };

  const revokeSession = async (sessionId) => {
    const { data } = await API.delete(`/auth/sessions/${sessionId}`);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, uploadAvatar, fetchProfile, logout, deleteAccount, getDeletionPreview, getSessions, revokeSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
