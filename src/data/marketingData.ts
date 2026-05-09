/** Marketing moduli — lokal demo ma'lumotlari */

export type MarketingSub =
  | "rassilka"
  | "promokod"
  | "sovgalar"
  | "manbalar"
  | "sms"
  | "kanal"
  | "banner"
  | "sharhlar"
  | "sodiqlik"
  | "giveaway"
  | "tranzaksiyalar";

export const marketingSubLabels: Record<MarketingSub, string> = {
  rassilka: "Rassilka",
  promokod: "Promo kodlar",
  sovgalar: "Sovg'alar",
  manbalar: "Manbalar",
  sms: "SMS yuborish",
  kanal: "Kanal posti",
  banner: "Banner",
  sharhlar: "Izohlar",
  sodiqlik: "Sodiqlik dasturi",
  giveaway: "Giveaway",
  tranzaksiyalar: "Tranzaksiyalar",
};

export const marketingSubOrder: MarketingSub[] = [
  "rassilka",
  "promokod",
  "sovgalar",
  "sms",
  "kanal",
  "banner",
  "sharhlar",
  "sodiqlik",
  "giveaway",
  "manbalar",
  "tranzaksiyalar",
];

// ─── Email rassilka ───────────────────────────────────────────────────────────
export type EmailCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  segment: string;
  body?: string;
  status: EmailCampaignStatus;
  scheduledAt: string;
  sent: number;
  opened: number;
  clicks: number;
  createdAt: string;
}

// ─── Promokod ─────────────────────────────────────────────────────────────────
export type PromoDiscountType = "percent" | "fixed";

export interface PromoCode {
  id: string;
  code: string;
  discountType: PromoDiscountType;
  value: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  active: boolean;
}

// ─── Sovg'alar (Gift promotions) ──────────────────────────────────────────────
export type GiftConditionType = "quantity" | "amount";

export interface GiftPromotion {
  id: string;
  name: string;
  description: string;
  conditionType: GiftConditionType;
  conditionValue: number;
  triggerProducts: string[];
  giftDescription: string;
  priority: number;
  usageLimit: number | null;
  usedCount: number;
  startAt: string;
  endAt: string;
  active: boolean;
  createdAt: string;
}

// ─── Manbalar ─────────────────────────────────────────────────────────────────
export interface MarketingSource {
  id: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  channel: string;
  spendMonthly: number;
  conversions: number;
  active: boolean;
}

// ─── SMS ─────────────────────────────────────────────────────────────────────
export type SmsCampaignStatus = "draft" | "scheduled" | "sent" | "failed";

export interface SmsCampaign {
  id: string;
  name: string;
  message: string;
  segment: string;
  recipients: number;
  status: SmsCampaignStatus;
  scheduledAt: string;
  sent: number;
  delivered: number;
  createdAt: string;
}

// ─── Kanal posti ──────────────────────────────────────────────────────────────
export type ChannelPlatform = "telegram" | "instagram" | "facebook" | "youtube";
export type ChannelPostStatus = "draft" | "scheduled" | "published";

export interface ChannelPost {
  id: string;
  platform: ChannelPlatform;
  title: string;
  content: string;
  mediaUrl?: string;
  scheduledAt: string;
  status: ChannelPostStatus;
  reach: number;
  link?: string;
}

// ─── Banner ───────────────────────────────────────────────────────────────────
export type BannerPlacement = "home_hero" | "category_top" | "cart_sidebar" | "checkout";

export interface MarketingBanner {
  id: string;
  title: string;
  placement: BannerPlacement;
  imageUrl: string;
  targetUrl: string;
  impressions: number;
  clicks: number;
  active: boolean;
  startAt: string;
  endAt: string;
}

// ─── Sharhlar (Izohlar) ───────────────────────────────────────────────────────
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ProductReview {
  id: string;
  customerName: string;
  productName: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  createdAt: string;
}

// ─── Sodiqlik dasturi ─────────────────────────────────────────────────────────
export type LoyaltyRuleType = "registration" | "purchase" | "spend_goal" | "review";

