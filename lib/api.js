/**
 * PrintFlow — API Client
 * Routes through /api/proxy to avoid CORS with Apps Script.
 */

// Use local proxy route — no CORS issues
const API_BASE_URL = '/api/proxy';

/**
 * Make an API call through the Next.js proxy
 */
export async function apiCall(action, data = {}) {
    const token = getToken();

    const payload = {
        action,
        token,
        ...data
    };

    try {
        const res = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server error — invalid response' };
        }
    } catch (err) {
        console.error('API call failed:', err);
        return { success: false, error: 'Network error — check your connection' };
    }
}

/**
 * Auth helpers — store token in localStorage
 */
export function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('printflow_token');
}

export function setToken(token) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('printflow_token', token);
}

export function removeToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('printflow_token');
}

export function getUser() {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem('printflow_user');
    return data ? JSON.parse(data) : null;
}

export function setUser(user) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('printflow_user', JSON.stringify(user));
}

export function removeUser() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('printflow_user');
}

export function isLoggedIn() {
    return !!getToken() && !!getUser();
}

export function logout() {
    const token = getToken();
    removeToken();
    removeUser();
    if (token) apiCall('logout', { token }).catch(() => { });
}

/**
 * Check if current user has a specific role.
 * Supports multi-role (roles stored as comma-separated string).
 */
export function hasRole(role) {
    const user = getUser();
    if (!user) return false;
    const roles = (user.roles || user.role || '').split(',').map(r => r.trim());
    return roles.includes(role);
}

/**
 * Check if user has ANY of the given roles.
 */
export function hasAnyRole(roleList) {
    const user = getUser();
    if (!user) return false;
    const roles = (user.roles || user.role || '').split(',').map(r => r.trim());
    return roleList.some(r => roles.includes(r));
}

/**
 * Get all roles for the current user as an array.
 */
export function getUserRoles() {
    const user = getUser();
    if (!user) return [];
    return (user.roles || user.role || '').split(',').map(r => r.trim()).filter(Boolean);
}

// ===== API Functions =====

// Auth
export const login = (username, password) =>
    apiCall('login', { username, password });

// Jobs
export const getJobs = (filters = {}) =>
    apiCall('getJobs', filters);

export const getJob = (job_id) =>
    apiCall('getJob', { job_id });

export const createJob = (jobData) =>
    apiCall('createJob', jobData);

export const approveJob = (job_id) =>
    apiCall('approveJob', { job_id });

export const receiveJob = (job_id) =>
    apiCall('receiveJob', { job_id });

export const processingComplete = (job_id) =>
    apiCall('processingComplete', { job_id });

export const completeJob = (job_id) =>
    apiCall('completeJob', { job_id });

// Users
export const getUsers = () => apiCall('getUsers');
export const createUser = (userData) => apiCall('createUser', userData);
export const updateUser = (userData) => apiCall('updateUser', userData);
export const disableUser = (target_username) =>
    apiCall('disableUser', { target_username });
export const enableUser = (target_username) =>
    apiCall('enableUser', { target_username });

// Notifications
export const getNotifications = (job_id = null) =>
    apiCall('getNotifications', { job_id });

// Config
export const getConfig = () => apiCall('getConfig');
export const updateConfig = (config) =>
    apiCall('updateConfig', config);
export const addJobType = (job_type) => apiCall('addJobType', { job_type });
export const removeJobType = (job_type) => apiCall('removeJobType', { job_type });

// Inventory
export const getInventory = (category = 'all') => apiCall('getInventory', { category });
export const addInventoryItem = (itemData) => apiCall('addInventoryItem', itemData);
export const updateInventoryItem = (itemData) => apiCall('updateInventoryItem', itemData);
export const deleteInventoryItem = (item_id) => apiCall('deleteInventoryItem', { item_id });
export const deductInventory = (job_id, deductions) => apiCall('deductInventory', { job_id, deductions });

// Dashboard
export const getDashboardStats = () => apiCall('getDashboardStats');

// Activity
export const getActivityLog = (username = null) =>
    apiCall('getActivityLog', { username });
