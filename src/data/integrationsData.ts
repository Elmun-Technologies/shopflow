// Barcha integratsiyalar markazi — Uzbekistan e-commerce uchun.
// Status:
//   "connected"  — bog'langan, sozlangan
//   "available"  — qo'llab-quvvatlanadi, ulanish mumkin
//   "soon"       — yaqin orada (placeholder)

export type IntegrationStatus = "connected" | "available" | "soon";

export type IntegrationCategory =
  | "payments"
  | "channels"
  | "delivery"
  | "analytics"
  | "erp"
  | "crm"
  | "marketing"
  | "other";

export interface IntegrationItem {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  // Brand'ga mos rang (background tint + icon color uchun)
  color: string;
  // Brand badge text (logo o'rniga, agar fayl yo'q bo'lsa)
  initials: string;
  status: IntegrationStatus;
  // Setup haqida qisqacha hint (modal'da)
  setupHint?: string;
  // Mahalliy yoki global (UZ flag emoji ko'rsatish uchun)
  region?: "UZ" | "global";
  // Maslahat: foydalanuvchi qachon kerakligini bilishi uchun
  recommended?: boolean;
}

export const integrationCategories: Array<{ id: IntegrationCategory; label: string; subtitle: string }> = [
  { id: "payments", label: "To'lov tizimlari", subtitle: "Mijozlar onlayn to'lashi uchun" },
  { id: "channels", label: "Sotuv kanallari", subtitle: "Telegram, Instagram, sayt va boshqalar" },
  { id: "delivery", label: "Yetkazib berish", subtitle: "Kuryer xizmatlari va logistika" },
  { id: "analytics", label: "Analitika va piksellar", subtitle: "Traffic va kampaniyani kuzatish" },
  { id: "erp", label: "ERP va Ombor", subtitle: "Mahsulot va omborni sinxronlash" },
  { id: "crm", label: "CRM va savdo", subtitle: "Buyurtma va mijoz sinxronizatsiyasi" },
  { id: "marketing", label: "Marketing", subtitle: "Email, SMS va xabarnomalar" },
  { id: "other", label: "Boshqa vositalar", subtitle: "Avtomatlashtirish va eksport" },
];

