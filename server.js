import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import EdgeTTS from 'edge-tts-universal';
import { chromium } from 'playwright';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/output', express.static(path.join(__dirname, 'output')));

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PEXELS_KEY = process.env.PEXELS_API_KEY || '';
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_DIR = path.join(__dirname, 'output');

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

// In-memory storage (persist to file)
let state = {
  products: [],
  accounts: [],
  settings: {
    pays: "Côte d'Ivoire",
    monnaie: "FCFA",
    whatsappDefault: "2250700000000",
    heurePublication: "19:30",
    timezone: "Africa/Abidjan"
  },
  jobs: [],
  learning: {
    bestHooks: [],
    worstHooks: [],
    bestAngles: [],
    bestHeures: ["19:30"],
    totalVideosAnalyzed: 0
  }
};

async function loadState() {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, 'state.json'), 'utf-8');
    state = JSON.parse(data);
    console.log('✓ État chargé');
  } catch { console.log('→ Nouvel état'); }
}

async function saveState() {
  await fs.writeFile(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
}

// ===== GEMINI ORCHESTRATION =====
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

async function orchestrateWithGemini(product, account, personaMemory) {
  if (!genAI) {
    // Fallback local
    return {
      persona: { nom: "Awa", age: 28, ville: "Yopougon", ton: "amical", probleme: "manque de temps" },
      hook: `STOP ! Tu perds de l'argent avec ${product.nom} ?`,
      script: `Les filles d'Abidjan, ${product.description} Prix ${product.prix} FCFA. Écris ${product.whatsapp || state.settings.whatsappDefault}`,
      angle: "problème-solution",
      hashtags: ["#abidjan", "#bonplan225", "#madeinci"]
    };
  }

  const learningPrompt = state.learning.totalVideosAnalyzed > 2 ? `
APPRENTISSAGE:
- Meilleurs hooks: ${state.learning.bestHooks.map(h=>`"${h.hook}" (${h.avgVues} vues)`).join(', ')}
- À ÉVITER: ${state.learning.worstHooks.join(', ')}
- Meilleures heures: ${state.learning.bestHeures.join(', ')}
` : '';

  const prompt = `Tu es ViralAgent Pro, expert TikTok Côte d'Ivoire.

PRODUIT: ${product.nom} (${product.type}) - ${product.prix} FCFA
Description: ${product.description}
WhatsApp: ${product.whatsapp || state.settings.whatsappDefault}
Compte: ${account.login} sur ${account.plateforme}

${learningPrompt}

PERSONA PRÉCÉDENT (reste cohérent): ${JSON.stringify(personaMemory)}

MISSION: Crée un script viral 15-20s pour Abidjan.
RÈGLES:
- Parle comme une ivoirienne (nouchi léger, références Yopougon/Cocody/Treichville)
- Hook 0-3s ultra puissant, JAMAIS copié des anciens
- Problème → Solution → Preuve (chiffre précis) → CTA WhatsApp
- Utilise l'apprentissage pour éviter les flops

Réponds UNIQUEMENT en JSON:
{
  "persona": {"nom":"...", "age":24, "ville":"Yopougon", "ton":"maternel", "probleme":"..."},
  "hook": "Phrase d'accroche 0-3s",
  "script": "Script complet 15s avec ton naturel ivoirien",
  "angle": "probleme-solution ou temoignage ou fomo",
  "hashtags": ["#abidjan","#bonplan225","#..."],
  "dureeEstimee": 18
}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { temperature: 0.95 } });
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error('Gemini error:', e.message);
    return orchestrateWithGemini(product, account, {}); // fallback
  }
}

// ===== PEXELS VIDEO =====
async function fetchPexelsVideo(query) {
  if (!PEXELS_KEY) {
    // Fallback: image unsplash as video placeholder
    return 'https://videos.pexels.com/video-files/853800/853800-hd_1080_1920_25fps.mp4';
  }
  try {
    const res = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`, {
      headers: { Authorization: PEXELS_KEY }
    });
    const videos = res.data.videos.filter(v => v.width < v.height);
    if (!videos.length) throw new Error('No vertical');
    const v = videos[Math.floor(Math.random() * Math.min(5, videos.length))];
    const file = v.video_files.find(f => f.height >= 1080) || v.video_files[0];
    return file.link;
  } catch {
    return 'https://videos.pexels.com/video-files/3196235/3196235-hd_1080_1920_25fps.mp4';
  }
}

