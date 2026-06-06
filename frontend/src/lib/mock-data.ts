// Data contracts for AI Flovix.
// Mock values have been removed — wire each export to your backend
// (server functions, API, or DB queries). Types and helpers are preserved
// so existing UI/logic continues to compile and render empty states.

export type Store = {
  name: string;
  url: string;
  productCount: number;
  appCount: number;
  lastScannedMinutes: number;
};

export const store: Store = {
  name: "",
  url: "",
  productCount: 0,
  appCount: 0,
  lastScannedMinutes: 0,
};

export const overallScore = 0;

export type Category = {
  key: string;
  emoji: string;
  name: string;
  score: number;
};

export const categories: Category[] = [];

export type Priority = "critical" | "high" | "medium";

export type Issue = {
  id: string;
  rank: number;
  priority: Priority;
  title: string;
  category: string;
  revenueImpact: number; // monthly INR
  effortLabel: string;
  effortMinutes: number;
  description: string;
  fixSteps: string[];
  shopifyAdminPath: string;
};

export const issues: Issue[] = [];

export type Metric = {
  value: number;
  change: number;
  label: string;
  note?: string;
};

export const metrics: {
  revenue: Metric;
  orders: Metric;
  visitors: Metric;
  conversion: Metric;
} = {
  revenue: { value: 0, change: 0, label: "Monthly Revenue" },
  orders: { value: 0, change: 0, label: "Total Orders" },
  visitors: { value: 0, change: 0, label: "Store Visitors" },
  conversion: { value: 0, change: 0, label: "Conversion Rate" },
};

// 7-day sparkline data
export const sparklines: {
  revenue: number[];
  orders: number[];
  visitors: number[];
  conversion: number[];
} = {
  revenue: [],
  orders: [],
  visitors: [],
  conversion: [],
};

export type WeeklyRevenuePoint = { week: string; value: number };
export const weeklyRevenue: WeeklyRevenuePoint[] = [];

export type TopProduct = { name: string; revenue: number; orders: number };
export const topProducts: TopProduct[] = [];

export type Competitor = {
  name: string;
  url: string;
  speed: number;
  priceLow: number;
  priceHigh: number;
  reviews: number;
  apps: number;
  threat: "high" | "medium" | "low";
  lastCheckedMinutes: number;
  insight: string;
};

export const competitors: Competitor[] = [];

export function formatRelativeMinutes(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const unreadNotifications = 0;

export const weeklyStats: {
  revenue: { value: number; change: number };
  orders: { value: number; change: number };
  newCustomers: { value: number; change: number };
  loadTime: { value: number; change: number; bad?: boolean };
} = {
  revenue: { value: 0, change: 0 },
  orders: { value: 0, change: 0 },
  newCustomers: { value: 0, change: 0 },
  loadTime: { value: 0, change: 0, bad: false },
};

export function formatINR(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatINRFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export const totalMonthlyLoss = issues.reduce((s, i) => s + i.revenueImpact, 0);
export const totalFixHours = issues.reduce((s, i) => s + i.effortMinutes, 0) / 60;
