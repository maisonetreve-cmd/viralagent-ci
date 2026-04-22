// ViralAgent Pro - Multi-plateformes (TikTok + Instagram + Facebook)
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ============ CONFIG ============
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const BUFFER_API_KEY = process.env.BUFFER_API_KEY || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506500';
const TZ = process.env.TZ || 'Africa/Abidjan';

// Cookies pour Playwright (fallback si Buffer ne marche pas)
const TIKTOK_COOKIES_B64 = process.env.TIKTOK_COOKIES_B64 || '';
const INSTAGRAM_COOKIES_B64 = process.env.INSTAGRAM_COOKIES_B64 || '';
const FACEBOOK_COOKIES_B64 = process.env.FACEBOOK_COOKIES_B64 || '';

const LLM_KEY = GROQ_API_KEY || GEMINI_API_KEY;
const LLM_PROVIDER = GROQ_API_KEY.startsWith('gsk_') ? 'groq' : (GEMINI_API_KEY.startsWith('AIza') ? 'gemini' : '');

// ============ UTILITAIRES ============
function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const parsed = new URL(url);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const lib = url.startsWith('https') ? https : http;
    const doRequest = (requestUrl) => {
      lib.get(requestUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(outputPath); });
      }).on('error', reject);
    };
    doRequest(url);
  });
}

// ============ GESTION DES SESSIONS ============
function loadCookies(platform) {
  const envVar = `${platform.toUpperCase()}_COOKIES_B64`;
  if (process.env[envVar]) {
    try {
      return JSON.parse(Buffer.from(process.env[envVar], 'base64').toString());
    } catch(e) { return null; }
  }
  const file = `./${platform}_cookies.json`;
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return null; }
  }
  return null;
}

function saveCookiesDisplay(cookies, platform) {
  const b64 = Buffer.from(JSON.stringify(cookies)).toString('base64');
  console.log(`\n📋 ${platform.toUpperCase()}_COOKIES_B64 (copie dans GitHub Secrets):`);
  console.log(b64);
  return b64;
}

// ============ CONFIG & HISTORIQUE ============
function loadConfig() {
  try {
    if (fs.existsSync('data/state.json')) {
      return JSON.parse(fs.readFileSync('data/state.json', 'utf8'));
    }
  } catch(e) {}
  return {
    products: [{ id: 'p1', nom: 'Produit Demo', prix: '12000', whatsapp: WHATSAPP_DEFAULT, active: true }],
    accounts: [
      { id: 'a1', platform: 'TikTok', login: '@tiktok_account', active: true, products: ['p1'] },
      { id: 'a2', platform: 'Instagram', login: '@instagram_account', active: true, products: ['p1'] },
      { id: 'a3', platform: 'Facebook', login: 'facebook_page_name', active: true, products: ['p1'] }
    ]
  };
}

function loadHistory() {
  try { return JSON.parse(fs.readFileSync('data/history.json', 'utf8')); } catch(e) { return []; }
}

function saveHistory(history) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/history.json', JSON.stringify(history, null, 2));
}