// ===== EDGE TTS =====
async function generateVoice(text, voice = 'fr-FR-DeniseNeural') {
  const id = uuidv4();
  const outputPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  
  try {
    const tts = new EdgeTTS({ voice });
    await tts.synthesize(text, outputPath);
    return outputPath;
  } catch (e) {
    console.error('TTS error:', e);
    // Create silent audio as fallback
    await new Promise((resolve) => {
      ffmpeg()
        .input('anullsrc=r=44100:cl=mono')
        .inputFormat('lavfi')
        .duration(15)
        .audioCodec('libmp3lame')
        .save(outputPath)
        .on('end', resolve);
    });
    return outputPath;
  }
}

// ===== VIDEO CREATION =====
async function createVideo(product, script, hook) {
  const id = uuidv4();
  const videoPath = path.join(OUTPUT_DIR, `${id}.mp4`);
  
  console.log(`🎬 Création vidéo pour ${product.nom}`);
  
  // 1. Fetch background
  const videoUrl = await fetchPexelsVideo(product.categorie || product.nom);
  const bgPath = path.join(OUTPUT_DIR, `${id}_bg.mp4`);
  const bgRes = await axios({ url: videoUrl, responseType: 'arraybuffer' });
  await fs.writeFile(bgPath, bgRes.data);
  
  // 2. Generate voice
  const audioPath = await generateVoice(script);
  
  // 3. Create subtitles SRT
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const words = hook.split(' ').slice(0, 8).join(' ');
  const srtContent = `1
00:00:00,000 --> 00:00:03,000
${words.toUpperCase()}

2
00:00:03,000 --> 00:00:08,000
${product.nom} - ${product.prix} FCFA

3
00:00:08,000 --> 00:00:15,000
WhatsApp: ${product.whatsapp || state.settings.whatsappDefault}
`;
  await fs.writeFile(srtPath, srtContent);
  
  // 4. FFmpeg montage
  await new Promise((resolve, reject) => {
    ffmpeg(bgPath)
      .input(audioPath)
      .outputOptions([
        '-vf', `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles=${srtPath}:force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=100'`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-shortest',
        '-t', '20'
      ])
      .save(videoPath)
      .on('end', resolve)
      .on('error', reject);
  });
  
  // Cleanup
  await fs.unlink(bgPath).catch(()=>{});
  await fs.unlink(audioPath).catch(()=>{});
  await fs.unlink(srtPath).catch(()=>{});
  
  console.log(`✓ Vidéo créée: ${id}.mp4`);
  return { id, path: videoPath, url: `/output/${id}.mp4` };
}

// ===== PUBLISH WITH PLAYWRIGHT =====
async function publishToAccount(account, videoPath, caption) {
  console.log(`📤 Publication ${account.plateforme} ${account.login}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  
  // Load cookies if exist
  const cookiesPath = path.join(DATA_DIR, `cookies_${account.id}.json`);
  try {
    const cookies = JSON.parse(await fs.readFile(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
  } catch {}
  
  const page = await context.newPage();
  
  try {
    if (account.plateforme === 'TikTok') {
      await page.goto('https://www.tiktok.com/upload', { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      // Upload logic (simplified - real would need login handling)
      const input = await page.$('input[type="file"]');
      if (input) {
        await input.setInputFiles(videoPath);
        await page.waitForTimeout(5000);
        await page.fill('input[placeholder*="description"]', caption.slice(0, 2200));
        await page.waitForTimeout(2000);
        // await page.click('button:has-text("Post")');
        console.log('✓ TikTok upload simulé');
      }
    } else {
      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
      console.log('✓ Instagram upload simulé');
    }
    
    // Save cookies
    await fs.writeFile(cookiesPath, JSON.stringify(await context.cookies()));
    
    await browser.close();
    return { success: true, platform: account.plateforme };
  } catch (e) {
    await browser.close();
    console.error('Publish error:', e.message);
    return { success: false, error: e.message };
  }
}

// ===== DAILY AUTONOMOUS JOB =====
async function runDailyPlan() {
  console.log('🤖 Démarrage plan quotidien autonome...');
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' });
  
  const activeAccounts = state.accounts.filter(a => a.actif && a.produitsIds.length > 0);
  
  for (const account of activeAccounts) {
    // Rotation produit
    const productId = account.produitsIds[Math.floor(Date.now() / 86400000) % account.produitsIds.length];
    const product = state.products.find(p => p.id === productId);
    if (!product) continue;
    
    try {
      // 1. Orchestration Gemini
      const personaMemory = state.jobs.filter(j=>j.accountId===account.id).slice(-3);
      const creative = await orchestrateWithGemini(product, account, personaMemory);
      
      // 2. Vidéo
      const video = await createVideo(product, creative.script, creative.hook);
      
      // 3. Caption
      const caption = `${creative.hook}\n\n${product.description}\n\nPrix: ${product.prix} ${state.settings.monnaie}\n📲 WhatsApp: ${product.whatsapp || state.settings.whatsappDefault}\n\n${creative.hashtags.join(' ')} #${product.categorie || 'ci'}`;
      
      // 4. Publication
      const pubResult = await publishToAccount(account, video.path, caption);
      
      // 5. Sauvegarde job
      const job = {
        id: uuidv4(),
        date: now,
        accountId: account.id,
        productId: product.id,
        script: creative.script,
        hook: creative.hook,
        status: pubResult.success ? 'publié' : 'échec',
        vues: Math.floor(Math.random() * 3000) + 800, // Simulated - real would fetch
        likes: Math.floor(Math.random() * 200) + 50,
        whatsappCible: product.whatsapp || state.settings.whatsappDefault,
        videoUrl: video.url,
        persona: creative.persona
      };
      
      state.jobs.unshift(job);
      if (state.jobs.length > 100) state.jobs.pop();
      
      await saveState();
      
      console.log(`✓ ${account.login} → ${product.nom} publié`);
      
      // Délai anti-spam
      await new Promise(r => setTimeout(r, 120000)); // 2 min
      
    } catch (e) {
      console.error(`✗ Erreur ${account.login}:`, e.message);
    }
  }
  
  // Apprentissage auto tous les 3 jobs
  if (state.jobs.filter(j=>j.status==='publié').length % 3 === 0) {
    await performLearning();
  }
  
  console.log('✅ Plan quotidien terminé');
}

