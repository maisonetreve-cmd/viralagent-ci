// ViralAgent Pro - Backend GitHub Actions
// Groq (principal) + Pexels + FFmpeg + Edge TTS + Playwright
// 100% gratuit - Cote d'Ivoire

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PEXELS_KEY = process.env.PEXELS_API_KEY || '';
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Créer dossiers
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================
// LOGS
// ============================================
function log(msg) {
  const time = new Date().toLocaleTimeString('fr-FR');
  console.log(`[${time}] ${msg}`);
}

// ============================================
// CHARGER CONFIG
// ============================================
function loadState() {
  const statePath = path.join(DATA_DIR, 'state.json');
  if (fs.existsSync(statePath)) {
    try {
      const raw = fs.readFileSync(statePath, 'utf8');
      const data = JSON.parse(raw);
      log(`✅ Config chargée: ${data.products?.length || 0} produits, ${data.accounts?.length || 0} comptes`);
      return data;
    } catch (e) {
      log(`⚠️ Erreur lecture state.json: ${e.message}`);
    }
  }
  log('⚠️ Pas de state.json - utilisation config demo');
  return getDemoState();
}

function getDemoState() {
  return {
    products: [
      {
        id: 'demo1',
        nom: 'Blender Portable USB',
        type: 'physique',
        prix: '12500',
        description: 'Blender rechargeable parfait pour smoothies et jus frais',
        whatsapp: process.env.WHATSAPP_DEFAULT || '2250700000000'
      }
    ],
    accounts: [
      {
        id: 'acc1',
        plateforme: 'TikTok',
        login: '@demo_compte',
        actif: true,
        produits: ['demo1']
      }
    ],
    settings: {
      pays: "Côte d'Ivoire",
      monnaie: 'FCFA',
      whatsappDefault: process.env.WHATSAPP_DEFAULT || '2250700000000',
      heurePublication: '19:30'
    },
    learning: {
      bestHooks: [],
      worstHooks: [],
      videoHistory: []
    }
  };
}

// ============================================
// APPEL LLM (GROQ EN PRIORITÉ)
// ============================================
async function callLLM(prompt) {
  // Essai 1 : Groq
  if (GROQ_KEY) {
    try {
      log('🧠 Appel Groq (llama-3.3-70b)...');
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 1000
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      const text = res.data.choices[0].message.content;
      log('✅ Groq OK');
      return text;
    } catch (e) {
      log(`⚠️ Groq erreur: ${e.message} - essai Gemini...`);
    }
  }

  // Essai 2 : Gemini
  if (GEMINI_KEY) {
    try {
      log('🧠 Appel Gemini 2.0 Flash...');
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 30000 }
      );
      const text = res.data.candidates[0].content.parts[0].text;
      log('✅ Gemini OK');
      return text;
    } catch (e) {
      log(`⚠️ Gemini erreur: ${e.message} - mode local...`);
    }
  }

  // Essai 3 : Mode local
  log('⚠️ Pas de LLM disponible - génération locale');
  return null;
}

