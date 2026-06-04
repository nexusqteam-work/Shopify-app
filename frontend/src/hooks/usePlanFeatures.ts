import { useMerchant } from './useMerchant';

const FEATURES: Record<string, { visualAudit: boolean; codeGen: boolean; autoFix: boolean; chatLimit: number }> = {
  FREE:   { visualAudit: true,  codeGen: true,  autoFix: true,  chatLimit: 9999 },
  GROWTH: { visualAudit: true,  codeGen: true,  autoFix: true,  chatLimit: 9999 },
  PRO:    { visualAudit: true,  codeGen: true,  autoFix: true,  chatLimit: 9999 },
  AGENCY: { visualAudit: true,  codeGen: true,  autoFix: true,  chatLimit: 9999 },
};

export function usePlanFeatures() {
  const { merchant } = useMerchant();
  const plan = merchant?.plan || 'FREE';
  return FEATURES[plan] || FEATURES.FREE;
}