// ============ LLM ============
async function generateScript(product, history) {
  const recentHooks = history.slice(-5).map(h => h.hook).join(', ');
  const prompt = `Expert marketing viral Côte d'Ivoire. Hook MAX 30 caractères, orthographe parfaite.
Produit: ${product.nom}
Règles: Pas de "surles", accents corrects.
Réponds JSON: {"hook":"...","description":"...","hashtags":"#..."}`;

  try {
    let result;
    if (LLM_PROVIDER === 'groq') {
      const resp = await fetchJSON('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LLM_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{role:'user',content:prompt}], response_format: { type: 'json_object' } })
      });
      result = JSON.parse(resp.data.choices[0].message.content);
    } else {
      const resp = await fetchJSON(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${LLM_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const text = resp.data.candidates[0].content.parts[0].text;
      result = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    }
    if (result.hook) result.hook = result.hook.replace(/surles/gi, 'sur les').substring(0, 30);
    return result;
  } catch (e) {
    return { hook: 'Découvre cette astuce!', description: '', hashtags: '#viral #afrique' };
  }
}

// ============ GÉNÉRATION VIDÉO ============
async function downloadPexelsVideo(keywords, outputPath) {
  if (!PEXELS_API_KEY) {
    execSync(`ffmpeg -f lavfi -i "color=c=0x1a1a2e:s=1080x1920:d=20" -c:v libx264 -pix_fmt yuv420p -y "${outputPath}"`, { stdio: 'pipe' });
    return;
  }
  try {
    const resp = await fetchJSON(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&per_page=10`, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    if (resp.data?.videos?.length > 0) {
      const video = resp.data.videos[Math.floor(Math.random() * resp.data.videos.length)];
      const file = video.video_files.find(f => f.quality === 'hd' || f.quality === 'sd');
      if (file) await downloadFile(file.link, outputPath);
    }
  } catch(e) {
    execSync(`ffmpeg -f lavfi -i "color=c=0x1a1a2e:s=1080:1920:d=20" -c:v libx264 -pix_fmt yuv420p -y "${outputPath}"`, { stdio: 'pipe' });
  }
}

function generateVoice(script, outputPath) {
  const text = `${script.hook}. Contacte-moi.`.replace(/['"\\]/g, '').substring(0, 200);
  try {
    execSync(`edge-tts --voice fr-FR-DeniseNeural --text "${text}" --write-media "${outputPath}" --rate=+10%`, { timeout: 30000, stdio: 'pipe' });
  } catch (e) {
    execSync(`ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 10 -c:a aac -y "${outputPath}"`, { stdio: 'pipe' });
  }
}

function mountVideo(videoPath, audioPath, script, outputPath) {
  let hook = (script.hook || 'Découvre!').replace(/['"\\]/g, '').substring(0, 30);
  const whatsapp = WHATSAPP_DEFAULT;
  
  const hookFile = `/tmp/hook_${Date.now()}.txt`;
  const ctaFile = `/tmp/cta_${Date.now()}.txt`;
  
  fs.writeFileSync(hookFile, hook);
  fs.writeFileSync(ctaFile, `CONTACTE-MOI\n📱 ${whatsapp}`);

  const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,
    drawbox=x=100:y=(h*0.12):w=(w-200):h=(th+60):color=black@0.8:t=fill,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${hookFile}':fontsize=56:fontcolor=#FFD700:borderw=5:bordercolor=black:x=(w-text_w)/2:y=(h*0.15),
    drawbox=x=100:y=(h*0.78):w=(w-200):h=(th+50):color=#25D366@0.9:t=fill,
    drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${ctaFile}':fontsize=42:fontcolor=white:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h*0.80)" \
    -c:v libx264 -preset veryfast -crf 24 -c:a aac -shortest -t 25 -pix_fmt yuv420p -y "${outputPath}"`;

  try { execSync(cmd, { timeout: 120000, stdio: 'pipe' }); } 
  finally { try { fs.unlinkSync(hookFile); fs.unlinkSync(ctaFile); } catch(e) {} }
}

// ============ PUBLICATION BUFFER (Instagram & Facebook) ============
async function publishViaBuffer(videoPath, caption, platform) {
  if (!BUFFER_API_KEY) return { success: false, error: 'Pas de clé Buffer' };

  console.log(`   Tentative Buffer pour ${platform}...`);
  
  try {
    // Récupérer profils
    const profilesRes = await fetchJSON(`https://api.bufferapp.com/1/profiles.json?access_token=${BUFFER_API_KEY}`);
    if (profilesRes.status !== 200) return { success: false, error: 'Clé Buffer invalide' };

    const profile = profilesRes.data.find(p => p.service === platform.toLowerCase());
    if (!profile) return { success: false, error: `${platform} non connecté dans Buffer` };

    // Lire vidéo
    const videoBuffer = fs.readFileSync(videoPath);
    
    // Construire multipart
    const boundary = '----Buffer' + Date.now();
    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${BUFFER_API_KEY}`),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="profile_ids[]"\r\n\r\n${profile.id}`),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n${caption.substring(0, 2200)}`),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="now"\r\n\r\ntrue`),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="media[file]"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
      videoBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    
    const result = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.bufferapp.com',
        path: '/1/updates/create.json',
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': Buffer.concat(parts).length },
        timeout: 180000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data: data }); }
        });
      });
      req.on('error', (e) => resolve({ status: 0, error: e.message }));
      req.write(Buffer.concat(parts));
      req.end();
    });

    if (result.status === 200 && (result.data.success || result.data.id)) {
      return { success: true, method: 'Buffer', id: result.data.id };
    }
    return { success: false, error: result.data.error || 'Refusé' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ PUBLICATION PLAYWRIGHT (TikTok & Fallback) ============
async function publishViaPlaywright(videoPath, caption, platform, account) {
  console.log(`   Tentative Playwright pour ${platform}...`);
  
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch(e) {
    return { success: false, error: 'Playwright non installé' };
  }

  const cookies = loadCookies(platform.toLowerCase());
  if (!cookies) {
    return { success: false, error: `Pas de cookies ${platform}. Lance: node server.js --login-${platform.toLowerCase()}` };
  }

  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addCookies(cookies);
    const page = await context.newPage();

    let url, selectorFile, selectorCaption, selectorPublish;
    
    if (platform === 'TikTok') {
      url = 'https://www.tiktok.com/upload';
      selectorFile = 'input[type="file"]';
      selectorCaption = '[contenteditable="true"]';
      selectorPublish = 'button:has-text("Publier"), button:has-text("Post")';
    } else if (platform === 'Instagram') {
      url = 'https://www.instagram.com/';
      // Instagram nécessite navigation créateur, simplifié ici
      return { success: false, error: 'Instagram via Playwright nécessite configuration manuelle avancée' };
    } else if (platform === 'Facebook') {
      url = 'https://www.facebook.com/';
      // Facebook nécessite page spécifique
      return { success: false, error: 'Facebook via Playwright utilisez Buffer de préférence' };
    }

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    
    if (page.url().includes('login')) {
      return { success: false, error: 'Session expirée' };
    }

    // Upload
    const inputFile = await page.waitForSelector(selectorFile, { timeout: 10000 });
    await inputFile.setInputFiles(videoPath);
    await page.waitForTimeout(8000);

    // Caption
    const editor = await page.$(selectorCaption);
    if (editor) {
      await editor.click();
      await editor.fill(caption);
      await page.waitForTimeout(1000);
    }

    // Publish
    const publishBtn = await page.$(selectorPublish);
    if (publishBtn) {
      await publishBtn.click();
      await page.waitForTimeout(15000);
      
      // Sauvegarder nouveaux cookies
      const newCookies = await context.cookies();
      saveCookiesDisplay(newCookies, platform.toLowerCase());
      
      await browser.close();
      return { success: true, method: 'Playwright' };
    }
    
    await browser.close();
    return { success: false, error: 'Bouton publier non trouvé' };
    
  } catch (error) {
    if (browser) await browser.close();
    return { success: false, error: error.message };
  }
}