// ============================================
// CRÉER SCRIPT VIRAL
// ============================================
async function createScript(product, state) {
  const bestHooks = state.learning?.bestHooks?.slice(0, 3) || [];
  const worstHooks = state.learning?.worstHooks?.slice(0, 3) || [];
  const whatsapp = product.whatsapp || state.settings?.whatsappDefault || '2250700000000';

  const prompt = `Tu es un expert marketing TikTok pour la Côte d'Ivoire.

PRODUIT: ${product.nom}
PRIX: ${product.prix} FCFA
DESCRIPTION: ${product.description}
WHATSAPP: ${whatsapp}

${bestHooks.length > 0 ? `HOOKS QUI MARCHENT (réutilise ce style): ${bestHooks.join(', ')}` : ''}
${worstHooks.length > 0 ? `HOOKS À ÉVITER: ${worstHooks.join(', ')}` : ''}

Crée un script TikTok viral de 20 secondes pour Abidjan.
RÈGLES:
- Hook choc (0-3s) qui surprend
- Parle comme un ivoirien authentique (pas de nouchi excessif)
- Mentionne un problème réel de la vie quotidienne à Abidjan
- Solution = le produit
- CTA: "Écris-moi sur WhatsApp 👉 wa.me/${whatsapp}"
- JAMAIS de hook déjà utilisé

Réponds en JSON:
{
  "persona": "prénom, âge, quartier",
  "hook": "phrase d'accroche 0-3s",
  "probleme": "douleur du client",
  "solution": "comment le produit aide",
  "preuve": "chiffre ou bénéfice concret",
  "cta": "appel à action",
  "narration": "texte complet 20 secondes à lire",
  "hashtags": ["#tag1", "#tag2"],
  "description": "description optimisée TikTok"
}`;

  const response = await callLLM(prompt);

  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const script = JSON.parse(jsonMatch[0]);
        log(`✅ Script créé - Persona: ${script.persona}`);
        log(`🎣 Hook: "${script.hook}"`);
        return script;
      }
    } catch (e) {
      log(`⚠️ Parse JSON erreur: ${e.message}`);
    }
  }

  // Script local de secours
  const hooks = [
    `POV : tu cherches ${product.nom} à Abidjan et tu paies trop cher...`,
    `Les gens d'Abidjan connaissent pas encore ça ! ${product.nom} à ${product.prix} FCFA`,
    `Attends ! Avant d'aller au marché, regarde ça - ${product.nom}`,
    `Ma sœur m'a montré ça et j'ai économisé avec ${product.nom}`,
    `Pourquoi tu dépenses plus alors que ${product.nom} existe ?`
  ];

  const personas = [
    'Kadidia, 24 ans, Yopougon',
    'Awa, 28 ans, Cocody',
    'Kevin, 23 ans, Adjamé',
    'Mariam, 31 ans, Treichville',
    'Kofi, 26 ans, Abobo'
  ];

  const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
  const randomPersona = personas[Math.floor(Math.random() * personas.length)];

  return {
    persona: randomPersona,
    hook: randomHook,
    probleme: `Trouver ${product.nom} de qualité à bon prix à Abidjan`,
    solution: `${product.nom} disponible maintenant à seulement ${product.prix} FCFA`,
    preuve: `Déjà plus de 200 clients satisfaits à Abidjan`,
    cta: `Écris-moi sur WhatsApp 👉 wa.me/${whatsapp}`,
    narration: `${randomHook} Moi c'est ${randomPersona.split(',')[0]}, j'ai trouvé ${product.nom} à ${product.prix} FCFA seulement. ${product.description}. Plus de 200 personnes à Abidjan l'ont déjà. Écris-moi sur WhatsApp maintenant !`,
    hashtags: ['#abidjan', '#bonplan225', '#cotedivoire', '#tiktokci', `#${product.nom.toLowerCase().replace(/\s/g, '')}`],
    description: `🔥 ${product.nom} à ${product.prix} FCFA seulement ! Contacte-moi sur WhatsApp 👉 wa.me/${whatsapp}\n\n#abidjan #bonplan225 #cotedivoire`
  };
}

// ============================================
// TÉLÉCHARGER VIDÉO PEXELS
// ============================================
async function downloadPexelsVideo(query, outputPath) {
  if (!PEXELS_KEY) {
    log('⚠️ Pas de clé Pexels - création fond coloré');
    return createColorBackground(outputPath);
  }

  try {
    log(`🎥 Recherche Pexels: "${query}"...`);
    const searches = [query, 'african market', 'african woman shopping', 'african business', 'abidjan'];

    for (const searchQuery of searches) {
      try {
        const res = await axios.get('https://api.pexels.com/videos/search', {
          headers: { Authorization: PEXELS_KEY },
          params: {
            query: searchQuery,
            per_page: 15,
            page: Math.floor(Math.random() * 3) + 1,
            orientation: 'portrait'
          },
          timeout: 15000
        });

        const videos = res.data.videos;
        if (!videos || videos.length === 0) continue;

        const video = videos[Math.floor(Math.random() * videos.length)];
        const files = video.video_files.filter(f => f.width <= 1080);
        if (!files.length) continue;

        const bestFile = files.reduce((a, b) =>
          Math.abs(a.width - 720) < Math.abs(b.width - 720) ? a : b
        );

        log(`⬇️ Téléchargement vidéo Pexels (${bestFile.width}x${bestFile.height})...`);

        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
          url: bestFile.link,
          method: 'GET',
          responseType: 'stream',
          timeout: 60000
        });

        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        const stats = fs.statSync(outputPath);
        if (stats.size > 100000) {
          log(`✅ Vidéo Pexels OK (${Math.round(stats.size / 1024)} Ko)`);
          return true;
        }
      } catch (e) {
        log(`⚠️ Pexels "${searchQuery}": ${e.message}`);
        continue;
      }
    }
  } catch (e) {
    log(`⚠️ Pexels erreur: ${e.message}`);
  }

  log('⚠️ Pexels échoué - fond coloré utilisé');
  return createColorBackground(outputPath);
}

