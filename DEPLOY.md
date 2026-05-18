# GitHub orqali avtomatik deploy

Bu qo'llanma har `git push` da serverga avtomatik deploy qilishni sozlaydi. Bir marta sozlasangiz, keyin kod yozish + commit + push kifoya.

## Umumiy ish prinsipi

```
[Siz kod yozasiz]
       ↓
   git push
       ↓
GitHub Actions: typecheck + lint + test + build
       ↓
SSH to Kamatera VPS (avtomatik)
       ↓
git pull + docker compose up -d --build
       ↓
Live: https://shopflow.example.com
```

---

## ⚡ Tezkor sozlash (15 daqiqa)

### 1-qadam: Serverni bir martalik bootstrap qilish

**Mahalliy kompyuteringizda** terminal oching va Kamatera serverga ulaning:

```bash
ssh root@<vps-ip>
# Parolni kiriting
```

Server ichida bitta buyruq:

```bash
curl -fsSL https://raw.githubusercontent.com/Elmun-Technologies/shopflow/claude/conduct-full-audit-6lZcQ/scripts/bootstrap.sh | bash -s -- claude/conduct-full-audit-6lZcQ
```

Skript so'raydi:
- **Domain**: agar domain bo'lsa kiriting (masalan `shopflow.example.com`), agar yo'q bo'lsa `:80` yozing (IP orqali HTTP only ishlaydi)
- **Email**: Let's Encrypt sertifikat uchun (agar domain bo'lsa)

Skript 3-5 daqiqada hammasini o'rnatadi va saytni ishga tushiradi.

### 2-qadam: SSH kalit yaratish (GitHub uchun)

**Serverda** (hali SSH session ichidasiz):

```bash
# Yangi SSH kalit yaratish (parolsiz, GitHub Actions uchun)
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github-actions -C "github-actions@shopflow"

# Public key'ni authorized_keys'ga qo'shish
cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Private key'ni ekranga chiqarish — keyingi qadamda kerak bo'ladi
cat ~/.ssh/github-actions
```

`-----BEGIN OPENSSH PRIVATE KEY-----` dan boshlanib `-----END OPENSSH PRIVATE KEY-----` gacha **butun blokni** nusxalang (terminaldan).

### 3-qadam: GitHub Secrets qo'shish

Brauzerda oching:
**https://github.com/Elmun-Technologies/shopflow/settings/secrets/actions**

"**New repository secret**" tugmasini bosing va quyidagi 3 ta secret qo'shing:

| Secret nomi | Qiymat |
|-------------|--------|
| `VPS_HOST` | Server IP, masalan `83.229.86.232` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | 2-qadamda nusxalagan private key (`-----BEGIN ...` dan oxirigacha) |

Ixtiyoriy:
| `VPS_PORT` | `22` (default, agar boshqa port bo'lmasa shart emas) |

### 4-qadam: Test qiling

GitHub'da: **Actions** tab → **"Deploy to VPS"** workflow → **"Run workflow"** → branch tanlang → **Run**.

Yoki shunchaki yangi commit qiling va push qiling — avtomatik trigger bo'ladi.

---

## 📊 Workflow nimalarni qiladi

1. **Test bosqichi** (har push'da):
   - Kodni yuklaydi
   - Node.js o'rnatadi
   - `npm ci` (paketlar)
   - `npm run typecheck` — TypeScript tekshiruvi
   - `npm run lint` — ESLint
   - `npm run test` — 43 ta test
   - `npm run build` — production build

2. **Deploy bosqichi** (faqat test o'tsa, asosiy branch'da):
   - SSH bilan VPS'ga ulanadi
   - `git pull` so'nggi kodni oladi
   - `docker compose up -d --build` — yangi versiyani ishga tushiradi
   - Eski Docker image'larni tozalaydi
   - `/health` endpoint'ni tekshiradi

Agar testlar muvaffaqiyatsiz bo'lsa, deploy ishlamaydi — production hech qachon buzilmaydi.

---

## 🔄 Kundalik ish jarayoni

Bir marta sozlanganidan keyin:

```bash
# Mahalliy kompyuteringizda
git add .
git commit -m "yangi xususiyat qo'shildi"
git push

# Tamom — 2-3 daqiqada serverda ko'rinadi
```

GitHub'da Actions tab'ida deploy jarayonini real-time kuzata olasiz.

---

## 🛠 Qo'lda deploy (agar kerak bo'lsa)

Agar tez bir narsani yangilamoqchi bo'lsangiz GitHub'siz:

```bash
ssh root@<vps-ip>
cd /opt/shopflow
git pull
docker compose up -d --build
```

---

## 🔍 Muammolarni hal qilish

### "Permission denied (publickey)"
SSH kalit noto'g'ri qo'yilgan. 2-qadamni qaytaring va `VPS_SSH_KEY` ni qayta qo'ying (butun key, jumladan BEGIN/END qatorlari).

### "Connection refused"
- Server ishlamayotgan bo'lishi mumkin. Kamatera panel'da tekshiring
- Yoki firewall port 22'ni bloklayapti. `ufw status` bilan tekshiring

### Deploy o'tdi lekin sayt yangilanmadi
```bash
ssh root@<vps-ip>
cd /opt/shopflow
docker compose logs --tail=50
```

### Test bosqichi muvaffaqiyatsiz
`npm run typecheck`, `npm run lint`, `npm run test` ni mahalliy kompyuteringizda ishga tushiring va xatolarni tuzating.

---

## 🔐 Xavfsizlik bo'yicha eslatma

- Server `root` foydalanuvchisi bilan ulanadi — bu oddiy lekin xavfli. Production uchun alohida foydalanuvchi (`deploy`) yaratish va undan foydalanish tavsiya etiladi
- SSH kalit fayli serverda saqlanadi — agar VPS xavfsizligi buzilsa, yangi kalit yarating va eski public key'ni `~/.ssh/authorized_keys` dan o'chiring
- GitHub Secrets shifrlangan holda saqlanadi va faqat workflow ichida ko'rinadi