// ============ FONCTION PRINCIPALE DE PUBLICATION ============
async function publishVideo(videoPath, caption, account) {
  const platform = account.platform;
  console.log(`📤 Publication sur ${platform}...`);

  // Stratégie selon la plateforme
  if (platform === 'TikTok') {
    // TikTok = Playwright obligatoire (pas d'API)
    return await publishViaPlaywright(videoPath, caption, 'TikTok', account);
  } 
  else if (platform === 'Instagram' || platform === 'Facebook') {
    // Instagram/Facebook = Buffer d'abord (plus stable), sinon Playwright
    const bufferResult = await publishViaBuffer(videoPath, caption, platform);
    if (bufferResult.success) return bufferResult;
    
    console.log(`   Buffer a échoué: ${bufferResult.error}`);
    console.log(`   Tentative Playwright...`);
    return await publishViaPlaywright(videoPath, caption, platform, account);
  }
  
  return { success: false, error: 'Plateforme inconnue' };
}

// ============ LOGIN INITIAL (À FAIRE UNE FOIS EN LOCAL) ============
async function firstLogin(platform) {
  console.log(`🔐 Connexion ${platform}...`);
  console.log('Un navigateur va s\'ouvrir. Connecte-toi manuellement.\n');
  
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const urls = {
    tiktok: 'https://www.tiktok.com/login',
    instagram: 'https://www.instagram.com/accounts/login/',
    facebook: 'https://www.facebook.com/login'
  };
  
  await page.goto(urls[platform]);
  console.log('⏳ Connecte-toi... (120s max)');
  
  await page.waitForTimeout(5000);
  
  // Attendre que l'URL change (connexion réussie)
  await page.waitForFunction(() => {
    return !window.location.href.includes('login');
  }, { timeout: 120000 });
  
  await page.waitForTimeout(3000);
  
  const cookies = await context.cookies();
  saveCookiesDisplay(cookies, platform);
  
  console.log(`\n✅ Cookies ${platform} sauvegardés!`);
  console.log(`Copie la valeur base64 ci-dessus dans GitHub Secret: ${platform.toUpperCase()}_COOKIES_B64`);
  
  await browser.close();
}