// ============================================
// CRÉER FOND COLORÉ (fallback sans Pexels)
// ============================================
function createColorBackground(outputPath) {
  try {
    const colors = ['0066CC', 'FF6600', '009900', 'CC0066', '6600CC'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    execSync(
      `ffmpeg -f lavfi -i color=c=#${color}:size=1080x1920:rate=30 -t 25 -c:v libx264 -preset ultrafast -y "${outputPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
    log('✅ Fond coloré créé');
    return true;
  } catch (e) {
    log(`❌ Erreur fond coloré: ${e.message}`);
    return false;
  }
}

// ============================================
// GÉNÉRER VOIX (Edge TTS via commande système ou fallback)
// ============================================
async function generateVoice(text, outputPath) {
  // Essai 1 : edge-tts (si installé)
  try {
    execSync(`edge-tts --voice fr-FR-DeniseNeural --text "${text.replace(/"/g, "'").substring(0, 500)}" --write-media "${outputPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      log('✅ Voix Edge TTS OK');
      return true;
    }
  } catch (e) {
    log(`⚠️ Edge TTS: ${e.message}`);
  }

  // Essai 2 : Créer silence (permet quand même la vidéo)
  try {
    execSync(
      `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 20 -c:a aac -y "${outputPath}"`,
      { stdio: 'pipe', timeout: 15000 }
    );
    log('⚠️ Audio silence (ajoute voix manuellement)');
    return true;
  } catch (e) {
    log(`❌ Audio erreur: ${e.message}`);
    return false;
  }
}

// ============================================
// MONTER LA VIDÉO FINALE
// ============================================
async function buildVideo(bgPath, audioPath, script, outputPath) {
  return new Promise((resolve) => {
    const hook = (script.hook || '').replace(/'/g, "\\'").substring(0, 60);
    const cta = (script.cta || '').replace(/'/g, "\\'").substring(0, 60);
    const produit = (script.solution || '').replace(/'/g, "\\'").substring(0, 50);

    // Filtres sous-titres dynamiques style TikTok
    const drawtext = [
      // Fond semi-transparent en haut
      `drawbox=x=0:y=80:w=iw:h=120:color=black@0.6:t=fill`,
      // Hook en haut (blanc, gras)
      `drawtext=text='${hook}':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=100:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:enable='between(t,0,8)'`,
      // Produit au milieu
      `drawbox=x=0:y=820:w=iw:h=100:color=black@0.5:t=fill`,
      `drawtext=text='${produit}':fontsize=36:fontcolor=yellow:x=(w-text_w)/2:y=840:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:enable='between(t,5,15)'`,
      // CTA en bas (rouge vif)
      `drawbox=x=0:y=1700:w=iw:h=120:color=red@0.85:t=fill`,
      `drawtext=text='${cta}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=1725:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:enable='between(t,10,20)'`
    ].join(',');

    const hasAudio = fs.existsSync(audioPath) && fs.statSync(audioPath).size > 1000;
    const audioInput = hasAudio ? `-i "${audioPath}"` : '';
    const audioMap = hasAudio ? '-map 0:v -map 1:a' : '';
    const audioCodec = hasAudio ? '-c:a aac -shortest' : '-an';

    const cmd = `ffmpeg -i "${bgPath}" ${audioInput} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${drawtext}" ${audioMap} -c:v libx264 -preset ultrafast -crf 28 ${audioCodec} -t 22 -y "${outputPath}"`;

    log('🎬 FFmpeg montage en cours...');
    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        log(`⚠️ FFmpeg erreur: ${err.message}`);
        // Essai simple sans texte
        const simpleCmd = `ffmpeg -i "${bgPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:v libx264 -preset ultrafast -an -t 22 -y "${outputPath}"`;
        exec(simpleCmd, { timeout: 60000 }, (err2) => {
          if (err2) {
            log(`❌ FFmpeg simple erreur: ${err2.message}`);
            resolve(false);
          } else {
            log('✅ Vidéo simple OK (sans sous-titres)');
            resolve(true);
          }
        });
      } else {
        log('✅ Vidéo montée avec sous-titres');
        resolve(true);
      }
    });
  });
}

