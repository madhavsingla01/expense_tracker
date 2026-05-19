import axios from 'axios';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:5000`;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${SERVER_URL}/api`;
export const PAYMENT_WS_URL = API_BASE_URL
  .replace(/^http/i, 'ws')
  .replace(/\/api$/, '/ws/payments');

const API = axios.create({
  baseURL: API_BASE_URL,
});

// Attach JWT token to every request if available
API.interceptors.request.use((config) => {
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    try {
      const { token } = JSON.parse(userInfo);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      localStorage.removeItem('userInfo');
    }
  }
  return config;
});

// Auto-logout on 401 - prevent infinite redirect loops
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if not already on /login to break the loop
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('userInfo');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default API;
