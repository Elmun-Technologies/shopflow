export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  nameUz: string;
  description: string;
  icon: string;
  status: "active" | "inactive" | "pending" | "error";
  type: "instant" | "installment" | "cash";
  config: PaymentConfig;
  stats: PaymentStats;
  lastUpdated: string;
  integrationUrl?: string;
  docsUrl?: string;
}

export interface PaymentConfig {
  merchantId?: string;
  serviceId?: string;
  apiKey?: string;
  secretKey?: string;
  terminalId?: string;
  login?: string;
  password?: string;
  webhookUrl?: string;
  redirectUrl?: string;
  minAmount?: number;
  maxAmount?: number;
  commissionPercent?: number;
  testMode?: boolean;
  autoConfirm?: boolean;
}

export interface PaymentStats {
  totalTransactions: number;
  totalAmount: number;
  successRate: number;
  avgAmount: number;
  todayTransactions: number;
  todayAmount: number;
  failedTransactions: number;
  refundedAmount: number;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  customer: string;
  phone: string;
  amount: number;
  method: string;
  status: "success" | "pending" | "failed" | "refunded";
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  installmentMonths?: number;
  commission?: number;
}

export interface DailyPaymentStat {
  date: string;
  click: number;
  payme: number;
  uzum: number;
  alif: number;
  cash: number;
}

export const paymentMethods: PaymentMethod[] = [];

export const transactions: PaymentTransaction[] = [];

export const dailyPaymentStats: DailyPaymentStat[] = [];

export const methodColors: Record<string, string> = {
  Click: "#3b82f6",
  Payme: "#10b981",
  "Uzum nasiya": "#f59e0b",
  "Alif nasiya": "#8b5cf6",
  Naqd: "#64748b",
};
