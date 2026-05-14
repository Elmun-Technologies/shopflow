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

export const paymentMethods: PaymentMethod[] = [
  {
    id: "pay-cash",
    code: "cash",
    name: "Naqd pul",
    nameUz: "Naqd",
    description: "Mijoz naqd to'lov qilganda, fiskal chek berishni unutmang.",
    icon: "Banknote",
    status: "active",
    type: "cash",
    config: {
      minAmount: 1000,
      maxAmount: 100000000,
      commissionPercent: 0,
      autoConfirm: true,
    },
    stats: {
      totalTransactions: 1247,
      totalAmount: 456000000,
      successRate: 99.8,
      avgAmount: 365000,
      todayTransactions: 23,
      todayAmount: 8400000,
      failedTransactions: 3,
      refundedAmount: 0,
    },
    lastUpdated: "2026-04-25T02:56:00",
  },
  {
    id: "pay-click",
    code: "click",
    name: "Click",
    nameUz: "Click",
    description: "Click orqali tezkor to'lov. O'zbekistonning eng mashhur to'lov tizimi.",
    icon: "MousePointerClick",
    status: "active",
    type: "instant",
    config: {
      merchantId: "SHOPFLOW_2024",
      serviceId: "12345",
      apiKey: "ck_live_********************************",
      secretKey: "sk_live_********************************",
      webhookUrl: "https://shopflow.uz/api/webhooks/click",
      redirectUrl: "https://shopflow.uz/payment/success",
      minAmount: 1000,
      maxAmount: 50000000,
      commissionPercent: 2.5,
      testMode: false,
      autoConfirm: true,
    },
    stats: {
      totalTransactions: 3892,
      totalAmount: 1234000000,
      successRate: 97.3,
      avgAmount: 317000,
      todayTransactions: 67,
      todayAmount: 21500000,
      failedTransactions: 89,
      refundedAmount: 4500000,
    },
    lastUpdated: "2026-04-25T08:30:00",
    integrationUrl: "https://docs.click.uz/merchant-api",
    docsUrl: "https://docs.click.uz",
  },
  {
    id: "pay-payme",
    code: "payme",
    name: "Payme",
    nameUz: "Payme",
    description: "Payme JSON-RPC integratsiyasi. Xavfsiz va tezkor to'lovlar.",
    icon: "CreditCard",
    status: "active",
    type: "instant",
    config: {
      merchantId: "shopflow_merchant",
      apiKey: "payme_live_********************************",
      secretKey: "payme_secret_********************************",
      webhookUrl: "https://shopflow.uz/api/webhooks/payme",
      redirectUrl: "https://shopflow.uz/payment/success",
      minAmount: 1000,
      maxAmount: 100000000,
      commissionPercent: 2.0,
      testMode: false,
      autoConfirm: true,
    },
    stats: {
      totalTransactions: 2156,
      totalAmount: 892000000,
      successRate: 96.8,
      avgAmount: 413000,
      todayTransactions: 45,
      todayAmount: 18600000,
      failedTransactions: 67,
      refundedAmount: 3200000,
    },
    lastUpdated: "2026-04-25T10:15:00",
    integrationUrl: "https://developer.payme.uz/api",
    docsUrl: "https://developer.payme.uz",
  },
  {
    id: "pay-uzum",
    code: "uzum",
    name: "Uzum nasiya",
    nameUz: "Uzum nasiya",
    description: "Nasiya orqali bo'lib to'lash. 3, 6, 9, 12 oylik muddatli to'lov.",
    icon: "CalendarClock",
    status: "active",
    type: "installment",
    config: {
      merchantId: "UZUM_SHOPFLOW",
      apiKey: "uzum_live_********************************",
      secretKey: "uzum_secret_********************************",
      terminalId: "T12345678",
      webhookUrl: "https://shopflow.uz/api/webhooks/uzum",
      redirectUrl: "https://shopflow.uz/payment/success",
      minAmount: 50000,
      maxAmount: 50000000,
      commissionPercent: 4.5,
      testMode: false,
      autoConfirm: false,
    },
    stats: {
      totalTransactions: 876,
      totalAmount: 567000000,
      successRate: 94.2,
      avgAmount: 647000,
      todayTransactions: 18,
      todayAmount: 11600000,
      failedTransactions: 45,
      refundedAmount: 2100000,
    },
    lastUpdated: "2026-04-25T09:45:00",
    integrationUrl: "https://developer.uzum.uz/api",
    docsUrl: "https://developer.uzum.uz",
  },
  {
    id: "pay-alif",
    code: "alif",
    name: "Alif nasiya",
    nameUz: "Alif nasiya",
    description: "Alif orqali bo'lib to'lash. 0% boshlang'ich to'lov imkoniyati.",
    icon: "Wallet",
    status: "active",
    type: "installment",
    config: {
      merchantId: "ALIF_SHOPFLOW",
      apiKey: "alif_live_********************************",
      secretKey: "alif_secret_********************************",
      login: "shopflow_api",
      password: "********************************",
      webhookUrl: "https://shopflow.uz/api/webhooks/alif",
      redirectUrl: "https://shopflow.uz/payment/success",
      minAmount: 100000,
      maxAmount: 30000000,
      commissionPercent: 5.0,
      testMode: false,
      autoConfirm: false,
    },
    stats: {
      totalTransactions: 543,
      totalAmount: 345000000,
      successRate: 93.5,
      avgAmount: 635000,
      todayTransactions: 12,
      todayAmount: 7600000,
      failedTransactions: 34,
      refundedAmount: 1800000,
    },
    lastUpdated: "2026-04-25T11:20:00",
    integrationUrl: "https://developer.alif.tj/api",
    docsUrl: "https://developer.alif.tj",
  },
];

