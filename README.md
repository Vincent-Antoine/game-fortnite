# Dette Royale

PWA pour compter kills, réas et dettes entre potes sur Fortnite.

## Local

1. Copie `.env.example` vers `.env`
2. Lance Postgres : `docker compose up -d`
3. Exécute `drizzle/0000_init.sql` puis `drizzle/0001_avatars.sql`
4. `npm run dev`

## Vercel

Repo : https://github.com/Vincent-Antoine/game-fortnite

1. Neon : crée une base, exécute `drizzle/0000_init.sql` puis `drizzle/0001_avatars.sql`
2. Vercel : importe le repo, variable `DATABASE_URL` = URL pooled Neon
3. Deploy, puis sur le téléphone : ouvrir le site → Ajouter à l’écran d’accueil
