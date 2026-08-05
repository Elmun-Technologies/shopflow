// Bot konstruktori uchun tayyor shablonlar.
//
// "retail"  — hozirgi default botning aynan ekvivalenti (do'kon + buyurtma
//             kuzatish + yordam + til). Tenant uni yoqib, matnlarni o'zgartira oladi.
// "b2b"     — ishlab chiqaruvchilarga sotadigan B2B mijozlar uchun: ko'p bosqichli
//             katalog, soha bo'yicha tanlash, yechim tanlash anketasi, namuna
//             (obrazets) so'rovi, narx so'rovi, menejer bilan aloqa.
// "blank"   — bo'sh bosh ekran, noldan qurish uchun.

import type { BotFlowDefinition } from "./bot-flow-schema.js";

export type BotTemplateId = "retail" | "b2b" | "blank";

export interface BotTemplateMeta {
  id: BotTemplateId;
  name: { uz: string; ru: string };
  description: { uz: string; ru: string };
  screens: number;
  forms: number;
}

// ─── RETAIL ─────────────────────────────────────────────────────────────────

const retail: BotFlowDefinition = {
  version: 1,
  settings: {
    startScreenId: "main",
    welcome: {
      uz: "🛍 <b>{store}</b>\n\nXush kelibsiz! Quyidagi menyudan foydalaning 👇",
      ru: "🛍 <b>{store}</b>\n\nДобро пожаловать! Воспользуйтесь меню ниже 👇",
    },
    defaultLang: "uz",
    languages: ["uz", "ru"],
    askLanguageOnStart: false,
    showStoreButton: true,
    storeButtonLabel: { uz: "🛍 Do'kon", ru: "🛍 Магазин" },
    fallback: "lead",
    fallbackText: {
      uz: "✅ Xabaringiz qabul qilindi. Operatorimiz tez orada siz bilan bog'lanadi!",
      ru: "✅ Ваше сообщение принято. Оператор свяжется с вами в ближайшее время!",
    },
    commands: [
      { command: "start", description: { uz: "Do'konni ochish", ru: "Открыть магазин" }, screenId: null },
      { command: "buyurtma", description: { uz: "Buyurtmani kuzatish", ru: "Отследить заказ" }, screenId: "track" },
      { command: "yordam", description: { uz: "Yordam va aloqa", ru: "Помощь и контакты" }, screenId: "support" },
    ],
  },
  screens: [
    {
      id: "main",
      name: "Bosh menyu",
      text: { uz: "Kerakli bo'limni tanlang:", ru: "Выберите нужный раздел:" },
      imageUrl: null,
      showBack: false,
      buttons: [
        { id: "shop", label: { uz: "🛍 Do'konni ochish", ru: "🛍 Открыть магазин" }, action: { type: "webapp" }, fullWidth: true },
        { id: "catalog", label: { uz: "📦 Katalog", ru: "📦 Каталог" }, action: { type: "catalog", categoryId: null, openInApp: true }, fullWidth: true },
        { id: "track", label: { uz: "🚚 Buyurtmani kuzatish", ru: "🚚 Отследить заказ" }, action: { type: "screen", screenId: "track" }, fullWidth: false },
        { id: "support", label: { uz: "🆘 Yordam", ru: "🆘 Поддержка" }, action: { type: "screen", screenId: "support" }, fullWidth: false },
        { id: "lang", label: { uz: "🌐 Til", ru: "🌐 Язык" }, action: { type: "language" }, fullWidth: true },
      ],
    },
    {
      id: "track",
      name: "Buyurtma kuzatish",
      text: {
        uz: "📦 Buyurtma raqamingizni kiriting:\n<i>Masalan: ORD-7523 yoki shunchaki 7523</i>",
        ru: "📦 Введите номер заказа:\n<i>Например: ORD-7523 или просто 7523</i>",
      },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "ask", label: { uz: "🔎 Raqamni kiritish", ru: "🔎 Ввести номер" }, action: { type: "track_order" }, fullWidth: true },
      ],
    },
    {
      id: "support",
      name: "Yordam",
      text: {
        uz: "🆘 <b>Yordam</b>\n\nSavolingiz bo'lsa — yozing, operatorimiz javob beradi.",
        ru: "🆘 <b>Поддержка</b>\n\nЕсть вопрос? Напишите — оператор ответит вам.",
      },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "operator", label: { uz: "💬 Operator bilan bog'lanish", ru: "💬 Связаться с оператором" }, action: { type: "operator" }, fullWidth: true },
      ],
    },
  ],
  forms: [],
};