export const transactions: PaymentTransaction[] = [
  { id: "TXN-2026001", orderId: "ORD-7523", customer: "Azizbek Karimov", phone: "+998 90 123 45 67", amount: 14500000, method: "Click", status: "success", createdAt: "2026-04-25 14:32", completedAt: "2026-04-25 14:33", commission: 362500 },
  { id: "TXN-2026002", orderId: "ORD-7522", customer: "Michael Chen", phone: "+998 91 234 56 78", amount: 3990000, method: "Payme", status: "success", createdAt: "2026-04-25 14:15", completedAt: "2026-04-25 14:16", commission: 79800 },
  { id: "TXN-2026003", orderId: "ORD-7521", customer: "Emily Davis", phone: "+998 93 345 67 89", amount: 1295000, method: "Naqd", status: "success", createdAt: "2026-04-25 13:50", commission: 0 },
  { id: "TXN-2026004", orderId: "ORD-7520", customer: "James Wilson", phone: "+998 94 456 78 90", amount: 799900, method: "Uzum nasiya", status: "success", createdAt: "2026-04-25 13:30", completedAt: "2026-04-25 13:35", installmentMonths: 6, commission: 35996 },
  { id: "TXN-2026005", orderId: "ORD-7519", customer: "Anna Martinez", phone: "+998 95 567 89 01", amount: 450000, method: "Naqd", status: "success", createdAt: "2026-04-25 12:45", commission: 0 },
  { id: "TXN-2026006", orderId: "ORD-7518", customer: "Robert Taylor", phone: "+998 97 678 90 12", amount: 599900, method: "Payme", status: "failed", createdAt: "2026-04-25 12:20", errorMessage: "Karta muddati tugagan" },
  { id: "TXN-2026007", orderId: "ORD-7517", customer: "Lisa Anderson", phone: "+998 98 789 01 23", amount: 1490000, method: "Click", status: "success", createdAt: "2026-04-25 11:55", completedAt: "2026-04-25 11:56", commission: 37250 },
  { id: "TXN-2026008", orderId: "ORD-7516", customer: "David Brown", phone: "+998 99 890 12 34", amount: 5490000, method: "Alif nasiya", status: "success", createdAt: "2026-04-25 11:30", completedAt: "2026-04-25 11:40", installmentMonths: 12, commission: 274500 },
  { id: "TXN-2026009", orderId: "ORD-7515", customer: "Jennifer Lee", phone: "+998 90 901 23 45", amount: 680000, method: "Payme", status: "success", createdAt: "2026-04-25 10:45", completedAt: "2026-04-25 10:46", commission: 13600 },
  { id: "TXN-2026010", orderId: "ORD-7514", customer: "Christopher Moore", phone: "+998 91 012 34 56", amount: 4200000, method: "Uzum nasiya", status: "pending", createdAt: "2026-04-25 10:20", installmentMonths: 3, commission: 189000 },
  { id: "TXN-2026011", orderId: "ORD-7513", customer: "Amanda White", phone: "+998 93 123 45 67", amount: 890000, method: "Naqd", status: "success", createdAt: "2026-04-25 09:50", commission: 0 },
  { id: "TXN-2026012", orderId: "ORD-7512", customer: "Daniel Harris", phone: "+998 94 234 56 78", amount: 18500000, method: "Click", status: "success", createdAt: "2026-04-25 09:15", completedAt: "2026-04-25 09:16", commission: 462500 },
  { id: "TXN-2026013", orderId: "ORD-7511", customer: "Michelle Clark", phone: "+998 95 345 67 89", amount: 520000, method: "Payme", status: "refunded", createdAt: "2026-04-25 08:30", completedAt: "2026-04-25 09:00", commission: 0 },
  { id: "TXN-2026014", orderId: "ORD-7510", customer: "Kevin Lewis", phone: "+998 97 456 78 90", amount: 750000, method: "Naqd", status: "success", createdAt: "2026-04-25 08:00", commission: 0 },
  { id: "TXN-2026015", orderId: "ORD-7509", customer: "Rachel Walker", phone: "+998 98 567 89 01", amount: 8900000, method: "Alif nasiya", status: "success", createdAt: "2026-04-25 07:45", completedAt: "2026-04-25 07:50", installmentMonths: 9, commission: 445000 },
];

export const dailyPaymentStats: DailyPaymentStat[] = [
  { date: "20 Apr", click: 45, payme: 38, uzum: 15, alif: 10, cash: 22 },
  { date: "21 Apr", click: 52, payme: 41, uzum: 18, alif: 12, cash: 25 },
  { date: "22 Apr", click: 48, payme: 35, uzum: 14, alif: 9, cash: 20 },
  { date: "23 Apr", click: 61, payme: 48, uzum: 22, alif: 15, cash: 28 },
  { date: "24 Apr", click: 58, payme: 44, uzum: 20, alif: 13, cash: 26 },
  { date: "25 Apr", click: 67, payme: 45, uzum: 18, alif: 12, cash: 23 },
];

export const methodColors: Record<string, string> = {
  Click: "#3b82f6",
  Payme: "#10b981",
  "Uzum nasiya": "#f59e0b",
  "Alif nasiya": "#8b5cf6",
  Naqd: "#64748b",
};
