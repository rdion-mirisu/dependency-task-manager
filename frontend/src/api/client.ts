import axios from 'axios';

// base URL is set via environment variable (mimics the old fetch helper)
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// attach JWT from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response interceptor for expired tokens
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const data = error.response.data;
      const msg =
        typeof data === 'string' ? data : data?.message || '';
      if (msg.toString().includes('Token has expired')) {
        // token is no longer valid, log the user out
        localStorage.removeItem('token');
        // redirect to login screen; using window.location because
        // we don't have access to hooks in this module
        window.location.href = '/login';
        // show a simple notification; if you bring in a toast
        // library later you can replace this with a nicer UI.
        // eslint-disable-next-line no-alert
        alert('Your session has expired, please log in again.');
      }
    }
    return Promise.reject(error);
  }
);

export default client;
