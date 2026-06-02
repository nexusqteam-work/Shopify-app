import axios from 'axios';
import { API_URL } from '../config/env';

const api: any = axios.create({ baseURL: API_URL, 
  withCredentials: true });

api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('sc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res: any) => res.data,
  (err: any) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sc_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authApi = {
  getMe: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

export const auditApi = {
  run:       () => api.post('/api/audits/run'),
  getLatest: () => api.get('/api/audits/latest'),
  getStatus: (id: string) => api.get(`/api/audits/${id}/status`),
  getAll:    () => api.get('/api/audits'),
};

export const issuesApi = {
  getAll:  (params?: object) => api.get('/api/issues', { params }),
  fix:     (id: string, note?: string) => 
    api.patch(`/api/issues/${id}/fix`, { note }),
  unfix:   (id: string) => 
    api.patch(`/api/issues/${id}/unfix`),
  summary: () => api.get('/api/issues/summary/stats'),
};

export const chatApi = {
  send:       (message: string, sessionId?: string) => 
    api.post('/api/chat/message', { message, sessionId }),
  getSessions: () => api.get('/api/chat/sessions'),
  getHistory:  (sessionId: string) => 
    api.get(`/api/chat/history/${sessionId}`),
  getUsage:    () => api.get('/api/chat/usage'),
};

export const metricsApi = {
  getSummary: (days?: number) => 
    api.get('/api/metrics/summary', { params: { days } }),
  getDaily:   (days?: number) => 
    api.get('/api/metrics/daily', { params: { days } }),
  sync:       () => api.post('/api/metrics/sync'),
};

export const competitorsApi = {
  getAll:   () => api.get('/api/competitors'),
  add:      (data: object) => api.post('/api/competitors', data),
  remove:   (id: string) => api.delete(`/api/competitors/${id}`),
  refresh:  (id: string) => 
    api.post(`/api/competitors/${id}/refresh`),
};

export const reportsApi = {
  getAll:    () => api.get('/api/reports'),
  getById:   (id: string) => api.get(`/api/reports/${id}`),
  generate:  () => api.post('/api/reports/generate'),
};

export const notificationsApi = {
  getAll:   () => api.get('/api/notifications'),
  readAll:  () => api.patch('/api/notifications/read-all'),
  read:     (id: string) => 
    api.patch(`/api/notifications/${id}/read`),
};

export const billingApi = {
  getStatus:  () => api.get('/api/billing/status'),
  activate:   (plan: string) => 
    api.post('/api/billing/activate', { plan }),
  cancel:     () => api.post('/api/billing/cancel'),
};

export const visualAuditApi = {
  run:          () => 
    api.post('/api/visual-audit/run'),
  getAll:       () => 
    api.get('/api/visual-audit'),
  getLatest:    () => 
    api.get('/api/visual-audit/latest'),
  getStatus:    (id: string) => 
    api.get(`/api/visual-audit/${id}/status`),
  getIssues:    () => 
    api.get('/api/visual-audit/issues/list'),
  getPlanInfo:  () => 
    api.get('/api/visual-audit/plan-info'),
  generateFix:  (issueId: string) => 
    api.post(`/api/visual-audit/generate-fix/${issueId}`),
  applyFix:     (codeFixId: string) => 
    api.post(`/api/visual-audit/apply-fix/${codeFixId}`),
  revertFix:    (codeFixId: string) => 
    api.post(`/api/visual-audit/revert-fix/${codeFixId}`),
  revertAll:    () => 
    api.post('/api/visual-audit/revert-all'),
  getCodeFixes: (status?: string) => 
    api.get('/api/visual-audit/code-fixes', 
      { params: { status } }),
};

export default api;
