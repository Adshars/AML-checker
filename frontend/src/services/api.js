import axios from 'axios';

// Pobieramy adres z zmiennej środowiskowej (zdefiniowanej w docker-compose)
// Jeśli jej nie ma, domyślnie używamy localhost:8080
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- INTERCEPTORS (To jest magia bezpieczeństwa) ---

// 1. Request Interceptor: Automatycznie dodaj token do każdego zapytania
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Pobieramy token z pamięci przeglądarki
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 2. Response Interceptor: Obsługa wygaśnięcia sesji (401)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Jeśli serwer zwróci 401 (Unauthorized), znaczy to, że token wygasł
    if (error.response && error.response.status === 401) {
      // Unikamy pętli (nie wylogowuj, jeśli błąd dotyczy samego logowania)
      if (!error.config.url.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Przeładowanie strony wymusi powrót do ekranu logowania (obsłużymy to w AuthContext)
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;