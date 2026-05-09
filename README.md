# 🛍️ ShopFlow — E-commerce Admin Dashboard

<div align="center">

![ShopFlow](https://img.shields.io/badge/ShopFlow-E--commerce%20Dashboard-6366f1?style=for-the-badge&logo=shopify&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

**Zamonaviy, keng funksiyali e-commerce boshqaruv paneli**

[Demo](#) · [Hujjatlar](#foydalanish) · [Xato bildirish](https://github.com/Elmun-Technologies/shopflow/issues)

</div>

---

## 📋 Loyiha haqida

**ShopFlow** — bu zamonaviy elektron tijorat bizneslarini boshqarish uchun mo'ljallangan to'liq funksiyali admin dashboard. React 19, TypeScript va Tailwind CSS 4 asosida qurilgan bo'lib, real vaqtda ma'lumotlarni kuzatish, buyurtmalarni boshqarish, mijozlar bilan ishlash va marketing kampaniyalarini nazorat qilish imkonini beradi.

### ✨ Asosiy xususiyatlar

- 📊 **Interaktiv Analitika** — Recharts kutubxonasi asosida daromad, sotuvlar va trafik grafiklari
- 🛒 **Buyurtmalar Boshqaruvi** — Buyurtmalarni kuzatish, filtr va izlash, batafsil modal ko'rinish
- 👥 **Mijozlar CRM** — Mijozlar profili, xarid tarixi va segmentatsiya
- 📦 **Mahsulotlar Katalogi** — Mahsulot qo'shish, tahrirlash, stock nazorati
- 🚚 **Yetkazib Berish** — Kuryerlar va yetkazib berish holatlari paneli
- 💳 **To'lovlar** — To'lov tranzaksiyalari va moliyaviy hisobotlar
- 🎯 **Marketing** — Kampaniyalar, promokodlar, SMS va email rassilka
- 🤝 **Leads (Mijoz murojaatlari)** — Potensial mijozlarni boshqarish
- 🏪 **Platformalar** — Ko'p kanallik savdo integratsiyasi
- 💬 **Chat** — Mijozlar bilan jonli muloqot
- 🎨 **UI Builder** — Drag-and-drop interfeys yaratuvchi
- ⚙️ **Sozlamalar** — Profil, xavfsizlik, bildirishnomalar va integratsiyalar

---

## 🛠️ Texnologiyalar

| Texnologiya | Versiya | Maqsad |
|-------------|---------|--------|
| **React** | 19.2 | UI framework |
| **TypeScript** | 5.9 | Tip xavfsizligi |
| **Vite** | 7.2 | Build tool va dev server |
| **Tailwind CSS** | 4.1 | Utility-first styling |
| **Recharts** | 3.8 | Ma'lumot vizualizatsiyasi |
| **Framer Motion** | 12 | Animatsiyalar |
| **Lucide React** | 1.11 | Ikonlar kutubxonasi |
| **date-fns** | 4.1 | Sana formatlash |
| **clsx** | 2.1 | CSS klasslarni birlashtirish |

---

## 📁 Loyiha Tuzilmasi

```
shopflow/
├── public/
├── src/
│   ├── components/
│   │   ├── pages/                  # Marketing sub-sahifalari
│   │   │   ├── BannerPage.tsx
│   │   │   ├── GiveawayPage.tsx
│   │   │   ├── IzohlarPage.tsx
│   │   │   ├── KanalPage.tsx
│   │   │   ├── ManbaPage.tsx
│   │   │   ├── PromoPage.tsx
│   │   │   ├── RassilkaPage.tsx
│   │   │   ├── SegmentsPage.tsx
│   │   │   ├── SmsPage.tsx
│   │   │   ├── SodiqlikPage.tsx
│   │   │   ├── SovgalarPage.tsx
│   │   │   └── TranzaksiyalarPage.tsx
│   │   ├── AnalyticsPage.tsx       # Analitika sahifasi
│   │   ├── ChatPage.tsx            # Chat sahifasi
│   │   ├── CustomerDetailModal.tsx # Mijoz batafsil modal
│   │   ├── CustomersPage.tsx       # Mijozlar sahifasi
│   │   ├── DeliveryPage.tsx        # Yetkazib berish sahifasi
│   │   ├── EmptyState.tsx          # Bo'sh holat komponenti
│   │   ├── Header.tsx              # Yuqori panel
│   │   ├── KPICards.tsx            # KPI kartochkalari
│   │   ├── LeadDetailModal.tsx     # Lead batafsil modal
│   │   ├── LeadsPage.tsx           # Leads sahifasi
│   │   ├── MarketingPage.tsx       # Marketing sahifasi
│   │   ├── OrderDetailModal.tsx    # Buyurtma batafsil modal
│   │   ├── OrdersPage.tsx          # Buyurtmalar sahifasi
│   │   ├── PaymentsPage.tsx        # To'lovlar sahifasi
│   │   ├── PlatformsPage.tsx       # Platformalar sahifasi
│   │   ├── ProductDetailModal.tsx  # Mahsulot batafsil modal
│   │   ├── ProductsPage.tsx        # Mahsulotlar sahifasi
│   │   ├── RecentOrders.tsx        # So'nggi buyurtmalar widget
│   │   ├── RevenueChart.tsx        # Daromad grafigi
│   │   ├── SalesByCategory.tsx     # Kategoriya bo'yicha sotuvlar
│   │   ├── SettingsPage.tsx        # Sozlamalar sahifasi
│   │   ├── Sidebar.tsx             # Yon panel navigatsiyasi
│   │   ├── TopProducts.tsx         # Eng ko'p sotilgan mahsulotlar
│   │   ├── TrafficSources.tsx      # Trafik manbalari
│   │   ├── UIBuilderPage.tsx       # UI Builder sahifasi
│   │   └── WeeklySales.tsx         # Haftalik sotuvlar grafigi
│   ├── data/
│   │   ├── analyticsData.ts        # Analitika ma'lumotlari
│   │   ├── chatData.ts             # Chat ma'lumotlari
│   │   ├── customersData.ts        # Mijozlar ma'lumotlari
│   │   ├── dashboardData.ts        # Dashboard ma'lumotlari
│   │   ├── deliveryData.ts         # Yetkazib berish ma'lumotlari
│   │   ├── leadsData.ts            # Leads ma'lumotlari
│   │   ├── marketingData.ts        # Marketing ma'lumotlari
│   │   ├── ordersData.ts           # Buyurtmalar ma'lumotlari
│   │   ├── paymentsData.ts         # To'lovlar ma'lumotlari
│   │   ├── platformsData.ts        # Platformalar ma'lumotlari
│   │   ├── productsData.ts         # Mahsulotlar ma'lumotlari
│   │   ├── settingsData.ts         # Sozlamalar ma'lumotlari
│   │   └── uiBuilderData.ts        # UI Builder ma'lumotlari
│   ├── utils/
│   │   └── cn.ts                   # className utility
│   ├── App.tsx                     # Asosiy ilova komponenti
│   ├── index.css                   # Global stilllar
│   └── main.tsx                    # Kirish nuqtasi
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Ishga Tushirish

### Talablar

- **Node.js** v18 yoki undan yuqori
- **npm** v9 yoki undan yuqori

### O'rnatish

```bash
# Reponi clone qiling
git clone https://github.com/Elmun-Technologies/shopflow.git

# Papkaga kiring
cd shopflow

# Bog'liqliklarni o'rnating
npm install
```

### Development serverni ishga tushirish

```bash
npm run dev
```

Brauzerda oching: [http://localhost:5173](http://localhost:5173)

### Production build

```bash
npm run build
```

Build fayllari `dist/` papkasiga joylashadi.

### Build natijasini oldindan ko'rish

```bash
npm run preview
```

---

## 📱 Sahifalar va Funksiyalar

### 🏠 Dashboard (Asosiy sahifa)
- KPI kartochkalari: Jami daromad, buyurtmalar, mijozlar, konversiya
- Daromad grafigi (Recharts)
- Kategoriya bo'yicha sotuvlar doira diagrammasi
- Haftalik sotuvlar bar grafigi
- Trafik manbalari tahlili
- Eng ko'p sotilgan mahsulotlar
- So'nggi buyurtmalar jadvali

### 📊 Analytics (Analitika)
- Kengaytirilgan statistika va KPI ko'rsatkichlari
- Daromad va foyda tahlili
- Geografik tarqatish
- Mijoz xatti-harakatlari tahlili
- Konversiya funnel

### 🛒 Orders (Buyurtmalar)
- Barcha buyurtmalar ro'yxati
- Status bo'yicha filtr (yangi, jarayonda, yetkazildi, bekor qilindi)
- Qidiruv funksiyasi
- Buyurtma batafsil modal (mahsulotlar, yetkazib berish, to'lov ma'lumotlari)
- Eksport funksiyasi

### 👥 Customers (Mijozlar)
- Mijozlar ro'yxati va profillari
- Xarid tarixi va statistika
- Mijoz segmentatsiyasi (VIP, muntazam, yangi)
- Batafsil mijoz modal paneli

### 📦 Products (Mahsulotlar)
- Mahsulotlar katalogi
- Kategoriya va brand bo'yicha filtr
- Stock holati kuzatuvi
- Mahsulot qo'shish/tahrirlash/o'chirish
- Batafsil mahsulot modal

### 🚚 Delivery (Yetkazib berish)
- Yetkazib berish buyurtmalari kuzatuvi
- Kuryer boshqaruvi
- Real-time holat yangilanishlari
- Yetkazib berish hududlari xaritasi

### 💳 Payments (To'lovlar)
- Tranzaksiyalar tarixi
- To'lov usullari tahlili
- Qaytarishlar va chargeback boshqaruvi
- Moliyaviy hisobotlar

### 🎯 Marketing
- **Rassilka** — Email va SMS kampaniyalar
- **Promo kodlar** — Chegirmalar va aksiyalar
- **Segmentlar** — Mijoz guruhlari
- **Banner** — Reklama bannerlari boshqaruvi
- **Sovgalar** — Sovg'a dasturlari
- **Sodiqlik** — Bonus va ballar tizimi
- **Giveaway** — Tanlovlar va taqsimotlar
- **Kanal** — Marketing kanallari
- **Manba** — Trafik manbalari
- **Izohlar** — Mijoz sharhlari boshqaruvi
- **Tranzaksiyalar** — Marketing to'lovlari

### 🤝 Leads
- Potensial mijozlar ro'yxati
- Murojaat holati kuzatuvi
- Lead batafsil modal
- CRM pipeline

### 🏪 Platforms (Platformalar)
- Ko'p platformali savdo integratsiyasi
- Platforma statistikasi va hisobotlari
- API ulanish sozlamalari

### 💬 Chat
- Jonli mijoz qo'llab-quvvatlash
- Suhbat tarixi
- Tezkor javoblar

### 🎨 UI Builder
- Drag-and-drop interfeys yaratuvchi
- Komponentlar kutubxonasi
- Sahifa dizayni muharriri

### ⚙️ Settings (Sozlamalar)
- **Profil** — Foydalanuvchi ma'lumotlari
- **Xavfsizlik** — Parol va 2FA
- **Bildirishnomalar** — Xabarnoma sozlamalari
- **Integratsiyalar** — Uchinchi tomon xizmatlar
- **To'lov usullari** — Kassa sozlamalari
- **Yetkazib berish** — Yetkazib berish sozlamalari

---

## 🎨 Dizayn Tizimi

- **Rang palitasi**: Indigo/Purple gradientlar asosida dark mode dizayn
- **Tipografiya**: Inter, Roboto (Google Fonts)
- **Animatsiyalar**: Framer Motion yordamida smooth o'tishlar
- **Ikonlar**: Lucide React ikonlar to'plami
- **Komponentlar**: Reusable, TypeScript-tipizatsiyalangan komponentlar

---

## 🤝 Hissa Qo'shish

1. Reponi fork qiling
2. Feature branch yarating: `git checkout -b feature/yangi-funksiya`
3. O'zgarishlaringizni commit qiling: `git commit -m 'feat: yangi funksiya qo'shildi'`
4. Branch'ni push qiling: `git push origin feature/yangi-funksiya`
5. Pull Request oching

---

## 📄 Litsenziya

Bu loyiha [MIT License](LICENSE) ostida litsenziyalangan.

---

## 👨‍💻 Ishlab Chiquvchi

**Elmun Technologies**

- GitHub: [@Elmun-Technologies](https://github.com/Elmun-Technologies)

---

<div align="center">

⭐ Agar loyiha foydali bo'lsa, **star** bosing!

Made with ❤️ by **Elmun Technologies**

</div>
