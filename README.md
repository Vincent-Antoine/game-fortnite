# Dette Royale

PWA pour compter kills, réas et dettes entre potes sur Fortnite.

## Local

1. Copie `.env.example` vers `.env`
2. Lance Postgres : `docker compose up -d`
3. `npm run db:push` (ou le SQL `drizzle/0000_init.sql` est déjà chargé au premier start Docker)
4. `npm run dev`

## Vercel + Neon

1. Crée une base [Neon](https://neon.tech)
2. Colle l’URL (pooled, `ssl`) dans `DATABASE_URL` sur Vercel
3. Exécute `drizzle/0000_init.sql` dans Neon (SQL Editor)
4. Déploie le repo sur Vercel
5. Sur le téléphone : Safari/Chrome → Partager → Sur l’écran d’accueil
