import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('stocksense_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('stocksense_token');
      if (token) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('stocksense_user', JSON.stringify(res.data));
        } catch (err) {
          localStorage.removeItem('stocksense_token');
          localStorage.removeItem('stocksense_user');
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const { access_token, user: loggedUser } = res.data;
    localStorage.setItem('stocksense_token', access_token);
    localStorage.setItem('stocksense_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    return loggedUser;
  };

  const register = async (username, email, password, role) => {
    const res = await apiClient.post('/auth/register', { username, email, password, role });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('stocksense_token');
    localStorage.removeItem('stocksense_user');
    setUser(null);
    window.location.href = '/login';
  };

  const updateProfile = async (email, password) => {
    const res = await apiClient.put('/auth/me', { email, password });
    setUser(res.data);
    localStorage.setItem('stocksense_user', JSON.stringify(res.data));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