// ─── B2B ────────────────────────────────────────────────────────────────────
//
// Ishlab chiqaruvchilarga xom ashyo / ingredient / komponent sotadigan mijozlar
// uchun. Savat yo'q — har bir yo'l anketaga va lidga olib boradi. Katalog
// bo'limlari tenant assortimentiga qarab tahrirlanadi.

const b2b: BotFlowDefinition = {
  version: 1,
  settings: {
    startScreenId: "main",
    welcome: {
      uz:
        "Rasmiy <b>{store}</b> Telegram botiga xush kelibsiz!\n\n" +
        "Biz O'zbekiston hududidagi ishlab chiqaruvchilar uchun professional yechimlar taklif qilamiz.\n\n" +
        "Bot orqali siz:\n" +
        "• katalog bilan tanishishingiz;\n" +
        "• mahsulotingiz uchun yechim tanlashingiz;\n" +
        "• namuna so'rashingiz;\n" +
        "• mutaxassis maslahatini olishingiz;\n" +
        "• hisob-kitob uchun so'rov yuborishingiz;\n" +
        "• buyurtma rasmiylashtirishingiz mumkin.\n\n" +
        "Quyidan kerakli bo'limni tanlang.",
      ru:
        "Добро пожаловать в официальный Telegram-бот <b>{store}</b>!\n\n" +
        "Мы поставляем профессиональные решения для производителей на территории Узбекистана.\n\n" +
        "Через бот вы можете:\n" +
        "• ознакомиться с каталогом;\n" +
        "• подобрать решение для вашего продукта;\n" +
        "• запросить образцы;\n" +
        "• получить консультацию специалиста;\n" +
        "• отправить заявку на расчёт;\n" +
        "• оформить заказ.\n\n" +
        "Выберите нужный раздел ниже.",
    },
    defaultLang: "ru",
    languages: ["uz", "ru"],
    askLanguageOnStart: false,
    showStoreButton: true,
    storeButtonLabel: { uz: "🛍 Katalog (ilova)", ru: "🛍 Каталог (приложение)" },
    fallback: "operator",
    fallbackText: {
      uz: "Murojaatingiz qabul qilindi.\n\nMenejer ish vaqtida siz bilan bog'lanadi.",
      ru: "Ваше обращение принято.\n\nМенеджер свяжется с вами в ближайшее рабочее время.",
    },
    commands: [
      { command: "start", description: { uz: "Bosh menyu", ru: "Главное меню" }, screenId: null },
      { command: "catalog", description: { uz: "Mahsulotlar katalogi", ru: "Каталог продукции" }, screenId: "catalog" },
      { command: "sample", description: { uz: "Namuna so'rash", ru: "Запросить образец" }, screenId: "sample" },
      { command: "manager", description: { uz: "Menejer bilan aloqa", ru: "Связаться с менеджером" }, screenId: "manager" },
    ],
  },
  screens: [
    {
      id: "main",
      name: "Bosh menyu",
      text: { uz: "<b>Bosh menyu</b>\n\nSizni qiziqtirgan bo'limni tanlang:", ru: "<b>Главное меню</b>\n\nВыберите интересующий вас раздел:" },
      imageUrl: null,
      showBack: false,
      buttons: [
        { id: "catalog", label: { uz: "📦 Katalog", ru: "📦 Каталог продукции" }, action: { type: "screen", screenId: "catalog" }, fullWidth: true },
        { id: "industries", label: { uz: "🏭 Qo'llanish sohalari", ru: "🏭 Отрасли применения" }, action: { type: "screen", screenId: "industries" }, fullWidth: true },
        { id: "sample", label: { uz: "🧪 Namuna olish", ru: "🧪 Получить образец" }, action: { type: "screen", screenId: "sample" }, fullWidth: true },
        { id: "order", label: { uz: "🛒 Buyurtma berish", ru: "🛒 Оформить заказ" }, action: { type: "form", formId: "order" }, fullWidth: true },
        { id: "solution", label: { uz: "👨‍🔬 Yechim tanlash", ru: "👨‍🔬 Подобрать решение" }, action: { type: "form", formId: "solution" }, fullWidth: true },
        { id: "price", label: { uz: "💰 Narx so'rash", ru: "💰 Запросить цену" }, action: { type: "form", formId: "price" }, fullWidth: true },
        { id: "manager", label: { uz: "💬 Menejer bilan aloqa", ru: "💬 Связаться с менеджером" }, action: { type: "screen", screenId: "manager" }, fullWidth: true },
        { id: "about", label: { uz: "ℹ️ Kompaniya haqida", ru: "ℹ️ О компании" }, action: { type: "screen", screenId: "about" }, fullWidth: false },
        { id: "contacts", label: { uz: "📍 Kontaktlar", ru: "📍 Контакты" }, action: { type: "screen", screenId: "contacts" }, fullWidth: false },
      ],
    },
    {
      id: "catalog",
      name: "Katalog — kategoriyalar",
      text: { uz: "Mahsulot kategoriyasini tanlang:", ru: "Выберите категорию продукции:" },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "all", label: { uz: "📋 Butun katalog", ru: "📋 Весь каталог" }, action: { type: "catalog", categoryId: null, openInApp: false }, fullWidth: true },
        { id: "new", label: { uz: "🔥 Yangiliklar", ru: "🔥 Новинки" }, action: { type: "catalog", categoryId: null, openInApp: false }, fullWidth: false },
        { id: "popular", label: { uz: "⭐ Ommabop yechimlar", ru: "⭐ Популярные решения" }, action: { type: "catalog", categoryId: null, openInApp: false }, fullWidth: false },
        { id: "docs", label: { uz: "📄 Hujjatlar va sertifikatlar", ru: "📄 Документы и сертификаты" }, action: { type: "screen", screenId: "docs" }, fullWidth: true },
      ],
    },
    {
      id: "industries",
      name: "Sohalar",
      text: { uz: "Qaysi soha uchun yechim tanlayapsiz?", ru: "Для какой отрасли вы подбираете решение?" },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "drinks", label: { uz: "🥤 Ichimliklar", ru: "🥤 Напитки" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "dairy", label: { uz: "🥛 Sut mahsulotlari", ru: "🥛 Молочная продукция" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "icecream", label: { uz: "🍦 Muzqaymoq", ru: "🍦 Мороженое" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "confect", label: { uz: "🍰 Qandolat", ru: "🍰 Кондитерские изделия" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "bakery", label: { uz: "🥐 Non mahsulotlari", ru: "🥐 Хлебобулочные изделия" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "snacks", label: { uz: "🍿 Sneklar", ru: "🍿 Снеки" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "sauces", label: { uz: "🥫 Souslar", ru: "🥫 Соусы и гастрономия" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "pharma", label: { uz: "💊 Farmatsevtika va BAD", ru: "💊 Фармацевтика и БАД" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "cosmetics", label: { uz: "🧴 Kosmetika", ru: "🧴 Косметика" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "household", label: { uz: "🧼 Maishiy kimyo", ru: "🧼 Бытовая химия" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "horeca", label: { uz: "☕ HoReCa", ru: "☕ HoReCa" }, action: { type: "form", formId: "solution" }, fullWidth: false },
        { id: "other", label: { uz: "➕ Boshqa yo'nalish", ru: "➕ Другое направление" }, action: { type: "form", formId: "solution" }, fullWidth: false },
      ],
    },
    {
      id: "sample",
      name: "Namuna so'rash",
      text: {
        uz:
          "<b>Namuna so'rovi</b>\n\n" +
          "Biz ishlab chiqarishda professional sinov uchun namunalar taqdim etamiz.\n\n" +
          "Mos namunani tanlash uchun bir nechta savolga javob bering.\n\n" +
          "<i>Namunalar professional sinov uchun beriladi. Namuna berish imkoniyati, miqdori va shartlari so'rov ko'rib chiqilgandan keyin menejer tomonidan tasdiqlanadi.</i>",
        ru:
          "<b>Запрос образца</b>\n\n" +
          "Мы предоставляем образцы для профессионального тестирования на производстве.\n\n" +
          "Для подбора подходящего образца ответьте на несколько вопросов.\n\n" +
          "<i>Образцы предоставляются для профессионального тестирования. Возможность, количество и условия предоставления образцов подтверждаются менеджером после рассмотрения заявки.</i>",
      },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "start", label: { uz: "🧪 So'rov qoldirish", ru: "🧪 Оставить заявку" }, action: { type: "form", formId: "sample" }, fullWidth: true },
      ],
    },
    {
      id: "manager",
      name: "Menejer bilan aloqa",
      text: {
        uz: "<b>Menejer bilan aloqa</b>\n\nTelefon raqamingizni qoldiring va savolingizni qisqacha yozing. Menejerimiz ish vaqtida bog'lanadi.",
        ru: "<b>Связаться с менеджером</b>\n\nОставьте ваш номер телефона и кратко опишите вопрос. Менеджер свяжется с вами в рабочее время.",
      },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "request", label: { uz: "📱 Raqam qoldirish", ru: "📱 Оставить номер" }, action: { type: "form", formId: "callback" }, fullWidth: true },
        { id: "chat", label: { uz: "✍️ Xabar yozish", ru: "✍️ Написать сообщение" }, action: { type: "operator" }, fullWidth: true },
      ],
    },
    {
      id: "docs",
      name: "Hujjatlar",
      text: {
        uz: "<b>Hujjatlar va sertifikatlar</b>\n\nSpetsifikatsiya, sifat sertifikatlari va xavfsizlik hujjatlari so'rov asosida taqdim etiladi. Qaysi mahsulot bo'yicha hujjat kerakligini yozing — menejer yuboradi.",
        ru: "<b>Документы и сертификаты</b>\n\nСпецификация, сертификаты качества и документы безопасности предоставляются по запросу. Укажите, по какому продукту нужны документы — менеджер направит их вам.",
      },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "request", label: { uz: "📄 Hujjat so'rash", ru: "📄 Запросить документы" }, action: { type: "form", formId: "callback" }, fullWidth: true },
      ],
    },
    {
      id: "about",
      name: "Kompaniya haqida",
      text: {
        uz:
          "<b>Kompaniya haqida</b>\n\n" +
          "{store} — sanoat ishlab chiqaruvchilari uchun professional yechimlar yetkazib beruvchi kompaniya.\n\n" +
          "Biz ishlab chiqaruvchilarga yordam beramiz:\n" +
          "• mos yechim tanlash;\n" +
          "• mahsulotni ishlab chiqish yoki yaxshilash;\n" +
          "• namunalarni sinovdan o'tkazish;\n" +
          "• texnik maslahat olish;\n" +
          "• yetkazib berishni tashkil qilish.\n\n" +
          "Maqsadimiz — shunchaki yetkazib beruvchi emas, muvaffaqiyatli mahsulot yaratishda professional hamkor bo'lish.",
        ru:
          "<b>О компании</b>\n\n" +
          "{store} — поставщик профессиональных решений для промышленных производителей.\n\n" +
          "Мы помогаем производителям:\n" +
          "• подобрать подходящее решение;\n" +
          "• разработать или улучшить продукт;\n" +
          "• протестировать образцы;\n" +
          "• получить техническую консультацию;\n" +
          "• организовать поставку продукции.\n\n" +
          "Наша цель — быть не только поставщиком, но и профессиональным партнёром в разработке успешных продуктов.",
      },
      imageUrl: null,
      showBack: true,
      buttons: [],
    },
    {
      id: "contacts",
      name: "Kontaktlar",
      text: {
        uz: "<b>Kontaktlar</b>\n\n📞 Telefon: —\n✉️ Email: —\n📍 Manzil: —\n🕐 Ish vaqti: Du–Ju, 9:00–18:00\n\n<i>Bu matnni bot konstruktorida tahrirlang.</i>",
        ru: "<b>Контакты</b>\n\n📞 Телефон: —\n✉️ Email: —\n📍 Адрес: —\n🕐 Режим работы: Пн–Пт, 9:00–18:00\n\n<i>Отредактируйте этот текст в конструкторе бота.</i>",
      },
      imageUrl: null,
      showBack: true,
      buttons: [
        { id: "manager", label: { uz: "💬 Menejer bilan aloqa", ru: "💬 Связаться с менеджером" }, action: { type: "screen", screenId: "manager" }, fullWidth: true },
      ],
    },
  ],
  forms: [
    {
      id: "solution",
      name: "Yechim tanlash anketasi",
      intro: {
        uz: "Sizga eng mos yechimni tanlash uchun bir nechta savol beramiz.",
        ru: "Чтобы подобрать оптимальное решение, зададим вам несколько вопросов.",
      },
      leadStatus: "QUALIFIED",
      tags: ["bot", "yechim-tanlash"],
      notifyAdmin: true,
      successText: {
        uz: "Rahmat! So'rovingiz muvaffaqiyatli yuborildi.\n\nMutaxassisimiz ma'lumotni o'rganib, tafsilotlarni aniqlash va mos yechimni tanlash uchun siz bilan bog'lanadi.\n\nSo'rov raqami: <b>#{id}</b>",
        ru: "Спасибо! Ваша заявка успешно отправлена.\n\nНаш специалист изучит информацию и свяжется с вами для уточнения деталей и подбора подходящего решения.\n\nНомер заявки: <b>#{id}</b>",
      },
      fields: [
        { id: "company", label: { uz: "Kompaniyangiz nomini kiriting:", ru: "Укажите название вашей компании:" }, type: "text", required: true, options: [], mapTo: "company" },
        {
          id: "industry",
          label: { uz: "Sohani tanlang:", ru: "Выберите отрасль:" },
          type: "choice",
          required: true,
          mapTo: null,
          options: [
            { uz: "Ichimliklar", ru: "Напитки" },
            { uz: "Sut mahsulotlari", ru: "Молочная продукция" },
            { uz: "Muzqaymoq", ru: "Мороженое" },
            { uz: "Qandolat", ru: "Кондитерские изделия" },
            { uz: "Non mahsulotlari", ru: "Хлебобулочные изделия" },
            { uz: "Kosmetika", ru: "Косметика" },
            { uz: "Maishiy kimyo", ru: "Бытовая химия" },
            { uz: "Boshqa", ru: "Другое" },
          ],
        },
        { id: "product", label: { uz: "Qanday mahsulot ishlab chiqarasiz yoki ishga tushirmoqchisiz?\n\n<i>Masalan: gazlangan ichimlik, yogurt, muzqaymoq, pechene, sirop yoki suyuq sovun.</i>", ru: "Какой продукт вы производите или планируете запустить?\n\n<i>Например: газированный напиток, йогурт, мороженое, печенье, сироп или жидкое мыло.</i>" }, type: "text", required: true, options: [], mapTo: null },
        { id: "profile", label: { uz: "Sizga qanday profil kerak?\n\n<i>Masalan: mango, qulupnay, vanil, kola, pista, tsitrus.</i>", ru: "Какой вкусовой или ароматический профиль вам необходим?\n\n<i>Например: манго, клубника, ваниль, кола, фисташка, цитрус или цветочный профиль.</i>" }, type: "text", required: true, options: [], mapTo: null },
        { id: "base", label: { uz: "Mahsulot asosini ko'rsating.\n\n<i>Masalan: suv, sut, yog', krem, xamir yoki boshqa asos.</i>", ru: "Укажите основу продукта.\n\n<i>Например: вода, молоко, жир, крем, тесто, алкогольная или другая основа.</i>" }, type: "text", required: false, options: [], mapTo: null },
        { id: "requirements", label: { uz: "Maxsus talablar bormi?\n\n<i>Masalan: issiqlikka chidamlilik, tabiiy profil, shakarsiz, eksport talablari, joriy mahsulotni almashtirish.</i>", ru: "Есть ли особые требования?\n\n<i>Например: термостойкость, натуральный профиль, отсутствие сахара, определённый цвет, экспортные требования, замена текущего продукта.</i>" }, type: "text", required: false, options: [], mapTo: null },
        {
          id: "volume",
          label: { uz: "Qanday ishlab chiqarish hajmini rejalashtiryapsiz?", ru: "Какой объём производства вы планируете?" },
          type: "choice",
          required: true,
          mapTo: null,
          options: [
            { uz: "Oyiga 100 kg/l gacha", ru: "До 100 кг/л в месяц" },
            { uz: "100–1 000 kg/l", ru: "100–1 000 кг/л" },
            { uz: "1 000–10 000 kg/l", ru: "1 000–10 000 кг/л" },
            { uz: "10 000 kg/l dan ko'p", ru: "Более 10 000 кг/л" },
            { uz: "Hozircha sinovdamiz", ru: "Пока тестируем продукт" },
          ],
        },
        {
          id: "timeline",
          label: { uz: "Mahsulotni qachon ishga tushirish kerak?", ru: "Когда вам необходимо запустить продукт?" },
          type: "choice",
          required: true,
          mapTo: null,
          options: [
            { uz: "Imkon qadar tezroq", ru: "Как можно скорее" },
            { uz: "1 oy ichida", ru: "В течение 1 месяца" },
            { uz: "1–3 oy ichida", ru: "В течение 1–3 месяцев" },
            { uz: "Keyinroq", ru: "Позже" },
            { uz: "Hozircha variantlarni o'rganyapmiz", ru: "Пока изучаем варианты" },
          ],
        },
        { id: "name", label: { uz: "Ismingiz va lavozimingizni kiriting:", ru: "Укажите ваше имя и должность:" }, type: "text", required: true, options: [], mapTo: "name" },
        { id: "phone", label: { uz: "Quyidagi tugma orqali raqamingizni yuboring yoki qo'lda kiriting.", ru: "Отправьте номер телефона через кнопку ниже или введите его вручную." }, type: "contact", required: true, options: [], mapTo: "phone" },
      ],
    },
    {
      id: "sample",
      name: "Namuna so'rovi",
      intro: { uz: "Namuna so'rovi uchun bir nechta savolga javob bering.", ru: "Для оформления запроса образца ответьте на несколько вопросов." },
      leadStatus: "QUALIFIED",
      tags: ["bot", "namuna"],
      notifyAdmin: true,
      successText: {
        uz: "Namuna so'rovi qabul qilindi.\n\nMutaxassisimiz siz bilan bog'lanib, mahsulotning texnik parametrlarini aniqlaydi va namuna mavjudligini tasdiqlaydi.\n\nSo'rov raqami: <b>#{id}</b>",
        ru: "Заявка на образец принята.\n\nНаш специалист свяжется с вами, уточнит технические параметры продукта и подтвердит доступность образца.\n\nНомер заявки: <b>#{id}</b>",
      },
      fields: [
        { id: "company", label: { uz: "Kompaniya nomi:", ru: "Название компании:" }, type: "text", required: true, options: [], mapTo: "company" },
        { id: "name", label: { uz: "Ism va lavozim:", ru: "Имя и должность:" }, type: "text", required: true, options: [], mapTo: "name" },
        { id: "phone", label: { uz: "Telefon raqami:", ru: "Номер телефона:" }, type: "contact", required: true, options: [], mapTo: "phone" },
        { id: "city", label: { uz: "Shahar:", ru: "Город:" }, type: "text", required: true, options: [], mapTo: "location" },
        { id: "industry", label: { uz: "Soha:", ru: "Отрасль:" }, type: "text", required: true, options: [], mapTo: null },
        { id: "product", label: { uz: "Qanday mahsulot ishlab chiqarasiz?", ru: "Какой продукт вы производите?" }, type: "text", required: true, options: [], mapTo: null },
        { id: "interest", label: { uz: "Qaysi mahsulot yoki yechim sizni qiziqtiradi?", ru: "Какой продукт или решение вас интересует?" }, type: "text", required: true, options: [], mapTo: null },
        { id: "volume", label: { uz: "Ishlab chiqarish hajmi:", ru: "Объём производства:" }, type: "text", required: false, options: [], mapTo: null },
        { id: "stage", label: { uz: "Loyihangiz qaysi bosqichda?", ru: "На каком этапе находится ваш проект?" }, type: "text", required: false, options: [], mapTo: null },
        { id: "testdate", label: { uz: "Sinovni qachon o'tkazishni rejalashtiryapsiz?", ru: "Когда вы планируете провести тестирование?" }, type: "text", required: false, options: [], mapTo: null },
      ],
    },
    {
      id: "order",
      name: "Buyurtma so'rovi",
      intro: {
        uz: "<b>Buyurtma rasmiylashtirish</b>\n\nKatalogdan mahsulot tanlashingiz yoki kerakli mahsulotga so'rov yuborishingiz mumkin.",
        ru: "<b>Оформление заказа</b>\n\nВы можете выбрать товар из каталога либо отправить заявку на нужную продукцию.",
      },
      leadStatus: "QUALIFIED",
      tags: ["bot", "buyurtma"],
      notifyAdmin: true,
      successText: {
        uz: "Rahmat! Buyurtma so'rovi muvaffaqiyatli yuborildi.\n\nMenejer mavjudlik, hajm, narx va yetkazib berish shartlarini tekshirib, buyurtmani tasdiqlash uchun siz bilan bog'lanadi.\n\nSo'rov raqami: <b>#{id}</b>",
        ru: "Спасибо! Заявка на заказ успешно отправлена.\n\nМенеджер проверит наличие, объём, стоимость и условия поставки, после чего свяжется с вами для подтверждения заказа.\n\nНомер заявки: <b>#{id}</b>",
      },
      fields: [
        { id: "company", label: { uz: "Kompaniya nomi:", ru: "Название компании:" }, type: "text", required: true, options: [], mapTo: "company" },
        { id: "name", label: { uz: "Mas'ul shaxs ismi:", ru: "Имя ответственного лица:" }, type: "text", required: true, options: [], mapTo: "name" },
        { id: "phone", label: { uz: "Telefon raqami:", ru: "Номер телефона:" }, type: "contact", required: true, options: [], mapTo: "phone" },
        { id: "product", label: { uz: "Mahsulot nomi yoki kodi:", ru: "Наименование или код продукта:" }, type: "text", required: true, options: [], mapTo: null },
        { id: "qty", label: { uz: "Kerakli miqdor:", ru: "Необходимое количество:" }, type: "text", required: true, options: [], mapTo: null },
        { id: "city", label: { uz: "Yetkazib berish shahri:", ru: "Город доставки:" }, type: "text", required: true, options: [], mapTo: "location" },
        { id: "deadline", label: { uz: "Yetkazib berishning kerakli muddati:", ru: "Желаемый срок поставки:" }, type: "text", required: false, options: [], mapTo: null },
        {
          id: "payment",
          label: { uz: "To'lov shakli:", ru: "Форма оплаты:" },
          type: "choice",
          required: true,
          mapTo: null,
          options: [
            { uz: "Naqd pulsiz to'lov", ru: "Безналичная оплата" },
            { uz: "Shartnoma bo'yicha to'lov", ru: "Оплата по договору" },
            { uz: "To'lov bo'yicha maslahat kerak", ru: "Нужна консультация по оплате" },
          ],
        },
        { id: "comment", label: { uz: "Qo'shimcha izoh:", ru: "Дополнительный комментарий:" }, type: "text", required: false, options: [], mapTo: null },
      ],
    },
    {
      id: "price",
      name: "Narx so'rovi",
      intro: {
        uz: "Tijorat taklifini tayyorlash uchun bir nechta ma'lumot kerak.\n\n<i>Yakuniy narx mahsulot, hajm, qadoqlash, yetkazib berish shartlari va joriy mavjudlikka bog'liq.</i>",
        ru: "Для подготовки коммерческого предложения нам нужно несколько данных.\n\n<i>Итоговая стоимость зависит от продукта, объёма, упаковки, условий поставки и текущего наличия.</i>",
      },
      leadStatus: "QUALIFIED",
      tags: ["bot", "narx-so'rovi"],
      notifyAdmin: true,
      successText: {
        uz: "So'rovingiz qabul qilindi.\n\nMenejer tijorat taklifini tayyorlab, siz bilan bog'lanadi.\n\nSo'rov raqami: <b>#{id}</b>",
        ru: "Ваш запрос принят.\n\nМенеджер подготовит коммерческое предложение и свяжется с вами.\n\nНомер заявки: <b>#{id}</b>",
      },
      fields: [
        { id: "company", label: { uz: "Kompaniya nomi:", ru: "Название компании:" }, type: "text", required: true, options: [], mapTo: "company" },
        { id: "product", label: { uz: "Qiziqtirgan mahsulot yoki kod:", ru: "Интересующий продукт или код:" }, type: "text", required: true, options: [], mapTo: null },
        { id: "volume", label: { uz: "Kerakli hajm:", ru: "Необходимый объём:" }, type: "text", required: true, options: [], mapTo: null },
        { id: "city", label: { uz: "Yetkazib berish shahri:", ru: "Город доставки:" }, type: "text", required: true, options: [], mapTo: "location" },
        { id: "name", label: { uz: "Aloqa uchun shaxs:", ru: "Контактное лицо:" }, type: "text", required: true, options: [], mapTo: "name" },
        { id: "phone", label: { uz: "Telefon raqami:", ru: "Номер телефона:" }, type: "contact", required: true, options: [], mapTo: "phone" },
      ],
    },
    {
      id: "callback",
      name: "Qayta qo'ng'iroq",
      intro: { uz: "Ma'lumotlaringizni qoldiring — menejer bog'lanadi.", ru: "Оставьте свои данные — менеджер свяжется с вами." },
      leadStatus: "NEW",
      tags: ["bot", "qayta-qongiroq"],
      notifyAdmin: true,
      successText: {
        uz: "Murojaatingiz qabul qilindi.\n\nMenejer eng yaqin ish vaqtida siz bilan bog'lanadi.\n\nSo'rov raqami: <b>#{id}</b>",
        ru: "Ваше обращение принято.\n\nМенеджер свяжется с вами в ближайшее рабочее время.\n\nНомер заявки: <b>#{id}</b>",
      },
      fields: [
        { id: "name", label: { uz: "Ismingiz:", ru: "Ваше имя:" }, type: "text", required: true, options: [], mapTo: "name" },
        { id: "phone", label: { uz: "Telefon raqami:", ru: "Номер телефона:" }, type: "contact", required: true, options: [], mapTo: "phone" },
        { id: "question", label: { uz: "Savolingizni qisqacha yozing:", ru: "Кратко опишите ваш вопрос:" }, type: "text", required: true, options: [], mapTo: null },
      ],
    },
  ],
};

