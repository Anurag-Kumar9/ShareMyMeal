/**
 * ShareMyMeal — API Service
 * ============================
 * Axios-based HTTP client for the FastAPI backend.
 * Updated for wallet-based payment system (no Razorpay).
 */

import axios from 'axios';
import { auth } from '../config/firebase';

// Base URL — update to your machine's IP for physical device testing
const API_BASE_URL = 'http://192.168.0.105:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Firebase ID token to every request
api.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Failed to get auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const message = error.response.data?.detail || 'Something went wrong';
      console.error(`API Error [${error.response.status}]:`, message);
      return Promise.reject(new Error(message));
    } else if (error.request) {
      console.error('Network Error: No response from server');
      return Promise.reject(new Error('Network error. Please check your connection.'));
    } else {
      return Promise.reject(error);
    }
  }
);

// ── Auth & Profile APIs ────────────────────────────────────
export const authAPI = {
  verifyToken: () => api.post('/api/auth/verify-token'),
  createProfile: (data) => api.post('/api/auth/profile', data),
  getProfile: (uid) => api.get(`/api/auth/profile/${uid}`),
  updateProfile: (uid, data) => api.put(`/api/auth/profile/${uid}`, data),
  initiateKYC: (data) => api.post('/api/auth/kyc/initiate', data),
  verifyKYC: (data) => api.post('/api/auth/kyc/verify', data),
  getKYCStatus: (uid) => api.get(`/api/auth/kyc/status/${uid}`),
};

// ── Listing APIs ───────────────────────────────────────────
export const listingsAPI = {
  create: (data) => api.post('/api/listings/', data),
  getNearby: (lat, lng, radius = 5.0) =>
    api.get(`/api/listings/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radius}`),
  getById: (id) => api.get(`/api/listings/${id}`),
  update: (id, data) => api.put(`/api/listings/${id}`, data),
  delete: (id) => api.delete(`/api/listings/${id}`),
  getByOwner: (uid) => api.get(`/api/listings/seller/${uid}`),
};

// ── Order APIs ─────────────────────────────────────────────
export const ordersAPI = {
  create: (data) => api.post('/api/orders/', data),
  getById: (id) => api.get(`/api/orders/${id}`),
  updateStatus: (id, data) => api.put(`/api/orders/${id}/status`, data),
  confirmPickup: (id, data) => api.post(`/api/orders/${id}/confirm-pickup`, data),
  getBuyerOrders: (uid) => api.get(`/api/orders/buyer/${uid}`),
  getSellerOrders: (uid) => api.get(`/api/orders/seller/${uid}`),
};

// ── Wallet Payment APIs ────────────────────────────────────
export const paymentsAPI = {
  // Prepaid UPI — pay at order time
  processPayment: (data) => api.post('/api/payments/process', data),
  // UPI on Delivery — seller scans buyer QR at pickup
  scanQRPayment: (data) => api.post('/api/payments/scan-qr', data),
  // Release held funds to seller after pickup
  releasePayout: (orderId, data) => api.post(`/api/payments/payout/${orderId}`, data),
  // Refund buyer for cancelled order
  refund: (orderId, data) => api.post(`/api/payments/refund/${orderId}`, data),
  // Check wallet balance
  getBalance: (uid) => api.get(`/api/payments/balance/${uid}`),
  // Transaction history
  getTransactions: (uid, limit = 20) => api.get(`/api/payments/transactions/${uid}?limit=${limit}`),
};

// ── Rating APIs ────────────────────────────────────────────
export const ratingsAPI = {
  submit: (data) => api.post('/api/ratings/', data),
  getSellerRatings: (uid) => api.get(`/api/ratings/seller/${uid}`),
};

// ── Notification APIs ──────────────────────────────────────
export const notificationsAPI = {
  send: (data) => api.post('/api/notifications/send', data),
};

export default api;
