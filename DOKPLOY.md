# Dokploy bilan deploy

ShopFlow — toza frontend SPA. **Postgres yoki Redis kerak emas** — kodda DB ham cache ham ishlatilmaydi. Dokploy'da faqat bitta **Application** xizmati yaratish kifoya.

## 1. Eski xizmatlarni o'chirish

Agar oldindan Postgres yoki Redis qo'shgan bo'lsangiz — Dokploy UI'dan ularni o'chiring. Ular keraksiz va resursni behuda band qiladi. Redis deploy paytidagi xatolik ham shu bilan yo'qoladi.

## 2. Application yaratish

1. Dokploy → **Create Service** → **Application**
2. **Source**: GitHub → `Elmun-Technologies/shopflow` → branch `main` (yoki ishlatadigan branchingiz)
3. **Build Type**: **Dockerfile**
4. **Dockerfile Path**: `./Dockerfile` (root'da)
5. **Port**: `80`
6. Environment Variables: hech narsa shart emas (`VITE_BASE_PATH=/` Dockerfile ichida o'rnatilgan)

## 3. Domain

- **Domains** bo'limidan domain qo'shing
- **Container Port**: `80`
- HTTPS uchun **Let's Encrypt** ni yoqing

## 4. Deploy

**Deploy** tugmasini bosing. Log'larda quyidagilar ko'rinishi kerak:

```
=> [build] RUN npm ci
=> [build] RUN npm run build
=> [runtime] COPY --from=build /app/dist /usr/share/nginx/html
=> Container started
```

Tugagach domainni oching — ShopFlow dashboard ko'rinadi.

## 5. Mahalliy sinov (ixtiyoriy)

Dokploy'ga jo'natishdan oldin lokal sinab ko'rish:

```bash
docker build -t shopflow .
docker run --rm -p 8080:80 shopflow
# http://localhost:8080 ni oching
```

## Muammolar (troubleshooting)

- **Build "npm ci" da to'xtaydi** — `package-lock.json` repo'da borligini tekshiring (bor)
- **404 sahifa yangilanganda** — nginx.conf'da SPA fallback bor (`try_files ... /index.html`), agar problema bo'lsa Dokploy'da to'g'ri Dockerfile ishlatilayotganini tekshiring
- **GitHub Pages buzilganmi?** — Yo'q. Workflow `VITE_BASE_PATH` ni o'rnatmaydi → default `/shopflow/` ishlatiladi, eski xatti-harakat saqlanadi
