# 🚀 ViralAgent Pro - Backend 100% Autonome

Backend Node.js pour publication automatique TikTok & Instagram avec **Gemini comme orchestrateur**.

## ⚙️ Fonctionnalités

✅ **Gemini 2.0 Flash** - Crée persona, hooks, scripts uniques (anti-doublon)
✅ **Apprentissage automatique** - Analyse performances toutes les 3 vidéos
✅ **Pexels API** - Vidéos verticales gratuites 9:16
✅ **Edge TTS** - Voix française naturelle (Denise/Henri)
✅ **FFmpeg** - Montage + sous-titres dynamiques
✅ **Playwright** - Publication auto TikTok/Instagram (automatisation navigateur)
✅ **Cron 19:30** - Publie tous les jours heure Abidjan
✅ **WhatsApp par produit** - Chaque produit → numéro différent

## 🚂 Déploiement Railway (5$/mois - 500h gratuit)

### 1. Préparer le code
```bash
cd backend
git init
git add .
git commit -m "ViralAgent backend"
```

### 2. Railway
1. Va sur **railway.app** → Sign up avec GitHub
2. New Project → Deploy from GitHub repo
3. Sélectionne ton repo backend
4. Variables :
   - `GEMINI_API_KEY` = ta clé (aistudio.google.com)
   - `PEXELS_API_KEY` = clé gratuite pexels.com/api
   - `TZ` = Africa/Abidjan
5. Deploy !

Railway installe automatiquement Playwright + FFmpeg (postinstall).

### 3. Connecter le dashboard
Dans ton app Netlify (frontend) :
- Paramètres → Backend URL → colle `https://ton-app.up.railway.app`
- Clique "Tester"

## 🆓 Alternative 100% Gratuite (Render)

Render offre 750h/mois gratuit (suffisant).

1. **render.com** → New Web Service
2. Connect GitHub
3. Build: `npm install`
4. Start: `npm start`
5. Variables identiques

⚠️ S'endort après 15min sans requête → utilise UptimeRobot pour ping toutes les 5min.

## 🧪 Test local

```bash
npm install
cp .env.example .env
# édite .env avec tes clés
npm start
```

API : http://localhost:3000/api/health

## 📡 Endpoints

- `POST /api/config` - Envoie produits/comptes depuis frontend
- `POST /api/run-now` - Lance publication immédiate
- `GET /api/state` - Voir jobs, learning
- `POST /api/learn` - Force apprentissage

## 🔐 Première connexion comptes

La 1ère fois, Playwright ouvre TikTok/Instagram :
1. Va sur `/data/cookies_a1.json`
2. Connecte-toi manuellement une fois
3. Cookies sauvegardés → publication auto ensuite

**Alternative** : utilise mode semi-auto (frontend génère vidéo, tu postes manuellement).

## 💰 Coûts

- Railway : 5$/mois (ou 0$ les 500 premières heures)
- Gemini : ~0.06$/mois (30 vidéos)
- Pexels : 0$
- **Total : 5$ / 3000 FCFA par mois**

## 🌍 Architecture complète

```
[Netlify PWA] ←→ [Railway Backend] ←→ [Gemini]
      |                |
      |                ├→ Pexels (vidéo)
      |                ├→ Edge TTS (voix)
      |                ├→ FFmpeg (montage)
      |                └→ Playwright (publie)
      |
[Toi] configure une fois
```

Tout tourne à 19h30 même si ton téléphone est éteint.