export interface LoyaltyRule {
  id: string;
  type: LoyaltyRuleType;
  name: string;
  description: string;
  pointsValue: number;
  purchaseRate?: number;
  minSpend?: number;
  active: boolean;
}

export interface LoyaltySettings {
  enabled: boolean;
  pointValue: number;
}

// ─── Giveaway ─────────────────────────────────────────────────────────────────
export type GiveawayPrizeType = "discount" | "product" | "points";
export type GiveawayAudience = "all" | "new_subscribers";
export type GiveawayStatus = "draft" | "active" | "ended";

export interface GiveawayContest {
  id: string;
  title: string;
  description: string;
  prizeType: GiveawayPrizeType;
  prizeCount: number;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  productName?: string;
  pointsAmount?: number;
  audience: GiveawayAudience;
  endAt: string;
  status: GiveawayStatus;
  participantCount: number;
  createdAt: string;
}

// ─── Tranzaksiyalar ───────────────────────────────────────────────────────────
export type TransactionType = "earn" | "spend" | "expire" | "manual_add" | "manual_remove";

export interface LoyaltyTransaction {
  id: string;
  customerName: string;
  type: TransactionType;
  points: number;
  balance: number;
  description: string;
  orderId?: string;
  createdAt: string;
}

// ─── Labels ───────────────────────────────────────────────────────────────────
export const emailCampaignStatusLabels: Record<EmailCampaignStatus, string> = {
  draft: "Qoralama",
  scheduled: "Rejalashtirilgan",
  sending: "Yuborilmoqda",
  sent: "Yuborilgan",
  paused: "Pauza",
};

export const smsStatusLabels: Record<SmsCampaignStatus, string> = {
  draft: "Qoralama",
  scheduled: "Rejalashtirilgan",
  sent: "Yuborilgan",
  failed: "Xato",
};

export const channelPlatformLabels: Record<ChannelPlatform, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

export const channelPostStatusLabels: Record<ChannelPostStatus, string> = {
  draft: "Qoralama",
  scheduled: "Rejalashtirilgan",
  published: "Chop etilgan",
};

export const bannerPlacementLabels: Record<BannerPlacement, string> = {
  home_hero: "Bosh sahifa (hero)",
  category_top: "Kategoriya ustida",
  cart_sidebar: "Savat yon panel",
  checkout: "To'lov sahifasi",
};

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  pending: "Ko'rib chiqilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

export const loyaltyRuleTypeLabels: Record<LoyaltyRuleType, string> = {
  registration: "Ro'yxatdan o'tish",
  purchase: "Xarid uchun ballar",
  spend_goal: "X sarfla, Y ol",
  review: "Sharh yozish",
};

export const loyaltyRuleTypeDescriptions: Record<LoyaltyRuleType, string> = {
  registration: "Yangi ro'yxatdan o'tgan mijozlarni mukofotlang",
  purchase: "Har bir xarid uchun sodiqlik ballari bering",
  spend_goal: "Mijozlarni ko'proq xarid qilishga undang",
  review: "Mahsulot sharhi uchun ball oling",
};

export const giveawayPrizeTypeLabels: Record<GiveawayPrizeType, string> = {
  discount: "Chegirma",
  product: "Mahsulot",
  points: "Ballar",
};

export const giveawayAudienceLabels: Record<GiveawayAudience, string> = {
  all: "Barcha foydalanuvchilar",
  new_subscribers: "Faqat yangi obunachalar",
};

export const giveawayStatusLabels: Record<GiveawayStatus, string> = {
  draft: "Qoralama",
  active: "Faol",
  ended: "Tugagan",
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  earn: "Ball olindi",
  spend: "Ball sarflandi",
  expire: "Muddat o'tdi",
  manual_add: "Qo'lda qo'shildi",
  manual_remove: "Qo'lda ayirildi",
};

