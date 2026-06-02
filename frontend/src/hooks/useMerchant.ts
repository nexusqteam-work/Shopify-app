import { useAuth } from '../contexts/AuthContext';

export function useMerchant() {
  const { merchant, isAuthenticated, isLoading } = useAuth();

  return {
    merchant,
    isConnected: isAuthenticated,
    isLoading,
    shopDomain: merchant?.shopDomain || '',
    shopName: merchant?.shopName || '',
    plan: merchant?.plan || 'FREE',
  };
}
