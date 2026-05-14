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

export const agents: Agent[] = [
  { id: "AG-001", name: "Dilshod Rahimov", avatar: "DR", status: "online", activeChats: 8, resolvedToday: 12, avgResponseTime: 45, csat: 4.8, channels: ["telegram", "whatsapp"] },
  { id: "AG-002", name: "Malika Yusupova", avatar: "MY", status: "online", activeChats: 6, resolvedToday: 9, avgResponseTime: 62, csat: 4.7, channels: ["instagram", "website"] },
  { id: "AG-003", name: "Azizbek Karimov", avatar: "AZ", status: "away", activeChats: 3, resolvedToday: 7, avgResponseTime: 38, csat: 4.9, channels: ["telegram", "website", "facebook"] },
  { id: "AG-004", name: "Nodira Azimova", avatar: "NA", status: "offline", activeChats: 0, resolvedToday: 5, avgResponseTime: 55, csat: 4.6, channels: ["whatsapp", "instagram"] },
];

export const quickReplies: QuickReply[] = [
  { id: "qr-1", title: "Salomlashish", text: "Assalomu alaykum! ShopFlow ga xush kelibsiz. Sizga qanday yordam bera olaman?", category: "Boshlang'ich" },
  { id: "qr-2", title: "Narx so'ralganda", text: "Albatta, mahsulot narxi: [NARX] so'm. Hozir chegirma mavjud!", category: "Savdo" },
  { id: "qr-3", title: "Yetkazib berish", text: "Yetkazib berish Toshkent bo'ylab 1-2 kun, viloyatlarga 3-5 kun. Yetkazib berish narxi: 30,000 so'm.", category: "Logistika" },
  { id: "qr-4", title: "Kafolat", text: "Barcha mahsulotlarimizga 1 yillik kafolat beriladi. Muammo yuzaga kelsa, bepul almashtiramiz.", category: "Qo'llab-quvvatlash" },
  { id: "qr-5", title: "To'lov usullari", text: "Naqd pul, karta, Click, Payme, Uzum orqali to'lash mumkin. Bo'lib to'lash ham mavjud!", category: "To'lov" },
  { id: "qr-6", title: "Zaxira yo'q", text: "Afsuski, bu mahsulot hozirda zaxirada yo'q. 5-7 kundan keyin yetib keladi. Xabar qoldirasizmi?", category: "Zaxira" },
  { id: "qr-7", title: "Chegirma", text: "Hozir maxsus chegirma! 15% chegirma + bepul yetkazib berish. Chegirma 3 kun davom etadi.", category: "Savdo" },
  { id: "qr-8", title: "Rahmat", text: "Xaridingiz uchun rahmat! Agar savollaringiz bo'lsa, murojaat qilishingiz mumkin. Yaxshi kun!", category: "Yakunlash" },
];

export const channelStats = [
  { channel: "telegram" as ChatChannel, active: 12, resolved: 45, avgResponse: 32, satisfaction: 4.8 },
  { channel: "whatsapp" as ChatChannel, active: 8, resolved: 38, avgResponse: 28, satisfaction: 4.7 },
  { channel: "instagram" as ChatChannel, active: 6, resolved: 29, avgResponse: 55, satisfaction: 4.5 },
  { channel: "website" as ChatChannel, active: 5, resolved: 22, avgResponse: 18, satisfaction: 4.9 },
  { channel: "facebook" as ChatChannel, active: 3, resolved: 14, avgResponse: 67, satisfaction: 4.3 },
  { channel: "vk" as ChatChannel, active: 1, resolved: 5, avgResponse: 120, satisfaction: 4.1 },
  { channel: "email" as ChatChannel, active: 2, resolved: 8, avgResponse: 240, satisfaction: 4.4 },
  { channel: "sms" as ChatChannel, active: 1, resolved: 3, avgResponse: 15, satisfaction: 4.6 },
];

export const funnelStats = [
  { stage: "new" as FunnelStage, count: 18, value: 0 },
  { stage: "greeting" as FunnelStage, count: 14, value: 0 },
  { stage: "needs_clarification" as FunnelStage, count: 11, value: 12500000 },
  { stage: "offer_sent" as FunnelStage, count: 9, value: 28900000 },
  { stage: "objection_handling" as FunnelStage, count: 6, value: 19800000 },
  { stage: "closing" as FunnelStage, count: 4, value: 14500000 },
  { stage: "won" as FunnelStage, count: 7, value: 52600000 },
  { stage: "lost" as FunnelStage, count: 3, value: 8700000 },
  { stage: "follow_up" as FunnelStage, count: 5, value: 0 },
];

