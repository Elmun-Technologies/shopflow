/** Marketing moduli — lokal demo ma'lumotlari */

export type MarketingSub =
  | "popups"
  | "aksiyalar"
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
  popups: "Popup'lar",
  aksiyalar: "Aksiyalar",
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
  "popups",
  "aksiyalar",
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
export const initialEmailCampaigns: EmailCampaign[] = [];

export const initialPromoCodes: PromoCode[] = [];

export const initialGiftPromotions: GiftPromotion[] = [];

export const initialSources: MarketingSource[] = [];

export const initialSmsCampaigns: SmsCampaign[] = [];

export const initialChannelPosts: ChannelPost[] = [];

export const initialBanners: MarketingBanner[] = [];

export const initialReviews: ProductReview[] = [];

export const initialLoyaltyRules: LoyaltyRule[] = [];

export const initialLoyaltySettings: LoyaltySettings = {
  enabled: true,
  pointValue: 1,
};

export const initialGiveaways: GiveawayContest[] = [];

export const initialTransactions: LoyaltyTransaction[] = [];
