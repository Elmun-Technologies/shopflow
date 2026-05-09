export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  status: LeadStatus;
  stage: LeadStage;
  value: number;
  currency: string;
  assignedTo: string;
  assignedAvatar: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastContact: string;
  nextFollowUp: string;
  interactions: LeadInteraction[];
  company?: string;
  position?: string;
  location?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  priority: "high" | "medium" | "low";
}

export interface LeadInteraction {
  id: string;
  type: "call" | "email" | "sms" | "whatsapp" | "telegram" | "meeting" | "note" | "status_change";
  direction: "inbound" | "outbound";
  content: string;
  createdAt: string;
  createdBy: string;
  duration?: number;
}

export type LeadSource =
  | "website"
  | "instagram"
  | "telegram"
  | "facebook"
  | "whatsapp"
  | "email"
  | "phone"
  | "referral"
  | "google_ads"
  | "yandex_direct"
  | "marketplace"
  | "offline"
  | "landing_page";

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export type LeadStage = "incoming" | "processing" | "pipeline" | "closed";

export interface SourceStat {
  source: LeadSource;
  count: number;
  converted: number;
  value: number;
  trend: number;
}

export const sourceLabels: Record<LeadSource, string> = {
  website: "Veb-sayt",
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Telefon",
  referral: "Referral",
  google_ads: "Google Ads",
  yandex_direct: "Yandex Direct",
  marketplace: "Marketplace",
  offline: "Ofline",
  landing_page: "Landing Page",
};

export const statusLabels: Record<LeadStatus, string> = {
  new: "Yangi",
  contacted: "Bog'lanildi",
  qualified: "Saralangan",
  proposal: "Taklif",
  negotiation: "Muzokara",
  won: "Yutuq",
  lost: "Yoqotildi",
};

export const statusConfig: Record<LeadStatus, { color: string; bg: string; stage: LeadStage }> = {
  new: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", stage: "incoming" },
  contacted: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", stage: "processing" },
  qualified: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", stage: "processing" },
  proposal: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", stage: "pipeline" },
  negotiation: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", stage: "pipeline" },
  won: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", stage: "closed" },
  lost: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", stage: "closed" },
};

export const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Yuqori" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "O'rta" },
  low: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "Past" },
};

export const interactionTypeConfig: Record<string, { icon: string; label: string; color: string }> = {
  call: { icon: "Phone", label: "Qo'ng'iroq", color: "text-emerald-400" },
  email: { icon: "Mail", label: "Email", color: "text-blue-400" },
  sms: { icon: "MessageSquare", label: "SMS", color: "text-violet-400" },
  whatsapp: { icon: "MessageCircle", label: "WhatsApp", color: "text-green-400" },
  telegram: { icon: "Send", label: "Telegram", color: "text-sky-400" },
  meeting: { icon: "Users", label: "Uchrashuv", color: "text-amber-400" },
  note: { icon: "FileText", label: "Eslatma", color: "text-slate-400" },
  status_change: { icon: "GitBranch", label: "Status o'zgarishi", color: "text-cyan-400" },
};

export const sourceStats: SourceStat[] = [
  { source: "website", count: 234, converted: 45, value: 125000000, trend: 12.5 },
  { source: "instagram", count: 189, converted: 32, value: 89000000, trend: 8.3 },
  { source: "telegram", count: 156, converted: 28, value: 67000000, trend: 15.2 },
  { source: "facebook", count: 98, converted: 15, value: 42000000, trend: -3.1 },
  { source: "whatsapp", count: 87, converted: 22, value: 51000000, trend: 22.4 },
  { source: "google_ads", count: 76, converted: 18, value: 78000000, trend: 18.7 },
  { source: "yandex_direct", count: 54, converted: 9, value: 34000000, trend: 5.2 },
  { source: "referral", count: 43, converted: 19, value: 95000000, trend: 31.0 },
  { source: "email", count: 32, converted: 5, value: 18000000, trend: -8.5 },
  { source: "phone", count: 28, converted: 8, value: 28000000, trend: 2.1 },
  { source: "marketplace", count: 21, converted: 6, value: 22000000, trend: 14.3 },
  { source: "landing_page", count: 19, converted: 7, value: 35000000, trend: 9.8 },
  { source: "offline", count: 12, converted: 4, value: 19000000, trend: -1.2 },
];