export const integrations: IntegrationItem[] = [
  // ─── To'lov tizimlari ───────────────────────────────
  {
    id: "click",
    name: "Click",
    description: "O'zbekistondagi eng katta to'lov tizimi",
    category: "payments",
    color: "#1990FF",
    initials: "CL",
    status: "available",
    region: "UZ",
    recommended: true,
    setupHint: "Merchant ID + Service ID + Secret Key kerak. click.uz partner panelidan oling.",
  },
  {
    id: "payme",
    name: "Payme",
    description: "Mobil to'lov va karta",
    category: "payments",
    color: "#36A8E0",
    initials: "PM",
    status: "available",
    region: "UZ",
    recommended: true,
    setupHint: "Cabinet.paycom.uz dan Merchant key oling.",
  },
  {
    id: "uzum-pay",
    name: "Uzum Pay",
    description: "Uzum ekosistemasi to'lovlari",
    category: "payments",
    color: "#7C3AED",
    initials: "UP",
    status: "available",
    region: "UZ",
    setupHint: "Uzum business hisobi kerak.",
  },
  {
    id: "alif",
    name: "Alif Pay",
    description: "0% rassrochka — 12 oygacha",
    category: "payments",
    color: "#FF6900",
    initials: "AL",
    status: "available",
    region: "UZ",
    setupHint: "Alif Mobi merchant ariza orqali ulang.",
  },
  {
    id: "humans-pay",
    name: "Humans Pay",
    description: "Mobil operator to'lovlari",
    category: "payments",
    color: "#FFCC00",
    initials: "HM",
    status: "soon",
    region: "UZ",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Xalqaro karta to'lovlari (USD/EUR)",
    category: "payments",
    color: "#635BFF",
    initials: "ST",
    status: "soon",
  },

  // ─── Sotuv kanallari ────────────────────────────────
  {
    id: "telegram-bot",
    name: "Telegram Bot",
    description: "Asosiy savdo kanali — Mini App + bot",
    category: "channels",
    color: "#26A5E4",
    initials: "TG",
    status: "connected",
    region: "UZ",
    recommended: true,
    setupHint: "@BotFather'dan bot yarating, token Kanallar bo'limiga joylashtiring.",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "DM va story replies → lidlar",
    category: "channels",
    color: "#E4405F",
    initials: "IG",
    status: "available",
    region: "global",
    setupHint: "Instagram Business hisobini Facebook orqali ulang.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Xabarlar va broadcastlar",
    category: "channels",
    color: "#25D366",
    initials: "WA",
    status: "soon",
    region: "global",
  },
  {
    id: "facebook",
    name: "Facebook Messenger",
    description: "Sahifa xabarlari → lidlar",
    category: "channels",
    color: "#0084FF",
    initials: "FB",
    status: "available",
  },
  {
    id: "website-chat",
    name: "Sayt chat widget",
    description: "JS snippet — istalgan saytga qo'shing",
    category: "channels",
    color: "#5FA340",
    initials: "WC",
    status: "available",
    setupHint: "Saytga <script> qo'ying — barcha ziyoratchilar chat'ga ulanadi.",
  },

  // ─── Yetkazib berish ────────────────────────────────
  {
    id: "yandex-go",
    name: "Yandex Go Delivery",
    description: "Toshkent bo'ylab tezkor kuryer",
    category: "delivery",
    color: "#FFCC00",
    initials: "YG",
    status: "soon",
    region: "UZ",
    setupHint: "Tez orada — Yandex Pro hisobi va API integratsiyasi kerak (hozircha qurilmagan).",
  },
  {
    id: "uzum-tezkor",
    name: "Uzum Tezkor",
    description: "Same-day delivery Uzum tarmog'i orqali",
    category: "delivery",
    color: "#7C3AED",
    initials: "UT",
    status: "soon",
    region: "UZ",
  },
  {
    id: "bts-express",
    name: "BTS Express",
    description: "Viloyatlarga pochta yetkazib berish",
    category: "delivery",
    color: "#1976D2",
    initials: "BT",
    status: "available",
    region: "UZ",
    setupHint: "BTS shartnoma va API kalitlar orqali.",
  },
  {
    id: "fargo",
    name: "Fargo",
    description: "Same-day Toshkent + viloyatlar",
    category: "delivery",
    color: "#FF5722",
    initials: "FA",
    status: "available",
    region: "UZ",
  },
  {
    id: "own-courier",
    name: "O'z kuryerlaringiz",
    description: "Ichki kuryer jamoasi — yo'l rejasi va tracking",
    category: "delivery",
    color: "#5FA340",
    initials: "OK",
    status: "connected",
    region: "UZ",
  },

  // ─── Analytics va piksellar ─────────────────────────
  {
    id: "google-analytics",
    name: "Google Analytics 4",
    description: "Universal traffic va konversiya tahlili",
    category: "analytics",
    color: "#E37400",
    initials: "GA",
    status: "available",
    recommended: true,
    setupHint: "Measurement ID (G-XXXXXXX) Mini App ga avtomatik qo'shiladi.",
  },
  {
    id: "yandex-metrika",
    name: "Yandex Metrika",
    description: "Heatmap, Session Replay, traffic",
    category: "analytics",
    color: "#FF3300",
    initials: "YM",
    status: "available",
    region: "UZ",
    recommended: true,
    setupHint: "Counter ID kiriting — script avtomatik o'rnatiladi.",
  },
  {
    id: "meta-pixel",
    name: "Meta Pixel",
    description: "Facebook va Instagram reklama tahlili",
    category: "analytics",
    color: "#1877F2",
    initials: "MP",
    status: "available",
    setupHint: "Pixel ID Facebook Business Suite'dan oling.",
  },
  {
    id: "tiktok-pixel",
    name: "TikTok Pixel",
    description: "TikTok kampaniyalarini optimallashtirish",
    category: "analytics",
    color: "#000000",
    initials: "TT",
    status: "available",
  },

  // ─── ERP va Ombor ───────────────────────────────────
  {
    id: "moysklad",
    name: "MoySklad",
    description: "Mahsulot, qoldiq va buyurtmalar sinxron",
    category: "erp",
    color: "#F37021",
    initials: "MS",
    status: "available",
    recommended: true,
    setupHint: "OAuth orqali ulanish — alohida panelga o'tasiz.",
  },
  {
    id: "salesdoctor",
    name: "Sales Doctor",
    description: "Sotuv CRM — buyurtmalar avtomatik tushadi, status sync",
    category: "crm",
    color: "#0066CC",
    initials: "SD",
    status: "available",
    recommended: true,
    region: "UZ",
    setupHint: "Domain + login/parol bilan ulanish.",
  },
  {
    id: "1c",
    name: "1C: Buxgalteriya",
    description: "Buxgalteriya hisoboti va sinxron",
    category: "erp",
    color: "#FFEB3B",
    initials: "1C",
    status: "soon",
    region: "UZ",
  },
  {
    id: "bitrix24",
    name: "Bitrix24",
    description: "CRM lidlar va vazifalar",
    category: "erp",
    color: "#2FC6F6",
    initials: "B24",
    status: "soon",
  },

  // ─── Marketing ──────────────────────────────────────
  {
    id: "eskiz",
    name: "Eskiz SMS",
    description: "O'zbekiston SMS xabarlari (broadcastlar)",
    category: "marketing",
    color: "#2196F3",
    initials: "ES",
    status: "available",
    region: "UZ",
    recommended: true,
    setupHint: "Eskiz.uz dan API token va sender name oling.",
  },
  {
    id: "playmobile",
    name: "Play Mobile SMS",
    description: "SMS gateway — istalgan operatorga",
    category: "marketing",
    color: "#4CAF50",
    initials: "PL",
    status: "available",
    region: "UZ",
  },
  {
    id: "mailgun",
    name: "Mailgun",
    description: "Tranzaksion email (Domain orqali)",
    category: "marketing",
    color: "#F0644E",
    initials: "MG",
    status: "available",
    setupHint: "Domain DNS sozlamasi va API key kerak.",
  },
  {
    id: "sendpulse",
    name: "SendPulse",
    description: "Email + SMS + Web push hammasi birga",
    category: "marketing",
    color: "#EE2A24",
    initials: "SP",
    status: "soon",
  },

  // ─── Boshqa vositalar ───────────────────────────────
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Buyurtmalar va mijozlar avtomatik eksport",
    category: "other",
    color: "#0F9D58",
    initials: "GS",
    status: "available",
    setupHint: "Google Drive ulanishi orqali.",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "5000+ ilovaga ulanish (avtomatlashtirish)",
    category: "other",
    color: "#FF4A00",
    initials: "ZP",
    status: "soon",
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Buyurtma yaratilganda istalgan URL'ga POST",
    category: "other",
    color: "#5FA340",
    initials: "WH",
    status: "available",
    setupHint: "Endpoint URL va secret kiritsangiz kifoya.",
  },
];
