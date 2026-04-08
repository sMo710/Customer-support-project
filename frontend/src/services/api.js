import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add JWT token to every request except auth
api.interceptors.request.use((config) => {
    const isAuthRequest = config.url.includes('/auth/');
    if (!isAuthRequest) {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Ticket APIs
export const createTicket = (query, userId) =>
    api.post('/tickets', { query, userId });

export const getAllTickets = () =>
    api.get('/tickets');

export const getTicketById = (id) =>
    api.get(`/tickets/${id}`);

export const updateTicketStatus = (id, status) =>
    api.patch(`/tickets/${id}/status?status=${status}`);

export const searchTickets = (keyword) =>
    api.get(`/tickets/search?keyword=${keyword}`);

export const getTicketStats = () =>
    api.get('/tickets/stats');

// Auth APIs
export const login = (username, password) =>
    api.post('/auth/login', { username, password });

export const register = (username, password, role) =>
    api.post('/auth/register', { username, password, role });
export const addMessage = (ticketId, message) =>
    api.post(`/tickets/${ticketId}/messages`, { message, sender: 'USER' });
export const addAdminMessage = (ticketId, message) =>
    api.post(`/tickets/${ticketId}/admin-messages`, { message, sender: 'ADMIN' });
export default api;