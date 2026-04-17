require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250700000000';

console.log('🚀 ViralAgent Pro - Démarrage');
console.log(`🧠 Groq: ${GROQ_API_KEY ? '✅' : '❌ manquant'}`);
console.log(`🎬 Pexels: ${PEXELS_API_KEY ? '✅' : '❌ manquant'}`);

function loadConfig() {
  try {
    const raw = fs.readFileSync('data/state.json', 'utf8');
    const config = JSON.parse(raw);
    console.log(`📦 Produits: ${config.products?.length || 0}`);
    console.log(`👥 Comptes: ${config.accounts?.length || 0}`);
    return config;
  } catch (e) {
    console.log('⚠️ Config invalide, utilisation démo');
    return {
      products: [{
        id: 'p1',
        nom: 'Produit Demo',
        prix: '5000',
        description: 'Super produit ivoirien',
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

function loadHistory() {
  try {
    if (fs.existsSync('data/history.json')) {
      return JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  fs.writeFileSync('data/history.json', JSON.stringify(history, null, 2));
}

async function generateScript(product, account, history) {
  console.log(`\n🧠 Groq génère script: ${product.nom}`);
  const whatsapp = product.whatsapp || WHATSAPP_DEFAULT;
  const recentHooks = history.slice(-10).map(h => h.hook).filter(Boolean).join('\n- ');

  if (!GROQ_API_KEY) {
    console.log('⚠️ Pas de clé Groq - script démo');
    return {
      persona: 'Kadidia 24 ans Yopougon',
      hook: `POV : tu découvres ${product.nom} à ${product.prix} FCFA`,
      probleme: 'Tu cherches la meilleure solution',
      solution: `${product.nom} règle tout`,
      preuve: 'Déjà 200 clients satisfaits',
      cta: whatsapp,
      hashtags: '#abidjan #bonplan225 #civ #madeinci',
      description: `${product.nom} disponible ! Contacte-moi sur WhatsApp`,
      motsCles: 'african woman market abidjan'
    };
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });
  const prompt = `Tu es expert marketing viral Côte d'Ivoire.
PRODUIT: ${product.nom} | PRIX: ${product.prix} FCFA
WHATSAPP: wa.me/${whatsapp}
HOOKS DÉJÀ UTILISÉS (évite): ${recentHooks || 'aucun'}
Crée un script viral 15-20 secondes style TikTok ivoirien.
Réponds UNIQUEMENT en JSON valide:
{
  "persona": "Prénom, âge, quartier Abidjan",
  "hook": "accroche 0-3sec ultra virale",
  "probleme": "douleur client 1 phrase",
  "solution": "comment le produit aide",
  "preuve": "chiffre concret",
  "cta": "${whatsapp}",
  "hashtags": "#abidjan #bonplan225 #civ #madeinci #sidehustleci",
  "description": "description post TikTok optimisée",
  "motsCles": "mots clés Pexels en anglais max 3 mots"
}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(response.choices[0].message.content);
    console.log(`✅ Hook: "${result.hook}"`);
    return result;
  } catch (e) {
    console.log(`⚠️ Groq erreur: ${e.message}`);
    return {
      persona: 'Kadidia 24 ans Yopougon',
      hook: `${product.nom} à seulement ${product.prix} FCFA !`,
      probleme: 'Tu cherches la meilleure solution',
      solution: `${product.nom} est la réponse`,
      preuve: 'Déjà 200 clients',
      cta: whatsapp,
      hashtags: '#abidjan #bonplan225 #civ',
      description: `${product.nom} disponible !`,
      motsCles: 'african woman abidjan market'
    };
  }
}

async function downloadVideo(keywords, outputPath) {
  console.log(`🎬 Pexels: "${keywords}"`);
  if (!PEXELS_API_KEY) {
    console.log('⚠️ Pas de clé Pexels - vidéo test');
    execSync(`ffmpeg -f lavfi -i color=c=blue:size=1080x1920:rate=25 -t 20 -y "${outputPath}" 2>/dev/null`);
    return outputPath;
  }
  try {
    const page = Math.floor(Math.random() * 3) + 1;
    const response = await axios.get(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&per_page=10&page=${page}`,
      { headers: { Authorization: PEXELS_API_KEY }, timeout: 30000 }
    );
    const videos = response.data.videos;
    if (!videos || videos.length === 0) throw new Error('Aucune vidéo');
    const video = videos[Math.floor(Math.random() * Math.min(videos.length, 5))];
    const fileUrl = video.video_files.find(f => f.quality === 'hd' || f.quality === 'sd')?.link;
    if (!fileUrl) throw new Error('Pas de lien');
    const videoResponse = await axios.get(fileUrl, { responseType: 'stream', timeout: 60000 });
    const writer = fs.createWriteStream(outputPath);
    videoResponse.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log('✅ Vidéo Pexels téléchargée');
  } catch (e) {
    console.log(`⚠️ Pexels erreur: ${e.message} - vidéo test`);
    execSync(`ffmpeg -f lavfi -i color=c=black:size=1080x1920:rate=25 -t 20 -y "${outputPath}" 2>/dev/null`);
  }
  return outputPath;
}

async function generateVoice(script, outputPath) {
  console.log('🗣️ Edge TTS voix...');
  const texte = `${script.hook}. ${script.probleme}. ${script.solution}. ${script.preuve}. Écris-moi sur WhatsApp.`;
  const clean = texte.replace(/['"\\]/g, '').replace(/[^\w\s.,!?àáâãäåèéêëìíîïòóôõöùúûüýÿæœçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÆŒÇ]/g, '').substring(0, 400);
  try {
    execSync(`edge-tts --voice fr-FR-DeniseNeural --text "${clean}" --write-media "${outputPath}" --rate=+10%`, { timeout: 30000 });
    console.log('✅ Voix générée');
  } catch (e) {
    console.log(`⚠️ TTS erreur: ${e.message}`);
    execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 20 -y "${outputPath}" 2>/dev/null`);
  }
  return outputPath;
}

async function mountVideo(videoPath, audioPath, script, outputPath) {
  console.log('✂️ FFmpeg montage...');
  const hook = (script.hook || '').replace(/['"\\:]/g, '').substring(0, 50);
  const cta = `WhatsApp: wa.me/${(script.cta || '').replace('wa.me/', '')}`;
  try {
    const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,\
drawtext=text='${hook}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h*0.12:borderw=3:bordercolor=black@0.8,\
drawtext=text='${cta}':fontsize=38:fontcolor=yellow:x=(w-text_w)/2:y=h*0.84:borderw=3:bordercolor=black@0.8" \
      -map 0:v -map 1:a \
      -c:v libx264 -preset fast -crf 28 \
      -c:a aac -b:a 128k \
      -shortest -t 25 -y "${outputPath}" 2>/dev/null`;
    execSync(cmd, { timeout: 120000 });
    console.log('✅ Vidéo montée');
  } catch (e) {
    console.log(`⚠️ FFmpeg erreur: ${e.message}`);
  }
  return outputPath;
}

async function processAccount(account, products, history) {
  console.log(`\n📱 Compte: ${account.login} (${account.platform})`);
  const accountProducts = products.filter(p => account.products?.includes(p.id));
  if (accountProducts.length === 0) {
    console.log('⚠️ Aucun produit assigné');
    return;
  }
  const product = accountProducts[new Date().getDate() % accountProducts.length];
  console.log(`📦 Produit: ${product.nom}`);

  const script = await generateScript(product, account, history);
  const videoId = `vid_${Date.now()}`;
  const rawVideo = `output/${videoId}_raw.mp4`;
  const audioFile = `output/${videoId}.mp3`;
  const finalVideo = `output/${videoId}_final.mp4`;

  await downloadVideo(script.motsCles || 'african woman market', rawVideo);
  await generateVoice(script, audioFile);
  await mountVideo(rawVideo, audioFile, script, finalVideo);

  if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo);

  const entry = {
    id: videoId,
    date: new Date().toISOString().split('T')[0],
    compte: account.login,
    plateforme: account.platform,
    produit: product.nom,
    hook: script.hook,
    persona: script.persona,
    hashtags: script.hashtags,
    description: script.description,
    whatsapp: script.cta,
    statut: 'generee',
    vues: 0,
    likes: 0
  };

  history.push(entry);
  saveHistory(history);
  console.log(`✅ ${finalVideo} prête !`);
}

async function main() {
  fs.mkdirSync('output', { recursive: true });
  fs.mkdirSync('data', { recursive: true });
  const config = loadConfig();
  const history = loadHistory();
  console.log(`📊 Historique: ${history.length} vidéos`);
  const activeAccounts = (config.accounts || []).filter(a => a.active !== false);
  if (activeAccounts.length === 0) {
    console.log('⚠️ Aucun compte actif');
    return;
  }
  for (const account of activeAccounts) {
    try {
      await processAccount(account, config.products || [], history);
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`❌ Erreur ${account.login}: ${err.message}`);
    }
  }
  const videos = fs.readdirSync('output').filter(f => f.endsWith('_final.mp4'));
  console.log(`\n🎉 Terminé ! ${videos.length} vidéo(s) générée(s)`);
  videos.forEach(v => console.log(`  📹 ${v}`));
}

main().catch(err => {
  console.error('❌ ERREUR:', err.message);
  process.exit(1);
});