export const conversations: ChatConversation[] = [
  {
    id: "CH-2024001",
    customerId: "CUS-10001",
    customerName: "Azizbek Karimov",
    customerAvatar: "AK",
    customerPhone: "+998 90 123 45 67",
    channel: "telegram",
    status: "active",
    funnelStage: "closing",
    assignedAgent: "Dilshod Rahimov",
    agentAvatar: "DR",
    lastMessage: "Narx ma'qul, lekin yetkazib berish bepul bo'ladimi?",
    lastMessageTime: "14:32",
    unreadCount: 2,
    priority: "high",
    estimatedValue: 14500000,
    createdAt: "2024-12-15 09:15",
    firstResponseTime: 120,
    avgResponseTime: 180,
    csat: 5,
    tags: ["yirik", "qayta_mijoz", "tezkor"],
    messages: [
      { id: "M-001", sender: "customer", text: "Salom, iPhone 15 Pro Max borimi?", timestamp: "09:15", read: true },
      { id: "M-002", sender: "agent", text: "Assalomu alaykum! Ha, albatta. 256GB va 512GB xotira hajmi mavjud. Qaysi rangni xohlaysiz?", timestamp: "09:17", read: true },
      { id: "M-003", sender: "customer", text: "256GB Natural Titanium qancha turadi?", timestamp: "09:20", read: true },
      { id: "M-004", sender: "agent", text: "Narxi 14,500,000 so'm. Hozir maxsus chegirma! 13,800,000 so'mga beramiz + bepul qo'l himoyasi.", timestamp: "09:22", read: true },
      { id: "M-005", sender: "customer", text: "Yaxshi, lekin men 3 ta olmoqchiman. Optom narx bormi?", timestamp: "09:30", read: true },
      { id: "M-006", sender: "agent", text: "3 ta uchun maxsus narx: har biri 13,200,000 so'm. Jami 39,600,000 so'm. + Bepul yetkazib berish.", timestamp: "09:35", read: true },
      { id: "M-007", sender: "customer", text: "Narx ma'qul, lekin yetkazib berish bepul bo'ladimi?", timestamp: "14:32", read: false },
    ],
  },
  {
    id: "CH-2024002",
    customerId: "CUS-10004",
    customerName: "Gulnora Saidova",
    customerAvatar: "GS",
    customerPhone: "+998 94 456 78 90",
    channel: "instagram",
    status: "active",
    funnelStage: "needs_clarification",
    assignedAgent: "Malika Yusupova",
    agentAvatar: "MY",
    lastMessage: "Rahmat, katalogni ko'rib chiqaman va qaytib qo'ng'iroq qilaman",
    lastMessageTime: "13:45",
    unreadCount: 0,
    priority: "medium",
    estimatedValue: 3200000,
    createdAt: "2024-12-15 07:30",
    firstResponseTime: 300,
    avgResponseTime: 450,
    csat: 4,
    tags: ["yangi", "kiyim"],
    messages: [
      { id: "M-010", sender: "customer", text: "Assalomu alaykum, kiyimlaringizni ko'rmoqchiman", timestamp: "07:30", read: true },
      { id: "M-011", sender: "agent", text: "Xush kelibsiz! Kiyim-kechak bo'limimizda 200+ turdagi mahsulotlar mavjud. Qaysi kategoriya qiziqtiradi?", timestamp: "07:35", read: true },
      { id: "M-012", sender: "customer", text: "Ayollar kiyimlari va aksessuarlar", timestamp: "07:40", read: true },
      { id: "M-013", sender: "agent", text: "Ajoyib! Katalogni yuboraman: [link]. Hozir chegirma: 20% gacha. S-M-L-XL o'lchamlar bor.", timestamp: "07:42", read: true },
      { id: "M-014", sender: "customer", text: "Rahmat, katalogni ko'rib chiqaman va qaytib qo'ng'iroq qilaman", timestamp: "13:45", read: true },
    ],
  },
  {
    id: "CH-2024003",
    customerId: "CUS-10008",
    customerName: "Zarina Umarova",
    customerAvatar: "ZU",
    customerPhone: "+998 99 890 12 34",
    channel: "website",
    status: "waiting",
    funnelStage: "offer_sent",
    assignedAgent: "Azizbek Karimov",
    agentAvatar: "AZ",
    lastMessage: "Sizga qanday yordam bera olaman?",
    lastMessageTime: "14:15",
    unreadCount: 0,
    priority: "medium",
    estimatedValue: 4500000,
    createdAt: "2024-12-15 08:15",
    firstResponseTime: 60,
    avgResponseTime: 90,
    csat: 5,
    tags: ["yangi", "katalog"],
    messages: [
      { id: "M-020", sender: "system", text: "Mijoz veb-sayt orqali chatni ochdi", timestamp: "08:15", read: true },
      { id: "M-021", sender: "bot", text: "Assalomu alaykum! Sizni qiziqtirgan mahsulotni tanlang yoki savolingizni yozing.", timestamp: "08:15", read: true },
      { id: "M-022", sender: "customer", text: "Erkaklar kiyimlari", timestamp: "08:16", read: true },
      { id: "M-023", sender: "bot", text: "Erkaklar bo'limi: Ko'ylaklar, Shimlar, Kastyumlar, Aksessuarlar. Qaysi birini ko'rmoqchisiz?", timestamp: "08:16", read: true },
      { id: "M-024", sender: "customer", text: "Kozok ko'ylaklari", timestamp: "08:17", read: true },
      { id: "M-025", sender: "agent", text: "Assalomu alaykum! Kozok ko'ylaklarimiz 285,000 so'mdan boshlanadi. 15 ta turdagi rang mavjud. O'lcham S-3XL. Katalog: [link]", timestamp: "08:18", read: true },
      { id: "M-026", sender: "customer", text: "4 ta olishim kerak, optom narx bormi?", timestamp: "08:25", read: true },
      { id: "M-027", sender: "agent", text: "4 ta uchun: har biri 255,000 so'm (10% chegirma). Jami 1,020,000 so'm. + Bepul yetkazib berish.", timestamp: "08:30", read: true },
      { id: "M-028", sender: "customer", text: "Yaxshi, qo'shimcha 2 ta ayollar kiyimi ham olmoqchiman", timestamp: "14:10", read: true },
      { id: "M-029", sender: "agent", text: "Sizga qanday yordam bera olaman?", timestamp: "14:15", read: false },
    ],
  },
  {
    id: "CH-2024004",
    customerId: "CUS-10003",
    customerName: "Jasurbek Toshmatov",
    customerAvatar: "JT",
    customerPhone: "+998 93 345 67 89",
    channel: "whatsapp",
    status: "active",
    funnelStage: "objection_handling",
    assignedAgent: "Dilshod Rahimov",
    agentAvatar: "DR",
    lastMessage: "Boshqa joyda 480,000 so'm turibdi, sizda qimmatroq ekan",
    lastMessageTime: "14:05",
    unreadCount: 1,
    priority: "high",
    estimatedValue: 5200000,
    createdAt: "2024-12-14 11:00",
    firstResponseTime: 240,
    avgResponseTime: 360,
    csat: 4,
    tags: ["optom", "sport", "narx_itirozi"],
    messages: [
      { id: "M-030", sender: "customer", text: "Salom, 5 ta gantel to'plami kerak. Narx qancha?", timestamp: "11:00", read: true },
      { id: "M-031", sender: "agent", text: "Assalomu alaykum! 20kg gantel to'plami 520,000 so'm. 5 ta uchun: 2,600,000 so'm. Optom chegirma: 8%.", timestamp: "11:05", read: true },
      { id: "M-032", sender: "customer", text: "Boshqa joyda 480,000 so'm turibdi, sizda qimmatroq ekan", timestamp: "14:05", read: false },
    ],
  },
  {
    id: "CH-2024005",
    customerId: "CUS-10006",
    customerName: "Dilnoza Rahimova",
    customerAvatar: "DR",
    customerPhone: "+998 97 678 90 12",
    channel: "facebook",
    status: "active",
    funnelStage: "greeting",
    assignedAgent: "Malika Yusupova",
    agentAvatar: "MY",
    lastMessage: "Kitoblar bo'limi haqida ma'lumot olishim mumkinmi?",
    lastMessageTime: "14:00",
    unreadCount: 1,
    priority: "low",
    estimatedValue: 1850000,
    createdAt: "2024-12-15 14:00",
    firstResponseTime: 0,
    avgResponseTime: 0,
    csat: 0,
    tags: ["yangi", "kitob"],
    messages: [
      { id: "M-040", sender: "customer", text: "Kitoblar bo'limi haqida ma'lumot olishim mumkinmi?", timestamp: "14:00", read: false },
    ],
  },
  {
    id: "CH-2024006",
    customerId: "CUS-10011",
    customerName: "Kamoliddin Ismoilov",
    customerAvatar: "KI",
    customerPhone: "+998 93 123 45 67",
    channel: "telegram",
    status: "active",
    funnelStage: "offer_sent",
    assignedAgent: "Azizbek Karimov",
    agentAvatar: "AZ",
    lastMessage: "5 ta planshet uchun chegirma yana oshiriladimi?",
    lastMessageTime: "13:50",
    unreadCount: 1,
    priority: "high",
    estimatedValue: 34000000,
    createdAt: "2024-12-09 13:40",
    firstResponseTime: 90,
    avgResponseTime: 150,
    csat: 5,
    tags: ["optom", "ta'lim", "yirik"],
    messages: [
      { id: "M-050", sender: "customer", text: "5 ta Samsung Galaxy Tab S9 kerak. Optom narx?", timestamp: "13:40", read: true },
      { id: "M-051", sender: "agent", text: "Assalomu alaykum! Galaxy Tab S9 narxi 6,800,000 so'm. 5 ta uchun: 8% chegirma = 31,280,000 so'm.", timestamp: "13:42", read: true },
      { id: "M-052", sender: "customer", text: "5 ta planshet uchun chegirma yana oshiriladimi?", timestamp: "13:50", read: false },
    ],
  },
  {
    id: "CH-2024007",
    customerId: "CUS-10009",
    customerName: "Otabek Xolmatov",
    customerAvatar: "OX",
    customerPhone: "+998 90 901 23 45",
    channel: "telegram_bot",
    status: "resolved",
    funnelStage: "won",
    assignedAgent: "Dilshod Rahimov",
    agentAvatar: "DR",
    lastMessage: "Buyurtmangiz tasdiqlandi! Yetkazib berish: 16.12.2024",
    lastMessageTime: "12:30",
    unreadCount: 0,
    priority: "medium",
    estimatedValue: 8400000,
    createdAt: "2024-12-11 09:00",
    firstResponseTime: 45,
    avgResponseTime: 120,
    csat: 5,
    tags: ["doimiy", "texnika"],
    messages: [
      { id: "M-060", sender: "customer", text: "2 ta Artel konditsioner kerak. Narx va muddat?", timestamp: "09:00", read: true },
      { id: "M-061", sender: "agent", text: "Assalomu alaykum! Artel 12 000 BTU narxi 4,200,000 so'm. 2 ta = 8,400,000 so'm. O'rnatish bepul. Muddati: ertaga yetkazamiz.", timestamp: "09:02", read: true },
      { id: "M-062", sender: "customer", text: "Zo'r, buyurtma beraman. Manzil: Buxoro, Navoiy ko'chasi", timestamp: "09:10", read: true },
      { id: "M-063", sender: "agent", text: "Buyurtmangiz tasdiqlandi! Yetkazib berish: 16.12.2024. To'lov: naqd yoki karta.", timestamp: "12:30", read: true },
    ],
  },
  {
    id: "CH-2024008",
    customerId: "CUS-10002",
    customerName: "Nodira Azimova",
    customerAvatar: "NA",
    customerPhone: "+998 91 234 56 78",
    channel: "website",
    status: "active",
    funnelStage: "new",
    assignedAgent: "Malika Yusupova",
    agentAvatar: "MY",
    lastMessage: "Bo'lib to'lash shartlari qanday?",
    lastMessageTime: "13:20",
    unreadCount: 1,
    priority: "medium",
    estimatedValue: 8900000,
    createdAt: "2024-12-12 14:10",
    firstResponseTime: 30,
    avgResponseTime: 60,
    csat: 4,
    tags: ["yangi", "bo'lib_to'lash"],
    messages: [
      { id: "M-070", sender: "customer", text: "MacBook Air M3 haqida ma'lumot", timestamp: "14:10", read: true },
      { id: "M-071", sender: "agent", text: "Assalomu alaykum! MacBook Air M3 15\" narxi 18,500,000 so'm. 8GB RAM, 256GB SSD. 3 rang mavjud.", timestamp: "14:12", read: true },
      { id: "M-072", sender: "customer", text: "Bo'lib to'lash shartlari qanday?", timestamp: "13:20", read: false },
    ],
  },
];

export const hourlyChatVolume = [
  { hour: "08:00", incoming: 3, resolved: 2 },
  { hour: "09:00", incoming: 5, resolved: 3 },
  { hour: "10:00", incoming: 8, resolved: 5 },
  { hour: "11:00", incoming: 12, resolved: 8 },
  { hour: "12:00", incoming: 15, resolved: 10 },
  { hour: "13:00", incoming: 10, resolved: 9 },
  { hour: "14:00", incoming: 18, resolved: 12 },
  { hour: "15:00", incoming: 14, resolved: 11 },
  { hour: "16:00", incoming: 9, resolved: 8 },
  { hour: "17:00", incoming: 6, resolved: 5 },
  { hour: "18:00", incoming: 4, resolved: 3 },
];
