import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  activeRole: string;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<string>('STUDENT');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('rsci_token');
    if (token) {
      api.getMe()
        .then((userData) => {
          setUser(userData);
          const role = userData.active_role || userData.roles[0] || 'STUDENT';
          setActiveRole(role);
          localStorage.setItem('rsci_active_role', role);
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const data = await api.login(email, pass);
      localStorage.setItem('rsci_token', data.access_token);
      localStorage.setItem('rsci_refresh_token', data.refresh_token);
      localStorage.setItem('rsci_active_role', data.user.active_role);
      setUser(data.user);
      setActiveRole(data.user.active_role);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('rsci_token');
    localStorage.removeItem('rsci_refresh_token');
    localStorage.removeItem('rsci_active_role');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