// ─── Initial data ──────────────────────────────────────────────────────────────
export const initialEmailCampaigns: EmailCampaign[] = [
  {
    id: "em-1",
    name: "Yozgi kolleksiya",
    subject: "Chegirmalar 40% gacha — faqat 3 kun!",
    segment: "Faol xaridorlar",
    body: "Hurmatli mijoz, yozgi aksiyamiz boshlandi! 40% gacha chegirma. Havolaga o'ting.",
    status: "sent",
    scheduledAt: "2026-04-28 10:00",
    sent: 12400,
    opened: 4100,
    clicks: 980,
    createdAt: "2026-04-20",
  },
  {
    id: "em-2",
    name: "Savat eslatmasi",
    subject: "Savatingizda mahsulot qoldi 🛒",
    segment: "Savatni tashlab ketganlar",
    body: "Siz tanlagan mahsulotlar hali savatingizda turibdi. Buyurtmani rasmiylashtiring!",
    status: "scheduled",
    scheduledAt: "2026-05-06 09:00",
    sent: 0,
    opened: 0,
    clicks: 0,
    createdAt: "2026-05-01",
  },
  {
    id: "em-3",
    name: "VIP mijozlar uchun",
    subject: "Faqat siz uchun maxsus taklif",
    segment: "VIP mijozlar",
    status: "draft",
    scheduledAt: "—",
    sent: 0,
    opened: 0,
    clicks: 0,
    createdAt: "2026-05-03",
  },
];

export const initialPromoCodes: PromoCode[] = [
  {
    id: "pr-1",
    code: "SUMMER26",
    discountType: "percent",
    value: 15,
    minOrder: 200000,
    maxUses: 500,
    usedCount: 142,
    validFrom: "2026-05-01",
    validTo: "2026-08-31",
    active: true,
  },
  {
    id: "pr-2",
    code: "BONUS50000",
    discountType: "fixed",
    value: 50000,
    minOrder: 400000,
    maxUses: 100,
    usedCount: 23,
    validFrom: "2026-04-15",
    validTo: "2026-06-01",
    active: true,
  },
  {
    id: "pr-3",
    code: "WELCOME10",
    discountType: "percent",
    value: 10,
    minOrder: 0,
    maxUses: 1000,
    usedCount: 456,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    active: true,
  },
  {
    id: "pr-4",
    code: "FLASH30",
    discountType: "percent",
    value: 30,
    minOrder: 500000,
    maxUses: 50,
    usedCount: 50,
    validFrom: "2026-04-01",
    validTo: "2026-04-30",
    active: false,
  },
];

export const initialGiftPromotions: GiftPromotion[] = [
  {
    id: "gp-1",
    name: "3 ta mahsulot sotib olsangiz sovg'a",
    description: "Elektronika bo'limidan 3 ta mahsulot sotib olgan mijozga qo'shimcha aksessuar",
    conditionType: "quantity",
    conditionValue: 3,
    triggerProducts: ["Smartfon", "Noutbuk", "Planshet"],
    giftDescription: "Telefon qopchasi (bepul)",
    priority: 1,
    usageLimit: 200,
    usedCount: 45,
    startAt: "2026-05-01",
    endAt: "2026-05-31",
    active: true,
    createdAt: "2026-04-28",
  },
  {
    id: "gp-2",
    name: "1 000 000 so'mdan ortiq xarid",
    description: "Bir martalik xarid hajmi 1 000 000 so'mdan oshsa bepul yetkazib berish",
    conditionType: "amount",
    conditionValue: 1000000,
    triggerProducts: [],
    giftDescription: "Bepul yetkazib berish",
    priority: 2,
    usageLimit: null,
    usedCount: 128,
    startAt: "2026-04-01",
    endAt: "2026-12-31",
    active: true,
    createdAt: "2026-03-25",
  },
];

export const initialSources: MarketingSource[] = [
  {
    id: "src-1",
    name: "Instagram reklama",
    utmSource: "instagram",
    utmMedium: "cpc",
    channel: "Meta Ads",
    spendMonthly: 8500000,
    conversions: 312,
    active: true,
  },
  {
    id: "src-2",
    name: "Google qidiruv",
    utmSource: "google",
    utmMedium: "organic",
    channel: "SEO",
    spendMonthly: 0,
    conversions: 189,
    active: true,
  },
  {
    id: "src-3",
    name: "Telegram kanal",
    utmSource: "telegram",
    utmMedium: "social",
    channel: "Telegram Ads",
    spendMonthly: 2000000,
    conversions: 95,
    active: true,
  },
];

