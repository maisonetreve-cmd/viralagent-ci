// ViralAgent Pro - Backend 100% autonome
// Groq (LLM) + Pexels + Edge TTS + FFmpeg + Playwright

require('dotenv').config();
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Groq = require('groq-sdk');

// ============ CONFIG ============
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250700000000';

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ============ CHARGER CONFIG ============
function loadConfig() {
  try {
    const raw = fs.readFileSync('data/state.json', 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.log('⚠️ Pas de config trouvée, utilisation config démo');
    return {
      products: [{
        id: 'p1',
        nom: 'Produit Demo',
        prix: '5000',
        description: 'Super produit',
        whatsapp: WHATSAPP_DEFAULT
      }],
      accounts: [{
        id: 'a1',
        platform: 'TikTok',
        login: '@demo_ci',
        active: true,
        products: ['p1']
      }],
      history: []
    };
  }
}

// ============ CHARGER HISTORIQUE ============
function loadHistory() {
  try {
    if (fs.existsSync('data/history.json')) {
      return JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
    }
  } catch (e) {}
  return [];
}

// ============ SAUVEGARDER HISTORIQUE ============
function saveHistory(history) {
  fs.writeFileSync('data/history.json', JSON.stringify(history, null, 2));
}

// ============ GROQ - GÉNÉRER SCRIPT ============
async function generateScript(product, account, history) {
  console.log(`🧠 Groq génère script pour: ${product.nom}`);

  const recentHooks = history.slice(-10).map(h => h.hook).join('\n- ');
  const whatsapp = product.whatsapp || WHATSAPP_DEFAULT;

  const prompt = `Tu es un expert marketing viral pour la Côte d'Ivoire.

PRODUIT: ${product.nom}
PRIX: ${product.prix} FCFA
DESCRIPTION: ${product.description || ''}
WHATSAPP: wa.me/${whatsapp}
COMPTE: ${account.login} (${account.platform})

HOOKS DÉJÀ UTILISÉS (NE PAS RÉPÉTER):
${recentHooks || 'Aucun encore'}

RÈGLES:
- Hook 0-3sec: accroche ULTRA virale, jamais utilisée avant
- Parle comme un ivoirien (naturel, pas formel)
- 15-20 secondes max
- Toujours finir par: "Écris-moi sur WhatsApp 👉 wa.me/${whatsapp}"

Réponds UNIQUEMENT en JSON:
{
  "persona": "Prénom, âge, quartier Abidjan",
  "hook": "phrase d'accroche 0-3sec",
  "probleme": "douleur du client en 1 phrase",
  "solution": "comment le produit règle le problème",
  "preuve": "chiffre ou résultat concret",
  "cta": "wa.me/${whatsapp}",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
  "description": "description post optimisée",
  "motsCles": "mots-clés pour Pexels en anglais"
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);
  console.log(`✅ Script: "${result.hook}"`);
  return result;
}

// ============ PEXELS - TÉLÉCHARGER VIDÉO ============
async function downloadVideo(keywords, outputPath) {
  console.log(`🎬 Pexels: recherche "${keywords}"`);
  
  const page = Math.floor(Math.random() * 5) + 1;
  const response = await axios.get(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&size=medium&per_page=15&page=${page}`,
    { headers: { Authorization: PEXELS_API_KEY } }
  );

  const videos = response.data.videos;
  if (!videos || videos.length === 0) throw new Error('Aucune vidéo Pexels');

  const video = videos[Math.floor(Math.random() * videos.length)];
  const fileUrl = video.video_files.find(f => f.quality === 'hd' || f.quality === 'sd')?.link;
  if (!fileUrl) throw new Error('Pas de lien vidéo');

  const videoResponse = await axios.get(fileUrl, { responseType: 'stream' });
  const writer = fs.createWriteStream(outputPath);
  videoResponse.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log(`✅ Vidéo téléchargée: ${outputPath}`);
      resolve(outputPath);
    });
    writer.on('error', reject);
  });
}

