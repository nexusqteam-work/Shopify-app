import { useMerchant } from './useMerchant';

const FEATURES: Record<string, { visualAudit: boolean; codeGen: boolean; autoFix: boolean; chatLimit: number }> = {
  FREE:   { visualAudit: false, codeGen: false, autoFix: false, chatLimit: 10 },
  GROWTH: { visualAudit: true,  codeGen: false, autoFix: false, chatLimit: 100 },
  PRO:    { visualAudit: true,  codeGen: true,  autoFix: false, chatLimit: 9999 },
  AGENCY: { visualAudit: true,  codeGen: true,  autoFix: true,  chatLimit: 9999 },
};

export function usePlanFeatures() {
  const { merchant } = useMerchant();
  const plan = merchant?.plan || 'FREE';
  return FEATURES[plan] || FEATURES.FREE;
}