export const initialSmsCampaigns: SmsCampaign[] = [
  {
    id: "sms-1",
    name: "Yetkazib berish eslatmasi",
    message: "Buyurtmangiz yo'lga chiqdi. Kuzating: shopflow.uz/track",
    segment: "Barcha mijozlar",
    recipients: 450,
    status: "sent",
    scheduledAt: "2026-05-02 14:00",
    sent: 450,
    delivered: 441,
    createdAt: "2026-05-02",
  },
  {
    id: "sms-2",
    name: "Kupon eslatma",
    message: "SUMMER26 — 15% chegirma 31.08 gacha. Havolaga o'ting: shopflow.uz/sale",
    segment: "Faol xaridorlar",
    recipients: 8000,
    status: "scheduled",
    scheduledAt: "2026-05-08 11:00",
    sent: 0,
    delivered: 0,
    createdAt: "2026-05-03",
  },
  {
    id: "sms-3",
    name: "Flash sale",
    message: "24 soat ichida 30% chegirma! shopflow.uz/flash",
    segment: "VIP mijozlar",
    recipients: 1200,
    status: "draft",
    scheduledAt: "—",
    sent: 0,
    delivered: 0,
    createdAt: "2026-05-04",
  },
];

export const initialChannelPosts: ChannelPost[] = [
  {
    id: "ch-1",
    platform: "telegram",
    title: "Yangi smartfonlar keldi!",
    content: "Samsung Galaxy S25 va iPhone 16 Pro endi bizda! Narxlar eng qulay. Ko'proq ma'lumot uchun havolaga o'ting 👇",
    scheduledAt: "2026-05-05 18:00",
    status: "scheduled",
    reach: 0,
    link: "https://t.me/shopflow",
  },
  {
    id: "ch-2",
    platform: "instagram",
    title: "Flash sale: 24 soat",
    content: "24 soatlik flash sale boshlandi! Barcha mahsulotlarda 30% chegirma. Link bio'da 🔥",
    scheduledAt: "2026-04-30 12:00",
    status: "published",
    reach: 12800,
  },
  {
    id: "ch-3",
    platform: "facebook",
    title: "Yangi kolektsiya",
    content: "2026 yozgi kolektsiyamiz rasman keldi. 500+ yangi mahsulot sizni kutmoqda.",
    scheduledAt: "2026-05-07 15:00",
    status: "draft",
    reach: 0,
  },
];

export const initialBanners: MarketingBanner[] = [
  {
    id: "bn-1",
    title: "Yozgi sale banner",
    placement: "home_hero",
    imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80",
    targetUrl: "/sale",
    impressions: 92000,
    clicks: 3100,
    active: true,
    startAt: "2026-05-01",
    endAt: "2026-05-31",
  },
  {
    id: "bn-2",
    title: "Bepul yetkazib berish",
    placement: "cart_sidebar",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    targetUrl: "/delivery",
    impressions: 12000,
    clicks: 400,
    active: true,
    startAt: "2026-04-01",
    endAt: "2026-12-31",
  },
  {
    id: "bn-3",
    title: "Telefon aksiyasi",
    placement: "category_top",
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
    targetUrl: "/phones",
    impressions: 5400,
    clicks: 290,
    active: false,
    startAt: "2026-04-10",
    endAt: "2026-04-25",
  },
];

export const initialReviews: ProductReview[] = [
  {
    id: "rv-1",
    customerName: "Dilshod T.",
    productName: "Simli quloqchin Sony WH-1000",
    rating: 5,
    text: "Juda tez yetkazib berish, sifat alo! Hamma do'stlarimga tavsiya qilaman.",
    status: "approved",
    createdAt: "2026-04-28",
  },
  {
    id: "rv-2",
    customerName: "Malika R.",
    productName: "Smartfon Samsung G14",
    rating: 2,
    text: "Qutisi shikastlangan edi. Lekin mahsulotning o'zi yaxshi.",
    status: "pending",
    createdAt: "2026-05-02",
  },
  {
    id: "rv-3",
    customerName: "Jasur A.",
    productName: "Noutbuk Lenovo IdeaPad",
    rating: 4,
    text: "Yaxshi noutbuk, batareya muddati biroz qisqa.",
    status: "pending",
    createdAt: "2026-05-03",
  },
  {
    id: "rv-4",
    customerName: "Nodira K.",
    productName: "Bluetooth kolonka JBL",
    rating: 5,
    text: "Zo'r mahsulot, ovoz sifati ajoyib!",
    status: "approved",
    createdAt: "2026-05-01",
  },
];