// ============ EDGE TTS - GÉNÉRER VOIX ============
async function generateVoice(script, outputPath) {
  console.log('🗣️ Edge TTS: génération voix...');
  
  const texte = `${script.hook}. ${script.probleme}. ${script.solution}. ${script.preuve}. Écris-moi sur WhatsApp.`;
  const texteClean = texte.replace(/['"]/g, '').substring(0, 500);
  
  execSync(`edge-tts --voice fr-FR-DeniseNeural --text "${texteClean}" --write-media ${outputPath} --rate=+15%`, {
    timeout: 30000
  });
  
  console.log('✅ Voix générée');
  return outputPath;
}

// ============ FFMPEG - MONTER VIDÉO ============
async function mountVideo(videoPath, audioPath, script, outputPath) {
  console.log('✂️ FFmpeg: montage vidéo...');

  const hook = script.hook.replace(/['"]/g, '').substring(0, 60);
  const cta = `WhatsApp 👉 wa.me/${script.cta.replace('wa.me/', '')}`;

  const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,\
    drawtext=text='${hook}':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=h*0.15:borderw=3:bordercolor=black,\
    drawtext=text='${cta}':fontsize=42:fontcolor=yellow:x=(w-text_w)/2:y=h*0.82:borderw=3:bordercolor=black" \
    -map 0:v -map 1:a \
    -c:v libx264 -preset fast -crf 28 \
    -c:a aac -b:a 128k \
    -shortest -t 30 \
    -y "${outputPath}"`;

  execSync(cmd, { timeout: 120000 });
  console.log('✅ Vidéo montée');
  return outputPath;
}

// ============ TRAITER UN COMPTE ============
async function processAccount(account, products, history) {
  console.log(`\n📱 Traitement: ${account.login} (${account.platform})`);

  // Choisir produit (rotation)
  const accountProducts = products.filter(p => 
    account.products && account.products.includes(p.id)
  );
  
  if (accountProducts.length === 0) {
    console.log('⚠️ Aucun produit assigné à ce compte');
    return null;
  }

  const todayIndex = new Date().getDate() % accountProducts.length;
  const product = accountProducts[todayIndex];
  console.log(`📦 Produit: ${product.nom}`);

  // Générer script avec Groq
  const script = await generateScript(product, account, history);

  const videoId = `vid_${Date.now()}`;
  const rawVideo = `output/${videoId}_raw.mp4`;
  const audioFile = `output/${videoId}.mp3`;
  const finalVideo = `output/${videoId}_final.mp4`;

  // Télécharger vidéo Pexels
  await downloadVideo(script.motsCles || 'african market woman', rawVideo);

  // Générer voix
  await generateVoice(script, audioFile);

  // Monter vidéo
  await mountVideo(rawVideo, audioFile, script, finalVideo);

  // Nettoyer fichiers temporaires
  if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo);
  if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);

  // Sauvegarder dans historique
  const entry = {
    id: videoId,
    date: new Date().toISOString().split('T')[0],
    compte: account.login,
    plateforme: account.platform,
    produit: product.nom,
    hook: script.hook,
    persona: script.persona,
    hashtags: script.hashtags,
    whatsapp: script.cta,
    videoPath: finalVideo,
    statut: 'generee',
    vues: 0,
    likes: 0
  };

  history.push(entry);
  saveHistory(history);

  console.log(`✅ Vidéo prête: ${finalVideo}`);
  return { script, videoPath: finalVideo, entry };
}

// ============ MAIN ============
async function main() {
  console.log('🚀 ViralAgent Pro - Démarrage');
  console.log(`⏰ Heure: ${new Date().toLocaleString('fr-CI', { timeZone: 'Africa/Abidjan' })}`);
  console.log(`🧠 Groq: ${GROQ_API_KEY ? '✅ actif' : '❌ manquant'}`);
  console.log(`🎬 Pexels: ${PEXELS_API_KEY ? '✅ actif' : '❌ manquant'}`);

  // Créer dossiers
  fs.mkdirSync('output', { recursive: true });
  fs.mkdirSync('data', { recursive: true });

  // Charger config et historique
  const config = loadConfig();
  const history = loadHistory();

  console.log(`📦 Produits: ${config.products?.length || 0}`);
  console.log(`👥 Comptes: ${config.accounts?.length || 0}`);
  console.log(`📊 Historique: ${history.length} vidéos`);

  // Traiter chaque compte actif
  const activeAccounts = config.accounts?.filter(a => a.active) || [];
  
  if (activeAccounts.length === 0) {
    console.log('⚠️ Aucun compte actif trouvé');
    return;
  }

  for (const account of activeAccounts) {
    try {
      await processAccount(account, config.products || [], history);
      // Pause entre comptes
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      console.error(`❌ Erreur compte ${account.login}:`, err.message);
    }
  }

  console.log('\n🎉 Agent terminé !');
  console.log(`📹 Vidéos générées: ${fs.readdirSync('output').filter(f => f.endsWith('_final.mp4')).length}`);
}

main().catch(err => {
  console.error('❌ ERREUR FATALE:', err);
  process.exit(1);
});