// ─── BLANK ──────────────────────────────────────────────────────────────────

const blank: BotFlowDefinition = {
  version: 1,
  settings: {
    startScreenId: "main",
    welcome: { uz: "", ru: "" },
    defaultLang: "uz",
    languages: ["uz", "ru"],
    askLanguageOnStart: false,
    showStoreButton: false,
    storeButtonLabel: { uz: "🛍 Do'kon", ru: "🛍 Магазин" },
    fallback: "lead",
    fallbackText: {
      uz: "✅ Xabaringiz qabul qilindi.",
      ru: "✅ Ваше сообщение принято.",
    },
    commands: [{ command: "start", description: { uz: "Bosh menyu", ru: "Главное меню" }, screenId: null }],
  },
  screens: [
    {
      id: "main",
      name: "Bosh menyu",
      text: { uz: "Kerakli bo'limni tanlang:", ru: "Выберите нужный раздел:" },
      imageUrl: null,
      showBack: false,
      buttons: [],
    },
  ],
  forms: [],
};

// ─── Eksport ────────────────────────────────────────────────────────────────

const TEMPLATES: Record<BotTemplateId, BotFlowDefinition> = { retail, b2b, blank };

export const TEMPLATE_LIST: BotTemplateMeta[] = [
  {
    id: "retail",
    name: { uz: "Chakana do'kon", ru: "Розничный магазин" },
    description: {
      uz: "Mini App do'koni, katalog, buyurtma kuzatish va yordam. Hozirgi standart botning ekvivalenti.",
      ru: "Магазин Mini App, каталог, отслеживание заказа и поддержка. Эквивалент стандартного бота.",
    },
    screens: retail.screens.length,
    forms: retail.forms.length,
  },
  {
    id: "b2b",
    name: { uz: "B2B — ishlab chiqaruvchilar", ru: "B2B — производителям" },
    description: {
      uz: "Ko'p bosqichli katalog, sohalar, yechim tanlash anketasi, namuna va narx so'rovlari. Savatsiz — har bir yo'l lidga olib boradi.",
      ru: "Многоуровневый каталог, отрасли, анкета подбора решения, запросы образцов и цен. Без корзины — каждый путь ведёт к заявке.",
    },
    screens: b2b.screens.length,
    forms: b2b.forms.length,
  },
  {
    id: "blank",
    name: { uz: "Bo'sh", ru: "Пустой" },
    description: {
      uz: "Bitta bo'sh bosh ekran — noldan qurish uchun.",
      ru: "Один пустой главный экран — для сборки с нуля.",
    },
    screens: blank.screens.length,
    forms: blank.forms.length,
  },
];

/** Shablon nusxasini qaytaradi (chuqur nusxa — chaqiruvchi o'zgartira oladi). */
export function getTemplate(id: BotTemplateId): BotFlowDefinition {
  return JSON.parse(JSON.stringify(TEMPLATES[id])) as BotFlowDefinition;
}
