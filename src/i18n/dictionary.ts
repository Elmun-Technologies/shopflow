// Tarjima lug'ati — kalit/qiymat. Yangi kalit qo'shsangiz, ikkala tilda ham bo'lishi shart.
// Foydalanish: t("common.save") yoki t("orders.total", { value: "100,000" })

import type { Lang } from "./index";

type Entry = Record<Lang, string>;

export const dictionary: Record<string, Entry> = {
  // ─── Common ───────────────────────────────────────────
  "common.save": { uz: "Saqlash", ru: "Сохранить" },
  "common.cancel": { uz: "Bekor", ru: "Отмена" },
  "common.delete": { uz: "O'chirish", ru: "Удалить" },
  "common.edit": { uz: "Tahrirlash", ru: "Редактировать" },
  "common.add": { uz: "Qo'shish", ru: "Добавить" },
  "common.search": { uz: "Qidirish", ru: "Поиск" },
  "common.loading": { uz: "Yuklanmoqda…", ru: "Загрузка…" },
  "common.back": { uz: "Orqaga", ru: "Назад" },
  "common.close": { uz: "Yopish", ru: "Закрыть" },
  "common.ok": { uz: "Xo'p", ru: "Хорошо" },
  "common.yes": { uz: "Ha", ru: "Да" },
  "common.no": { uz: "Yo'q", ru: "Нет" },
  "common.next": { uz: "Keyingisi", ru: "Далее" },
  "common.send": { uz: "Yuborish", ru: "Отправить" },
  "common.confirm": { uz: "Tasdiqlash", ru: "Подтвердить" },
  "common.optional": { uz: "ixtiyoriy", ru: "необязательно" },
  "common.required": { uz: "majburiy", ru: "обязательно" },

  // ─── Storefront: Tabs ─────────────────────────────────
  "store.tab.home": { uz: "Bosh", ru: "Главная" },
  "store.tab.catalog": { uz: "Katalog", ru: "Каталог" },
  "store.tab.cart": { uz: "Savat", ru: "Корзина" },
  "store.tab.promo": { uz: "Aksiyalar", ru: "Акции" },
  "store.tab.profile": { uz: "Profil", ru: "Профиль" },

  // ─── Storefront: PDP ─────────────────────────────────
  "pdp.available": { uz: "✓ Mavjud", ru: "✓ В наличии" },
  "pdp.outOfStock": { uz: "Tugagan", ru: "Нет в наличии" },
  "pdp.bestseller": { uz: "⭐ Bestseller", ru: "⭐ Хит продаж" },
  "pdp.savings": { uz: "Tejovingiz: {value}", ru: "Экономия: {value}" },
  "pdp.weeklyBuyers": { uz: "Bu haftada {count} kishi sotib oldi", ru: "На этой неделе купили {count} человек" },
  "pdp.original": { uz: "ORIGINAL", ru: "ОРИГИНАЛ" },
  "pdp.warranty": { uz: "KAFOLAT 6 OY", ru: "ГАРАНТИЯ 6 МЕС" },
  "pdp.readMore": { uz: "Batafsil ↓", ru: "Подробнее ↓" },
  "pdp.readLess": { uz: "Yopish ↑", ru: "Свернуть ↑" },
  "pdp.delivery": { uz: "Yetkazib berish: {date}", ru: "Доставка: {date}" },
  "pdp.deliveryNote": { uz: "Toshkent bo'ylab kuryer · viloyatlarga pochta", ru: "По Ташкенту курьером · в регионы почтой" },
  "pdp.reviews": { uz: "Sharhlar", ru: "Отзывы" },
  "pdp.writeReview": { uz: "+ Sharh yozish", ru: "+ Написать отзыв" },
  "pdp.noReviews": { uz: "Hali sharhlar yo'q.", ru: "Пока нет отзывов." },
  "pdp.beFirst": { uz: "Birinchi bo'lib yozing!", ru: "Будьте первым!" },
  "pdp.totalReviews": { uz: "{count} ta sharh", ru: "{count} отзывов" },
  "pdp.comboTitle": { uz: "🎁 Bularni ham qo'shing", ru: "🎁 Добавьте к заказу" },

  // ─── Storefront: Cart ────────────────────────────────
  "cart.title": { uz: "Savat", ru: "Корзина" },
  "cart.empty.title": { uz: "Savat bo'sh", ru: "Корзина пуста" },
  "cart.empty.subtitle": { uz: "Mahsulot qo'shish uchun katalogga o'ting", ru: "Перейдите в каталог, чтобы добавить товары" },
  "cart.checkout": { uz: "Buyurtma rasmiylashtirish", ru: "Оформить заказ" },
  "cart.total": { uz: "Jami", ru: "Итого" },

  // ─── Storefront: Checkout ────────────────────────────
  "checkout.title": { uz: "Buyurtma rasmiylashtirish", ru: "Оформление заказа" },
  "checkout.name": { uz: "Ismingiz", ru: "Ваше имя" },
  "checkout.phone": { uz: "Telefon raqami", ru: "Номер телефона" },
  "checkout.email": { uz: "Email (ixtiyoriy)", ru: "Email (необязательно)" },
  "checkout.address": { uz: "Yetkazib berish manzili", ru: "Адрес доставки" },
  "checkout.gps": { uz: "📍 Joriy joylashuvni olish", ru: "📍 Использовать текущее местоположение" },
  "checkout.gpsDetected": { uz: "GPS aniqlandi: {coords}", ru: "GPS определён: {coords}" },
  "checkout.note": { uz: "Izoh (ixtiyoriy)", ru: "Комментарий (необязательно)" },
  "checkout.submit": { uz: "Buyurtma berish", ru: "Оформить заказ" },

  // ─── Storefront: Success ─────────────────────────────
  "success.title": { uz: "Buyurtma yaratildi", ru: "Заказ создан" },
  "success.subtitle": { uz: "Hammasi avtomatik — to'lov va yetkazib berish tayyorlanmoqda", ru: "Всё автоматически — оплата и доставка готовятся" },
  "success.order": { uz: "Buyurtma", ru: "Заказ" },
  "success.total": { uz: "Jami", ru: "Итого" },
  "success.nextSteps": { uz: "KEYINGI QADAMLAR", ru: "СЛЕДУЮЩИЕ ШАГИ" },
  "success.step.received": { uz: "Qabul qilindi", ru: "Принят" },
  "success.step.receivedDesc": { uz: "Buyurtmangiz tizimga kirdi", ru: "Заказ поступил в систему" },
  "success.step.processing": { uz: "Tayyorlanmoqda", ru: "Готовится" },
  "success.step.processingDesc": { uz: "Mahsulotlar yig'ilmoqda", ru: "Товары собираются" },
  "success.step.shipping": { uz: "Yo'lda", ru: "В пути" },
  "success.step.shippingDesc": { uz: "Yetkazib berishga yuborildi", ru: "Отправлен на доставку" },
  "success.step.delivered": { uz: "Yetkazildi", ru: "Доставлен" },
  "success.notify.tg": { uz: "Holat o'zgarganda Telegram'da xabar olasiz. Buyurtmani istalgan paytda Profile → Buyurtmalarim dan kuzating.", ru: "При смене статуса вы получите уведомление в Telegram. Отслеживайте заказ в Profile → Мои заказы." },
  "success.viewOrder": { uz: "Buyurtmamni ko'rish", ru: "Посмотреть мой заказ" },
  "success.continueShopping": { uz: "Yana xarid qilish", ru: "Продолжить покупки" },

  // ─── Storefront: Profile ─────────────────────────────
  "profile.title": { uz: "Profil", ru: "Профиль" },
  "profile.info": { uz: "Ma'lumotlarim", ru: "Мои данные" },
  "profile.orders": { uz: "Buyurtmalarim", ru: "Мои заказы" },
  "profile.addresses": { uz: "Mening manzillarim", ru: "Мои адреса" },
  "profile.favorites": { uz: "Sevimlilar", ru: "Избранное" },
  "profile.notifications": { uz: "Bildirishnomalar", ru: "Уведомления" },
  "profile.referrals": { uz: "Referallarim", ru: "Мои рефералы" },
  "profile.reviews": { uz: "Sharhlarim", ru: "Мои отзывы" },
  "profile.promo": { uz: "Promokodlarim", ru: "Мои промокоды" },
  "profile.language": { uz: "Ilova tili", ru: "Язык приложения" },
  "profile.guest": { uz: "Mehmon", ru: "Гость" },

  // ─── Admin sidebar ───────────────────────────────────
  "sidebar.search": { uz: "Qidirish…", ru: "Поиск…" },
  "sidebar.collapse": { uz: "Yig'ish", ru: "Свернуть" },
  "sidebar.pinned": { uz: "Tezkor", ru: "Закреплено" },
  "sidebar.recent": { uz: "Yaqinda", ru: "Недавно" },
  "sidebar.logout": { uz: "Chiqish", ru: "Выйти" },
  "sidebar.group.main": { uz: "Asosiy", ru: "Основное" },
  "sidebar.group.sales": { uz: "Savdo", ru: "Продажи" },
  "sidebar.group.crm": { uz: "CRM", ru: "CRM" },
  "sidebar.group.channels": { uz: "Kanallar", ru: "Каналы" },

  "nav.dashboard": { uz: "Dashboard", ru: "Главная" },
  "nav.analytics": { uz: "Tahlil", ru: "Аналитика" },
  "nav.orders": { uz: "Buyurtmalar", ru: "Заказы" },
  "nav.products": { uz: "Mahsulotlar", ru: "Товары" },
  "nav.payments": { uz: "To'lovlar", ru: "Платежи" },
  "nav.delivery": { uz: "Yetkazib berish", ru: "Доставка" },
  "nav.leads": { uz: "Lidlar", ru: "Лиды" },
  "nav.customers": { uz: "Mijozlar", ru: "Клиенты" },
  "nav.segments": { uz: "Segmentlar", ru: "Сегменты" },
  "nav.chat": { uz: "Chat", ru: "Чат" },
  "nav.platforms": { uz: "Platformalar", ru: "Платформы" },
  "nav.uibuilder": { uz: "Vitrina", ru: "Витрина" },
  "nav.marketing": { uz: "Marketing", ru: "Маркетинг" },
  "nav.marketingPanel": { uz: "Marketing paneli", ru: "Маркетинг-панель" },
  "nav.settings": { uz: "Sozlamalar", ru: "Настройки" },

  // ─── Order statuses ──────────────────────────────────
  "order.status.PENDING": { uz: "Yangi", ru: "Новый" },
  "order.status.PROCESSING": { uz: "Tayyorlanmoqda", ru: "Готовится" },
  "order.status.COMPLETED": { uz: "Yetkazildi", ru: "Доставлен" },
  "order.status.CANCELLED": { uz: "Bekor qilindi", ru: "Отменён" },
  "order.status.REFUNDED": { uz: "Qaytarildi", ru: "Возвращён" },
};
