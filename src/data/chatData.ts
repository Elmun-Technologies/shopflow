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

export const funnelStageConfig: Record<FunnelStage, { color: string; bg: string; order: number }> = {
  new: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", order: 1 },
  greeting: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", order: 2 },
  needs_clarification: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", order: 3 },
  offer_sent: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", order: 4 },
  objection_handling: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", order: 5 },
  closing: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", order: 6 },
  won: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", order: 7 },
  lost: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", order: 8 },
  follow_up: { color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20", order: 9 },
};

export const chatStatusConfig: Record<ChatStatus, { color: string; label: string }> = {
  active: { color: "text-emerald-400", label: "Faol" },
  waiting: { color: "text-amber-400", label: "Kutilmoqda" },
  resolved: { color: "text-slate-400", label: "Yakunlandi" },
  archived: { color: "text-slate-500", label: "Arxiv" },
  spam: { color: "text-red-400", label: "Spam" },
};

export const agents: Agent[] = [];

export const quickReplies: QuickReply[] = [];

export const channelStats: { channel: ChatChannel; count: number }[] = [];

export const funnelStats: { stage: FunnelStage; count: number; value: number }[] = [];

export const conversations: ChatConversation[] = [];

export const hourlyChatVolume: { hour: string; incoming: number; outgoing: number }[] = [];