export const leads: Lead[] = [
  {
    id: "LID-2024001",
    name: "Azizbek Karimov",
    phone: "+998 90 123 45 67",
    email: "aziz.karimov@email.com",
    source: "instagram",
    status: "negotiation",
    stage: "pipeline",
    value: 14500000,
    currency: "UZS",
    assignedTo: "Dilshod Rahimov",
    assignedAvatar: "DR",
    notes: "iPhone 15 Pro Max 3 ta dona. Yetkazib berish shartnomasi ko'rib chiqilmoqda.",
    tags: ["yirik", "qayta_mijoz"],
    createdAt: "2024-12-10 09:23",
    updatedAt: "2024-12-15 14:30",
    lastContact: "2024-12-15 14:30",
    nextFollowUp: "2024-12-16 10:00",
    company: "Karimov Trade LLC",
    position: "Direktor",
    location: "Toshkent",
    utmSource: "instagram",
    utmMedium: "story",
    utmCampaign: "winter_sale_2024",
    priority: "high",
    interactions: [
      { id: "INT-001", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Instagram story orqali", createdAt: "2024-12-10 09:23", createdBy: "Tizim" },
      { id: "INT-002", type: "call", direction: "outbound", content: "Birinchi qo'ng'iroq. 3 ta iPhone 15 Pro Max buyurtma qilmoqchi. Narx masalasi muhokama qilindi.", createdAt: "2024-12-10 11:15", createdBy: "Dilshod Rahimov", duration: 420 },
      { id: "INT-003", type: "email", direction: "outbound", content: "Narxlar ro'yxati yuborildi. 3 ta telefon uchun chegirma taklif qilindi.", createdAt: "2024-12-10 14:00", createdBy: "Dilshod Rahimov" },
      { id: "INT-004", type: "whatsapp", direction: "inbound", content: "Narx ma'qul, lekin yetkazib berish shartlari haqida gaplashish kerak.", createdAt: "2024-12-11 09:30", createdBy: "Azizbek Karimov" },
      { id: "INT-005", type: "meeting", direction: "outbound", content: "Ofisda uchrashuv. Yetkazib berish shartlari muhokama qilindi.", createdAt: "2024-12-12 15:00", createdBy: "Dilshod Rahimov", duration: 3600 },
      { id: "INT-006", type: "status_change", direction: "outbound", content: "Status: Muzokara", createdAt: "2024-12-15 14:30", createdBy: "Dilshod Rahimov" },
    ],
  },
  {
    id: "LID-2024002",
    name: "Nodira Azimova",
    phone: "+998 91 234 56 78",
    email: "nodira.azimova@gmail.com",
    source: "google_ads",
    status: "proposal",
    stage: "pipeline",
    value: 8900000,
    currency: "UZS",
    assignedTo: "Malika Yusupova",
    assignedAvatar: "MY",
    notes: "MacBook Air M3. To'lov bo'yicha bo'lib to'lash so'raldi.",
    tags: ["yangi"],
    createdAt: "2024-12-12 14:10",
    updatedAt: "2024-12-14 16:45",
    lastContact: "2024-12-14 16:45",
    nextFollowUp: "2024-12-17 11:00",
    company: "IT Solutions",
    position: "Dasturchi",
    location: "Samarqand",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "macbook_search",
    priority: "medium",
    interactions: [
      { id: "INT-007", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Google Ads orqali", createdAt: "2024-12-12 14:10", createdBy: "Tizim" },
      { id: "INT-008", type: "call", direction: "outbound", content: "MacBook Air M3 haqida ma'lumot berildi. Bo'lib to'lash imkoniyati tushuntirildi.", createdAt: "2024-12-13 10:00", createdBy: "Malika Yusupova", duration: 300 },
      { id: "INT-009", type: "email", direction: "outbound", content: "Bo'lib to'lash shartlari va narxlar ro'yxati yuborildi.", createdAt: "2024-12-13 12:30", createdBy: "Malika Yusupova" },
      { id: "INT-010", type: "status_change", direction: "outbound", content: "Status: Taklif", createdAt: "2024-12-14 16:45", createdBy: "Malika Yusupova" },
    ],
  },
  {
    id: "LID-2024003",
    name: "Jasurbek Toshmatov",
    phone: "+998 93 345 67 89",
    email: "jasur.toshmatov@mail.ru",
    source: "telegram",
    status: "qualified",
    stage: "processing",
    value: 5200000,
    currency: "UZS",
    assignedTo: "Dilshod Rahimov",
    assignedAvatar: "DR",
    notes: "Sport anjomlari. Jismoniy tarbiya ustozi, maktab uchun.",
    tags: ["optom", "ta'lim"],
    createdAt: "2024-12-11 08:45",
    updatedAt: "2024-12-13 11:20",
    lastContact: "2024-12-13 11:20",
    nextFollowUp: "2024-12-16 09:00",
    company: "47-maktab",
    position: "Jismoniy tarbiya ustozi",
    location: "Toshkent",
    priority: "medium",
    interactions: [
      { id: "INT-011", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Telegram kanal orqali", createdAt: "2024-12-11 08:45", createdBy: "Tizim" },
      { id: "INT-012", type: "telegram", direction: "inbound", content: "Salom, maktabimiz uchun sport anjomlari kerak. Narxlar qanday?", createdAt: "2024-12-11 08:45", createdBy: "Jasurbek Toshmatov" },
      { id: "INT-013", type: "telegram", direction: "outbound", content: "Assalomu alaykum! Katalog yuborildi. Optom narxlar alohida.", createdAt: "2024-12-11 09:00", createdBy: "Dilshod Rahimov" },
      { id: "INT-014", type: "call", direction: "outbound", content: "Qo'ng'iroq. 15 ta gantel, 10 ta mat kerak. Byudjet: 5-6 mln.", createdAt: "2024-12-12 14:00", createdBy: "Dilshod Rahimov", duration: 240 },
      { id: "INT-015", type: "status_change", direction: "outbound", content: "Status: Saralangan", createdAt: "2024-12-13 11:20", createdBy: "Dilshod Rahimov" },
    ],
  },
  {
    id: "LID-2024004",
    name: "Gulnora Saidova",
    phone: "+998 94 456 78 90",
    email: "gulnora.saidova@yandex.ru",
    source: "website",
    status: "new",
    stage: "incoming",
    value: 3200000,
    currency: "UZS",
    assignedTo: "Malika Yusupova",
    assignedAvatar: "MY",
    notes: "Veb-sayt orqali zayavka. Kiyim-kechak bo'limi.",
    tags: ["yangi", "retail"],
    createdAt: "2024-12-15 07:30",
    updatedAt: "2024-12-15 07:30",
    lastContact: "2024-12-15 07:30",
    nextFollowUp: "2024-12-15 12:00",
    location: "Farg'ona",
    utmSource: "website",
    utmMedium: "organic",
    priority: "high",
    interactions: [
      { id: "INT-016", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Veb-sayt orqali", createdAt: "2024-12-15 07:30", createdBy: "Tizim" },
    ],
  },
  {
    id: "LID-2024005",
    name: "Bekzod Mirzaev",
    phone: "+998 95 567 89 01",
    email: "bekzod.mirzaev@outlook.com",
    source: "referral",
    status: "won",
    stage: "closed",
    value: 21000000,
    currency: "UZS",
    assignedTo: "Dilshod Rahimov",
    assignedAvatar: "DR",
    notes: "Do'sti orqali yo'naltirilgan. Ofis jihozlari. Katta buyurtma.",
    tags: ["yirik", "qayta_mijoz", "referral"],
    createdAt: "2024-12-05 10:00",
    updatedAt: "2024-12-14 17:00",
    lastContact: "2024-12-14 17:00",
    nextFollowUp: "2024-12-20 10:00",
    company: "Mirzaev Group",
    position: "Xo'jayin",
    location: "Toshkent",
    priority: "high",
    interactions: [
      { id: "INT-017", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Referral (Azizbek Karimov)", createdAt: "2024-12-05 10:00", createdBy: "Tizim" },
      { id: "INT-018", type: "call", direction: "outbound", content: "Birinchi qo'ng'iroq. Ofis uchun 10 ta noutbuk, 5 ta printer kerak.", createdAt: "2024-12-05 11:30", createdBy: "Dilshod Rahimov", duration: 600 },
      { id: "INT-019", type: "meeting", direction: "outbound", content: "Ofisda uchrashuv. Texnik xususiyatlar muhokama qilindi.", createdAt: "2024-12-07 14:00", createdBy: "Dilshod Rahimov", duration: 5400 },
      { id: "INT-020", type: "email", direction: "outbound", content: "Taklifnoma yuborildi. Umumiy summa: 21,000,000 so'm", createdAt: "2024-12-08 10:00", createdBy: "Dilshod Rahimov" },
      { id: "INT-021", type: "call", direction: "inbound", content: "Taklif ma'qul. Shartnoma tuzishga tayyormiz.", createdAt: "2024-12-10 16:00", createdBy: "Bekzod Mirzaev", duration: 180 },
      { id: "INT-022", type: "status_change", direction: "outbound", content: "Status: Yutuq", createdAt: "2024-12-14 17:00", createdBy: "Dilshod Rahimov" },
    ],
  },
  {
    id: "LID-2024006",
    name: "Dilnoza Rahimova",
    phone: "+998 97 678 90 12",
    email: "dilnoza.r@icloud.com",
    source: "facebook",
    status: "contacted",
    stage: "processing",
    value: 1850000,
    currency: "UZS",
    assignedTo: "Malika Yusupova",
    assignedAvatar: "MY",
    notes: "Facebook reklama orqali. Kitoblar bo'limi.",
    tags: ["yangi"],
    createdAt: "2024-12-13 16:20",
    updatedAt: "2024-12-14 10:15",
    lastContact: "2024-12-14 10:15",
    nextFollowUp: "2024-12-16 14:00",
    location: "Namangan",
    utmSource: "facebook",
    utmMedium: "paid",
    utmCampaign: "books_promo",
    priority: "low",
    interactions: [
      { id: "INT-023", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Facebook Ads orqali", createdAt: "2024-12-13 16:20", createdBy: "Tizim" },
      { id: "INT-024", type: "call", direction: "outbound", content: "Kitoblar katalogi haqida ma'lumot berildi. 50 ta kitob kerak.", createdAt: "2024-12-14 10:15", createdBy: "Malika Yusupova", duration: 180 },
      { id: "INT-025", type: "status_change", direction: "outbound", content: "Status: Bog'lanildi", createdAt: "2024-12-14 10:15", createdBy: "Malika Yusupova" },
    ],
  },
  {
    id: "LID-2024007",
    name: "Sherzod Aliyev",
    phone: "+998 98 789 01 23",
    email: "sherzod.aliev@bk.ru",
    source: "whatsapp",
    status: "lost",
    stage: "closed",
    value: 6700000,
    currency: "UZS",
    assignedTo: "Dilshod Rahimov",
    assignedAvatar: "DR",
    notes: "Narx juda baland deb qoldi. Raqobatchi narxlarni taklif qilgan.",
    tags: ["narx", "raqobat"],
    createdAt: "2024-12-01 09:00",
    updatedAt: "2024-12-10 11:00",
    lastContact: "2024-12-10 11:00",
    nextFollowUp: "2024-12-17 10:00",
    location: "Andijon",
    priority: "medium",
    interactions: [
      { id: "INT-026", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - WhatsApp orqali", createdAt: "2024-12-01 09:00", createdBy: "Tizim" },
      { id: "INT-027", type: "whatsapp", direction: "inbound", content: "Samsung S24 Ultra narxi qancha?", createdAt: "2024-12-01 09:00", createdBy: "Sherzod Aliyev" },
      { id: "INT-028", type: "whatsapp", direction: "outbound", content: "13,200,000 so'm. 1 yil kafolat.", createdAt: "2024-12-01 09:15", createdBy: "Dilshod Rahimov" },
      { id: "INT-029", type: "call", direction: "outbound", content: "Qo'ng'iroq. Mijoz raqobatchi narxlarni solishtirayotganini aytdi.", createdAt: "2024-12-03 14:00", createdBy: "Dilshod Rahimov", duration: 300 },
      { id: "INT-030", type: "whatsapp", direction: "inbound", content: "Rahmat, lekin boshqa joyda arzonroq. Keyinroq bog'lanaman.", createdAt: "2024-12-10 11:00", createdBy: "Sherzod Aliyev" },
      { id: "INT-031", type: "status_change", direction: "outbound", content: "Status: Yoqotildi - Narx sababli", createdAt: "2024-12-10 11:00", createdBy: "Dilshod Rahimov" },
    ],
  },
  {
    id: "LID-2024008",
    name: "Zarina Umarova",
    phone: "+998 99 890 12 34",
    email: "zarina.umarova@gmail.com",
    source: "landing_page",
    status: "new",
    stage: "incoming",
    value: 4500000,
    currency: "UZS",
    assignedTo: "Malika Yusupova",
    assignedAvatar: "MY",
    notes: "Yozgi chegirma landing page orqali. Kiyim-kechak.",
    tags: ["yangi", "chegirma"],
    createdAt: "2024-12-15 06:15",
    updatedAt: "2024-12-15 06:15",
    lastContact: "2024-12-15 06:15",
    nextFollowUp: "2024-12-15 14:00",
    location: "Qarshi",
    utmSource: "landing",
    utmMedium: "email",
    utmCampaign: "summer_sale_lp",
    priority: "medium",
    interactions: [
      { id: "INT-032", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Landing Page orqali", createdAt: "2024-12-15 06:15", createdBy: "Tizim" },
    ],
  },
  {
    id: "LID-2024009",
    name: "Otabek Xolmatov",
    phone: "+998 90 901 23 45",
    email: "otabek.xolmatov@mail.ru",
    source: "yandex_direct",
    status: "qualified",
    stage: "processing",
    value: 12800000,
    currency: "UZS",
    assignedTo: "Dilshod Rahimov",
    assignedAvatar: "DR",
    notes: "Maishiy texnika. Xolodilnik va konditsioner.",
    tags: ["yangi", "texnika"],
    createdAt: "2024-12-09 13:40",
    updatedAt: "2024-12-12 16:00",
    lastContact: "2024-12-12 16:00",
    nextFollowUp: "2024-12-16 11:00",
    company: "Xolmatov Family",
    location: "Buxoro",
    utmSource: "yandex",
    utmMedium: "cpc",
    priority: "high",
    interactions: [
      { id: "INT-033", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Yandex Direct orqali", createdAt: "2024-12-09 13:40", createdBy: "Tizim" },
      { id: "INT-034", type: "call", direction: "outbound", content: "LG xolodilnik va Artel konditsioner haqida ma'lumot berildi.", createdAt: "2024-12-10 10:00", createdBy: "Dilshod Rahimov", duration: 360 },
      { id: "INT-035", type: "email", direction: "outbound", content: "Texnik xususiyatlar va narxlar yuborildi.", createdAt: "2024-12-11 09:00", createdBy: "Dilshod Rahimov" },
      { id: "INT-036", type: "status_change", direction: "outbound", content: "Status: Saralangan", createdAt: "2024-12-12 16:00", createdBy: "Dilshod Rahimov" },
    ],
  },
  {
    id: "LID-2024010",
    name: "Madina Tursunova",
    phone: "+998 91 012 34 56",
    email: "madina.tursunova@yahoo.com",
    source: "marketplace",
    status: "contacted",
    stage: "processing",
    value: 950000,
    currency: "UZS",
    assignedTo: "Malika Yusupova",
    assignedAvatar: "MY",
    notes: "Uzum Marketplace orqali. Bolalar o'yinchoqlari.",
    tags: ["yangi", "marketplace"],
    createdAt: "2024-12-14 11:30",
    updatedAt: "2024-12-14 15:20",
    lastContact: "2024-12-14 15:20",
    nextFollowUp: "2024-12-16 10:00",
    location: "Toshkent",
    priority: "low",
    interactions: [
      { id: "INT-037", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Uzum Marketplace orqali", createdAt: "2024-12-14 11:30", createdBy: "Tizim" },
      { id: "INT-038", type: "sms", direction: "outbound", content: "Assalomu alaykum! Buyurtmangiz qabul qilindi. Yetkazib berish sanasi: 16.12.2024", createdAt: "2024-12-14 15:20", createdBy: "Malika Yusupova" },
      { id: "INT-039", type: "status_change", direction: "outbound", content: "Status: Bog'lanildi", createdAt: "2024-12-14 15:20", createdBy: "Malika Yusupova" },
    ],
  },
  {
    id: "LID-2024011",
    name: "Kamoliddin Ismoilov",
    phone: "+998 93 123 45 67",
    email: "kamoliddin.ismoilov@gmail.com",
    source: "phone",
    status: "proposal",
    stage: "pipeline",
    value: 5600000,
    currency: "UZS",
    assignedTo: "Dilshod Rahimov",
    assignedAvatar: "DR",
    notes: "Telefon orqali qo'ng'iroq qildi. 5 ta planshet kerak.",
    tags: ["optom", "ta'lim"],
    createdAt: "2024-12-08 10:00",
    updatedAt: "2024-12-13 12:00",
    lastContact: "2024-12-13 12:00",
    nextFollowUp: "2024-12-16 15:00",
    company: "Ziyo Academy",
    position: "Administrator",
    location: "Toshkent",
    priority: "medium",
    interactions: [
      { id: "INT-040", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Telefon orqali", createdAt: "2024-12-08 10:00", createdBy: "Tizim" },
      { id: "INT-041", type: "call", direction: "inbound", content: "5 ta planshet kerak. O'quv markazimiz uchun. Narxlar qanday?", createdAt: "2024-12-08 10:00", createdBy: "Kamoliddin Ismoilov", duration: 240 },
      { id: "INT-042", type: "email", direction: "outbound", content: "5 ta Samsung Galaxy Tab narxlar ro'yxati yuborildi. Optom chegirma: 8%", createdAt: "2024-12-09 11:00", createdBy: "Dilshod Rahimov" },
      { id: "INT-043", type: "call", direction: "outbound", content: "Qo'ng'iroq. Mijoz narx ma'qul ekanini aytdi. Yetkazib berish muddati muhokama qilindi.", createdAt: "2024-12-13 12:00", createdBy: "Dilshod Rahimov", duration: 180 },
      { id: "INT-044", type: "status_change", direction: "outbound", content: "Status: Taklif", createdAt: "2024-12-13 12:00", createdBy: "Dilshod Rahimov" },
    ],
  },
  {
    id: "LID-2024012",
    name: "Nilufar Xasanova",
    phone: "+998 94 234 56 78",
    email: "nilufar.xasanova@mail.ru",
    source: "email",
    status: "new",
    stage: "incoming",
    value: 7800000,
    currency: "UZS",
    assignedTo: "Malika Yusupova",
    assignedAvatar: "MY",
    notes: "Email orqali so'rov. Erkaklar kiyimlari optom.",
    tags: ["yangi", "optom"],
    createdAt: "2024-12-15 08:00",
    updatedAt: "2024-12-15 08:00",
    lastContact: "2024-12-15 08:00",
    nextFollowUp: "2024-12-15 16:00",
    company: "Fashion House",
    position: "Xaridlar bo'limi",
    location: "Samarqand",
    priority: "high",
    interactions: [
      { id: "INT-045", type: "status_change", direction: "outbound", content: "Yangi lid yaratildi - Email orqali", createdAt: "2024-12-15 08:00", createdBy: "Tizim" },
    ],
  },
];

export const funnelData = [
  { stage: "Yangi", count: 12, value: 28400000, color: "#3b82f6" },
  { stage: "Bog'lanildi", count: 8, value: 32100000, color: "#f59e0b" },
  { stage: "Saralangan", count: 5, value: 19800000, color: "#8b5cf6" },
  { stage: "Taklif", count: 4, value: 28900000, color: "#06b6d4" },
  { stage: "Muzokara", count: 2, value: 14500000, color: "#f97316" },
  { stage: "Yutuq", count: 3, value: 52600000, color: "#10b981" },
  { stage: "Yoqotildi", count: 2, value: 23700000, color: "#ef4444" },
];

export const conversionByDay = [
  { day: "Dush", incoming: 8, converted: 2 },
  { day: "Sesh", incoming: 12, converted: 3 },
  { day: "Chor", incoming: 6, converted: 1 },
  { day: "Pay", incoming: 15, converted: 4 },
  { day: "Juma", incoming: 10, converted: 3 },
  { day: "Shan", incoming: 18, converted: 5 },
  { day: "Yak", incoming: 5, converted: 1 },
];