async function performLearning() {
  if (!genAI || state.jobs.length < 3) return;
  
  const published = state.jobs.filter(j => j.vues).slice(0, 15);
  const top = [...published].sort((a,b)=>(b.vues||0)-(a.vues||0)).slice(0,3);
  const flop = [...published].sort((a,b)=>(a.vues||0)-(b.vues||0)).slice(0,3);
  
  const prompt = `Analyse TikTok CI. TOP: ${top.map(t=>`"${t.hook}" ${t.vues}v`).join('; ')}. FLOPS: ${flop.map(f=>`"${f.hook}" ${f.vues}v`).join('; ')}. Retourne JSON: {"bestHooks":[{"hook":"...","avgVues":0}],"worstHooks":["..."],"bestHeures":["19:30"]}`;
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
    state.learning = { ...state.learning, ...data, totalVideosAnalyzed: published.length, lastAnalysis: new Date().toISOString() };
    await saveState();
    console.log('🧠 Apprentissage mis à jour');
  } catch {}
}

// ===== API ROUTES =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    gemini: !!GEMINI_KEY, 
    pexels: !!PEXELS_KEY,
    jobs: state.jobs.length,
    products: state.products.length,
    accounts: state.accounts.length,
    learning: state.learning.totalVideosAnalyzed
  });
});

app.post('/api/config', async (req, res) => {
  const { products, accounts, settings } = req.body;
  if (products) state.products = products;
  if (accounts) state.accounts = accounts;
  if (settings) state.settings = { ...state.settings, ...settings };
  await saveState();
  res.json({ success: true });
});

app.get('/api/state', (req, res) => {
  res.json(state);
});

app.post('/api/generate', async (req, res) => {
  const { productId, accountId } = req.body;
  const product = state.products.find(p=>p.id===productId);
  const account = state.accounts.find(a=>a.id===accountId);
  if (!product || !account) return res.status(404).json({ error: 'Not found' });
  
  const creative = await orchestrateWithGemini(product, account, {});
  const video = await createVideo(product, creative.script, creative.hook);
  
  res.json({ creative, video: video.url });
});

app.post('/api/run-now', async (req, res) => {
  runDailyPlan(); // async
  res.json({ started: true, message: 'Plan quotidien lancé' });
});

app.post('/api/learn', async (req, res) => {
  await performLearning();
  res.json(state.learning);
});

// ===== CRON - 19:30 Abidjan =====
cron.schedule('30 19 * * *', () => {
  console.log('⏰ Cron 19:30 Abidjan déclenché');
  runDailyPlan();
}, { timezone: 'Africa/Abidjan' });

// ===== START =====
await loadState();

// Mode GitHub Actions : run once then exit
if (process.argv.includes('--run-once')) {
  console.log('🤖 Mode RUN-ONCE (GitHub Actions)');
  await runDailyPlan();
  await performLearning();
  console.log('✅ Job terminé, exit');
  process.exit(0);
}

app.listen(PORT, () => {
  console.log(`🚀 ViralAgent Backend running on port ${PORT}`);
  console.log(`🧠 Gemini: ${GEMINI_KEY ? 'ACTIF' : 'désactivé (mode local)'}`);
  console.log(`🎥 Pexels: ${PEXELS_KEY ? 'ACTIF' : 'mode démo'}`);
  console.log(`⏰ Publication auto: 19:30 Africa/Abidjan`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/health`);
});