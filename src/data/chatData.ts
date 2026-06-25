export interface ChatMessage {
  id: string;
  sender: "agent" | "customer" | "system" | "bot";
  text: string;
  timestamp: string;
  read: boolean;
  attachments?: { type: "image" | "file" | "voice"; name: string; url?: string }[];
}

export interface ChatConversation {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar: string;
  customerPhone: string;
  channel: ChatChannel;
  status: ChatStatus;
  funnelStage: FunnelStage;
  assignedAgent: string;
  agentAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: ChatMessage[];
  tags: string[];
  priority: "high" | "medium" | "low";
  estimatedValue: number;
  createdAt: string;
  firstResponseTime?: number;
  avgResponseTime?: number;
  csat?: number;
}

export type ChatChannel =
  | "telegram"
  | "telegram_bot"
  | "whatsapp"
  | "instagram"
  | "website"
  | "facebook"
  | "vk"
  | "email"
  | "sms";

export type ChatStatus = "active" | "waiting" | "resolved" | "archived" | "spam";

export type FunnelStage =
  | "new"
  | "greeting"
  | "needs_clarification"
  | "offer_sent"
  | "objection_handling"
  | "closing"
  | "won"
  | "lost"
  | "follow_up";

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
  activeChats: number;
  resolvedToday: number;
  avgResponseTime: number;
  csat: number;
  channels: ChatChannel[];
}

export interface QuickReply {
  id: string;
  title: string;
  text: string;
  category: string;
}

export const channelLabels: Record<ChatChannel, string> = {
  telegram: "Telegram",
  telegram_bot: "Telegram Bot",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  website: "Veb-chat",
  facebook: "Facebook",
  vk: "VK",
  email: "Email",
  sms: "SMS",
};

export const funnelStageLabels: Record<FunnelStage, string> = {
  new: "Yangi",
  greeting: "Salomlashish",
  needs_clarification: "Ehtiyoj aniqlash",
  offer_sent: "Taklif yuborildi",
  objection_handling: "Itirozlarni hal qilish",
  closing: "Yopish",
  won: "Sotildi",
  lost: "Yoqotildi",
  follow_up: "Qayta aloqa",
};

// Light admin tema: text-*-600 + bg-*-100/border-*-200 (pastel pill, o'qilishi yaxshi).
// hex — funnel bar to'ldirishi uchun (ChatPage'da oldin mo'rt .replace() zanjiri edi).
export const funnelStageConfig: Record<FunnelStage, { color: string; bg: string; hex: string; order: number }> = {
  new: { color: "text-slate-600", bg: "bg-slate-100 border-slate-200", hex: "#64748b", order: 1 },
  greeting: { color: "text-blue-600", bg: "bg-blue-100 border-blue-200", hex: "#3b82f6", order: 2 },
  needs_clarification: { color: "text-cyan-600", bg: "bg-cyan-100 border-cyan-200", hex: "#06b6d4", order: 3 },
  offer_sent: { color: "text-violet-600", bg: "bg-violet-100 border-violet-200", hex: "#8b5cf6", order: 4 },
  objection_handling: { color: "text-amber-600", bg: "bg-amber-100 border-amber-200", hex: "#f59e0b", order: 5 },
  closing: { color: "text-orange-600", bg: "bg-orange-100 border-orange-200", hex: "#f97316", order: 6 },
  won: { color: "text-leaf-600", bg: "bg-leaf-100 border-leaf-200", hex: "#5FA340", order: 7 },
  lost: { color: "text-red-600", bg: "bg-red-100 border-red-200", hex: "#ef4444", order: 8 },
  follow_up: { color: "text-pink-600", bg: "bg-pink-100 border-pink-200", hex: "#ec4899", order: 9 },
};

export const chatStatusConfig: Record<ChatStatus, { color: string; label: string }> = {
  active: { color: "text-leaf-600", label: "Faol" },
  waiting: { color: "text-amber-600", label: "Kutilmoqda" },
  resolved: { color: "text-slate-500", label: "Yakunlandi" },
  archived: { color: "text-slate-500", label: "Arxiv" },
  spam: { color: "text-red-600", label: "Spam" },
};

export const agents: Agent[] = [];

export const quickReplies: QuickReply[] = [];

export const channelStats: { channel: ChatChannel; count: number }[] = [];

export const funnelStats: { stage: FunnelStage; count: number; value: number }[] = [];

export const conversations: ChatConversation[] = [];

export const hourlyChatVolume: { hour: string; incoming: number; outgoing: number }[] = [];