export const initialLoyaltyRules: LoyaltyRule[] = [
  {
    id: "lr-1",
    type: "registration",
    name: "Ro'yxatdan o'tish bonusi",
    description: "Botga birinchi marta ro'yxatdan o'tgan mijozlarga ball bering",
    pointsValue: 100,
    active: true,
  },
  {
    id: "lr-2",
    type: "purchase",
    name: "Xarid uchun ballar",
    description: "Har bir buyurtma uchun sodiqlik ballarini to'plang",
    pointsValue: 1,
    purchaseRate: 1000,
    active: true,
  },
  {
    id: "lr-3",
    type: "spend_goal",
    name: "Ko'p sarfla, ko'p ol",
    description: "Minimal xarid miqdoridan oshsa qo'shimcha ball beriladi",
    pointsValue: 500,
    minSpend: 1000000,
    active: false,
  },
  {
    id: "lr-4",
    type: "review",
    name: "Sharh uchun ball",
    description: "Har bir mahsulot sharhi uchun ball oling",
    pointsValue: 50,
    active: true,
  },
];

export const initialLoyaltySettings: LoyaltySettings = {
  enabled: true,
  pointValue: 1,
};

export const initialGiveaways: GiveawayContest[] = [
  {
    id: "gw-1",
    title: "Smartfon sovg'a qilish",
    description: "Botimizga yoziling va sovrin yutib oling! Har oyda Samsung Galaxy sovg'a beramiz.",
    prizeType: "product",
    prizeCount: 1,
    productName: "Samsung Galaxy A55",
    audience: "all",
    endAt: "2026-05-31",
    status: "active",
    participantCount: 1247,
    createdAt: "2026-05-01",
  },
  {
    id: "gw-2",
    title: "Flash giveaway: 20% chegirma",
    description: "5 ta g'olib tanlangan! Har bir g'olib 20 foizlik chegirma kodini oladi.",
    prizeType: "discount",
    prizeCount: 5,
    discountType: "percent",
    discountValue: 20,
    audience: "new_subscribers",
    endAt: "2026-05-10",
    status: "draft",
    participantCount: 0,
    createdAt: "2026-05-04",
  },
];

export const initialTransactions: LoyaltyTransaction[] = [
  {
    id: "tx-1",
    customerName: "Dilshod T.",
    type: "earn",
    points: 250,
    balance: 350,
    description: "Xarid uchun ball (buyurtma #1042)",
    orderId: "#1042",
    createdAt: "2026-05-03 14:32",
  },
  {
    id: "tx-2",
    customerName: "Malika R.",
    type: "spend",
    points: -100,
    balance: 0,
    description: "Chegirma sifatida sarflandi",
    createdAt: "2026-05-03 11:15",
  },
  {
    id: "tx-3",
    customerName: "Jasur A.",
    type: "earn",
    points: 100,
    balance: 100,
    description: "Ro'yxatdan o'tish bonusi",
    createdAt: "2026-05-02 09:00",
  },
  {
    id: "tx-4",
    customerName: "Nodira K.",
    type: "earn",
    points: 50,
    balance: 450,
    description: "Mahsulot sharhi uchun ball",
    createdAt: "2026-05-01 16:45",
  },
  {
    id: "tx-5",
    customerName: "Alisher M.",
    type: "manual_add",
    points: 500,
    balance: 500,
    description: "Admin tomonidan qo'shildi — kompensatsiya",
    createdAt: "2026-04-30 10:00",
  },
  {
    id: "tx-6",
    customerName: "Dilshod T.",
    type: "earn",
    points: 100,
    balance: 100,
    description: "Ro'yxatdan o'tish bonusi",
    createdAt: "2026-04-28 08:30",
  },
];