// ============ MAIN ============
async function main() {
  // Modes login
  if (process.argv.includes('--login-tiktok')) return await firstLogin('tiktok');
  if (process.argv.includes('--login-instagram')) return await firstLogin('instagram');
  if (process.argv.includes('--login-facebook')) return await firstLogin('facebook');

  console.log('🚀 ViralAgent Pro - Multi-Plateformes');
  console.log(`⏰ ${new Date().toLocaleString('fr-CI', { timeZone: TZ })}`);
  console.log(`🔑 Buffer: ${BUFFER_API_KEY ? '✅' : '❌'} | Playwright: ${TIKTOK_COOKIES_B64 ? '✅' : '❌'}`);

  const config = loadConfig();
  const history = loadHistory();
  fs.mkdirSync('output', { recursive: true });

  // Traiter chaque compte actif
  for (const account of config.accounts) {
    if (!account.active) continue;
    
    const today = new Date().toISOString().split('T')[0];
    if (history.find(h => h.date === today && h.compte === account.login)) {
      console.log(`\n⏭️ ${account.login} (${account.platform}): déjà fait aujourd'hui`);
      continue;
    }

    console.log(`\n📱 ${account.login} (${account.platform})`);
    
    const product = config.products.find(p => account.products?.includes(p.id)) || config.products[0];
    
    // Génération
    const script = await generateScript(product, history);
    const videoId = `vid_${Date.now()}_${account.platform.toLowerCase()}`;
    const raw = `output/${videoId}_raw.mp4`;
    const audio = `output/${videoId}.mp3`;
    const final = `output/${videoId}_final.mp4`;

    await downloadPexelsVideo(script.motsCles || 'business', raw);
    generateVoice(script, audio);
    mountVideo(raw, audio, script, final);
    
    try { fs.unlinkSync(raw); fs.unlinkSync(audio); } catch(e) {}

    // Publication
    const caption = `${script.hook}\n\n${script.description || ''}\n\n${script.hashtags || ''}\n\n📱 ${WHATSAPP_DEFAULT}`;
    const result = await publishVideo(final, caption, account);

    // Historique
    history.push({
      date: today,
      compte: account.login,
      plateforme: account.platform,
      produit: product.nom,
      hook: script.hook,
      statut: result.success ? 'publiée' : 'générée',
      methode: result.method || 'aucune',
      error: result.error || null
    });
    saveHistory(history);
    
    console.log(result.success ? `✅ Publié via ${result.method}` : `❌ Échec: ${result.error}`);
    await new Promise(r => setTimeout(r, 5000)); // Pause entre comptes
  }

  console.log('\n✅ Terminé!');
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