// ============================================
// SAUVEGARDER RÉSULTAT
// ============================================
function saveResult(state, account, product, script, videoPath) {
  const result = {
    id: uuidv4(),
    date: new Date().toISOString(),
    account: account.login,
    plateforme: account.plateforme,
    product: product.nom,
    hook: script.hook,
    persona: script.persona,
    videoPath: videoPath,
    views: 0,
    likes: 0,
    statut: 'généré'
  };

  if (!state.learning) state.learning = { bestHooks: [], worstHooks: [], videoHistory: [] };
  if (!state.learning.videoHistory) state.learning.videoHistory = [];

  state.learning.videoHistory.push(result);

  // Garder seulement les 30 derniers
  if (state.learning.videoHistory.length > 30) {
    state.learning.videoHistory = state.learning.videoHistory.slice(-30);
  }

  const statePath = path.join(DATA_DIR, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  log(`💾 Résultat sauvegardé: ${account.login} - ${product.nom}`);

  return result;
}

// ============================================
// APPRENTISSAGE AUTOMATIQUE
// ============================================
async function learnFromHistory(state) {
  const history = state.learning?.videoHistory || [];
  if (history.length < 3) {
    log(`📊 Apprentissage: ${history.length}/3 vidéos nécessaires`);
    return;
  }

  log('🧠 Apprentissage automatique en cours...');

  const withStats = history.filter(v => v.views > 0);
  if (withStats.length === 0) {
    log('📊 Pas encore de stats de vues - apprentissage reporté');
    return;
  }

  const sorted = [...withStats].sort((a, b) => b.views - a.views);
  const best = sorted.slice(0, 3).map(v => v.hook);
  const worst = sorted.slice(-3).map(v => v.hook);

  state.learning.bestHooks = best;
  state.learning.worstHooks = worst;

  log(`✅ Apprentissage: meilleurs hooks = ${best.slice(0, 1).join(', ')}`);

  const prompt = `Analyse ces données TikTok Côte d'Ivoire:
MEILLEURS HOOKS (${sorted[0]?.views || 0} vues): ${best.join(' | ')}
MAUVAIS HOOKS (${sorted[sorted.length-1]?.views || 0} vues): ${worst.join(' | ')}
Donne 1 conseil en 1 phrase pour améliorer les prochains hooks.`;

  const conseil = await callLLM(prompt);
  if (conseil) {
    log(`💡 Conseil IA: ${conseil.substring(0, 100)}...`);
    state.learning.lastAdvice = conseil;
  }
}

// ============================================
// PLAN QUOTIDIEN PRINCIPAL
// ============================================
async function runDailyPlan() {
  log('');
  log('========================================');
  log('🚀 VIRALAGENT PRO - DÉMARRAGE');
  log(`📅 ${new Date().toLocaleString('fr-FR')}`);
  log('========================================');

  const state = loadState();

  if (!state.products || state.products.length === 0) {
    log('❌ Aucun produit configuré. Ajoute des produits dans l\'app Netlify.');
    process.exit(1);
  }

  if (!state.accounts || state.accounts.length === 0) {
    log('❌ Aucun compte configuré. Ajoute des comptes dans l\'app Netlify.');
    process.exit(1);
  }

  const activeAccounts = state.accounts.filter(a => a.actif !== false);
  log(`👥 ${activeAccounts.length} compte(s) actif(s) sur ${state.accounts.length}`);

  // Apprentissage automatique
  await learnFromHistory(state);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < activeAccounts.length; i++) {
    const account = activeAccounts[i];
    log('');
    log(`--- Compte ${i + 1}/${activeAccounts.length}: ${account.plateforme} ${account.login} ---`);

    // Choisir produit pour ce compte
    const accountProducts = account.produits || [];
    const availableProducts = state.products.filter(p =>
      accountProducts.length === 0 || accountProducts.includes(p.id)
    );

    if (availableProducts.length === 0) {
      log(`⚠️ Aucun produit assigné à ${account.login} - skip`);
      continue;
    }

    // Rotation : choisir produit pas encore utilisé récemment
    const recentHooks = (state.learning?.videoHistory || [])
      .filter(v => v.account === account.login)
      .slice(-5)
      .map(v => v.product);

    let product = availableProducts.find(p => !recentHooks.includes(p.nom));
    if (!product) product = availableProducts[Math.floor(Math.random() * availableProducts.length)];

    log(`📦 Produit choisi: ${product.nom}`);

    const jobId = uuidv4().substring(0, 8);
    const bgPath = path.join(OUTPUT_DIR, `bg_${jobId}.mp4`);
    const audioPath = path.join(OUTPUT_DIR, `audio_${jobId}.mp3`);
    const finalPath = path.join(OUTPUT_DIR, `video_${account.plateforme}_${jobId}.mp4`);

    try {
      // 1. Créer script avec LLM
      log('📝 Création script viral...');
      const script = await createScript(product, state);

      // 2. Télécharger fond vidéo
      const searchQuery = `${product.nom} africa shopping`;
      await downloadPexelsVideo(searchQuery, bgPath);

      // 3. Générer voix
      log('🗣️ Génération voix...');
      await generateVoice(script.narration || script.hook, audioPath);

      // 4. Monter vidéo
      const videoOk = await buildVideo(bgPath, audioPath, script, finalPath);

      if (videoOk && fs.existsSync(finalPath)) {
        const stats = fs.statSync(finalPath);
        log(`✅ Vidéo créée: ${path.basename(finalPath)} (${Math.round(stats.size / 1024)} Ko)`);

        // 5. Sauvegarder résultat
        saveResult(state, account, product, script, finalPath);

        // 6. Afficher description pour publication manuelle
        log('');
        log('📋 DESCRIPTION POUR TIKTOK/INSTAGRAM:');
        log('---');
        log(script.description || `🔥 ${product.nom} - ${product.prix} FCFA\nwa.me/${product.whatsapp || state.settings?.whatsappDefault}`);
        log('---');
        log(`🏷️ HASHTAGS: ${(script.hashtags || []).join(' ')}`);

        successCount++;
      } else {
        log(`❌ Vidéo échouée pour ${account.login}`);
        failCount++;
      }

      // Nettoyage fichiers temporaires
      [bgPath, audioPath].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });

      // Pause entre comptes (5 min = évite détection)
      if (i < activeAccounts.length - 1) {
        log('⏳ Pause 10 secondes avant prochain compte...');
        await new Promise(r => setTimeout(r, 10000));
      }

    } catch (e) {
      log(`❌ Erreur compte ${account.login}: ${e.message}`);
      failCount++;
    }
  }

  log('');
  log('========================================');
  log(`✅ TERMINÉ: ${successCount} vidéo(s) créée(s), ${failCount} échec(s)`);
  log(`📁 Vidéos dans: output/ (télécharge depuis GitHub Artifacts)`);
  log('========================================');

  if (successCount === 0 && failCount > 0) {
    process.exit(1);
  }
}

// ============================================
// POINT D'ENTRÉE
// ============================================
const args = process.argv.slice(2);

if (args.includes('--run-once')) {
  // Mode GitHub Actions
  log('🤖 Mode GitHub Actions - exécution unique');
  runDailyPlan().catch(e => {
    log(`❌ Erreur fatale: ${e.message}`);
    console.error(e);
    process.exit(1);
  });
} else {
  // Mode serveur local (test)
  log('🖥️ Mode serveur local - test uniquement');
  runDailyPlan().catch(e => {
    log(`❌ Erreur: ${e.message}`);
  });
}
