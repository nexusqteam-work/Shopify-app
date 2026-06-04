import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../lib/api';

export interface Merchant {
  id: string;
  shopDomain: string;
  shopName: string;
  email: string;
  plan: string;
  currency: string;
}

interface AuthContextType {
  merchant: Merchant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sc_token');
    authApi.getMe()
      .then((data: any) => {
        if (data.success && data.merchant) {
          setMerchant(data.merchant);
        } else {
          setMerchant(null);
          localStorage.removeItem('sc_token');
        }
      })
      .catch((error: any) => {
        console.error('Failed to authenticate:', error);
        setMerchant(null);
        if (token) {
          localStorage.removeItem('sc_token');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const logout = () => {
    localStorage.removeItem('sc_token');
    setMerchant(null);
    authApi.logout().catch(() => {});
  };

  const isAuthenticated = !!merchant;

  return (
    <AuthContext.Provider value={{ merchant, isAuthenticated, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
