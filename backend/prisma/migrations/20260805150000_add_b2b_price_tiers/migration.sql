-- B2B/ulgurji narx pog'onalari + MOQ + o'lchov birligi.
-- Maʼlumot xarakterida: mijozga ko'rsatiladi, B2B'da yakuniy narxni menejer tasdiqlaydi.
-- To'liq orqaga mos: priceTiers default '[]', moq/unit nullable — migratsiya faqat ustun qo'shadi.

ALTER TABLE "Product" ADD COLUMN     "priceTiers" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN     "moq" INTEGER;
ALTER TABLE "Product" ADD COLUMN     "unit" TEXT;
