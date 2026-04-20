// ViralAgent Pro - Backend 100% autonome
// Grok/Groq (LLM) + Pexels + Edge TTS + FFmpeg
// SANS dependance groq-sdk - utilise fetch direct

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============ CONFIG ============
const GROK_API_KEY = process.env.GROK_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const LLM_KEY = GROQ_API_KEY || GROK_API_KEY || GEMINI_API_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const UPLOADPOST_API_KEY = process.env.UPLOADPOST_API_KEY || '';
const BUFFER_API_KEY = process.env.BUFFER_API_KEY || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250700000000';
const TZ = process.env.TZ || 'Africa/Abidjan';

// Detecter le provider LLM
function detectProvider() {
  if (GROQ_API_KEY.startsWith('gsk_')) return 'groq';
  if (GROK_API_KEY.startsWith('xai-')) return 'grok';
  if (GEMINI_API_KEY.startsWith('AIza')) return 'gemini';
  if (LLM_KEY.startsWith('gsk_')) return 'groq';
  if (LLM_KEY.startsWith('xai-')) return 'grok';
  if (LLM_KEY.startsWith('AIza')) return 'gemini';
  return 'groq';
}

function getLLMKey() {
  const provider = detectProvider();
  if (provider === 'groq') return GROQ_API_KEY || LLM_KEY;
  if (provider === 'grok') return GROK_API_KEY || LLM_KEY;
  if (provider === 'gemini') return GEMINI_API_KEY || LLM_KEY;
  return LLM_KEY;
}

const LLM_PROVIDER = detectProvider();

// ============ UTILITAIRE FETCH ============
function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const parsed = new URL(url);

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
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
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    };

    doRequest(url);
  });
}

// ============ CHARGER CONFIG ============
function loadConfig() {
  const paths = ['data/state.json', 'automation/runtime-config.json'];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const config = JSON.parse(raw);
        console.log(`📂 Config chargee depuis: ${p}`);
        return normalizeConfig(config);
      }
    } catch (e) {
      console.log(`⚠️ Erreur lecture ${p}: ${e.message}`);
    }
  }

  console.log('⚠️ Pas de config trouvee, utilisation config demo');
  return {
    products: [{
      id: 'p1',
      nom: 'Produit Demo',
      prix: '5000',
      description: 'Super produit de demonstration',
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

// Normaliser la config (supporte les 2 formats)
function normalizeConfig(config) {
  if (config.produits && !config.products) {
    config.products = config.produits.map((p, i) => ({
      id: p.id || `p${i + 1}`,
      nom: p.nom || p.name || 'Produit',
      prix: p.prix || p.price || '0',
      description: p.description || '',
      type: p.type || 'physique',
      whatsapp: p.whatsapp || p.productWhatsapp || '',
      image_url: p.image_url || p.imageUrl || '',
      active: p.active !== false,
      linkedAccounts: p.linkedAccounts || []
    }));
  }

  if (config.comptes && !config.accounts) {
    config.accounts = config.comptes.map((c, i) => ({
      id: c.id || `a${i + 1}`,
      platform: c.plateforme || c.platform || 'TikTok',
      login: c.login || '',
      active: c.active !== false,
      products: []
    }));
  }

  if (config.products && config.accounts) {
    config.accounts.forEach(acc => {
      if (!acc.products || acc.products.length === 0) {
        acc.products = config.products
          .filter(p => p.linkedAccounts && p.linkedAccounts.includes(acc.id))
          .map(p => p.id);
      }
    });
  }

  return config;
}

// ============ CHARGER HISTORIQUE ============
function loadHistory() {
  const paths = ['data/history.json', 'automation/videos/history.json'];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {}
  }
  return [];
}

// ============ SAUVEGARDER HISTORIQUE ============
function saveHistory(history) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/history.json', JSON.stringify(history, null, 2));

  fs.mkdirSync('automation/videos', { recursive: true });
  fs.writeFileSync('automation/videos/history.json', JSON.stringify(history, null, 2));
}

// ============ LLM - GENERER SCRIPT ============
async function generateScript(product, account, history) {
  console.log(`🧠 ${LLM_PROVIDER.toUpperCase()} genere script pour: ${product.nom}`);

  const recentHooks = history.slice(-10).map(h => h.hook).filter(Boolean).join('\n- ');
  const whatsapp = product.whatsapp || WHATSAPP_DEFAULT;

  const prompt = `Tu es un expert marketing viral pour la Cote d'Ivoire.

PRODUIT: ${product.nom}
PRIX: ${product.prix} FCFA
DESCRIPTION: ${product.description || ''}
WHATSAPP: wa.me/${whatsapp}
COMPTE: ${account.login} (${account.platform})

HOOKS DEJA UTILISES (NE PAS REPETER):
${recentHooks || 'Aucun encore'}

REGLES:
- Hook 0-3sec: accroche ULTRA virale, jamais utilisee avant
- Parle comme un ivoirien (naturel, pas formel)
- 15-20 secondes max
- Toujours finir par: "Ecris-moi sur WhatsApp wa.me/${whatsapp}"

Reponds UNIQUEMENT en JSON valide:
{
  "persona": "Prenom, age, quartier Abidjan",
  "hook": "phrase d'accroche 0-3sec",
  "probleme": "douleur du client en 1 phrase",
  "solution": "comment le produit regle le probleme",
  "preuve": "chiffre ou resultat concret",
  "cta": "wa.me/${whatsapp}",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
  "description": "description post optimisee",
  "motsCles": "mots-cles pour Pexels en anglais"
}`;

  let result;

  if (LLM_PROVIDER === 'grok') {
    const resp = await fetchJSON('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getLLMKey()}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 1000
      })
    });

    if (resp.status !== 200) throw new Error(`Grok API error: ${JSON.stringify(resp.data)}`);
    const content = resp.data.choices[0].message.content;
    result = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

  } else if (LLM_PROVIDER === 'groq') {
    const resp = await fetchJSON('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getLLMKey()}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    });

    if (resp.status !== 200) throw new Error(`Groq API error: ${JSON.stringify(resp.data)}`);
    result = JSON.parse(resp.data.choices[0].message.content);

  } else if (LLM_PROVIDER === 'gemini') {
    const resp = await fetchJSON(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${getLLMKey()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
        })
      }
    );

    if (resp.status !== 200) throw new Error(`Gemini API error: ${JSON.stringify(resp.data)}`);
    const text = resp.data.candidates[0].content.parts[0].text;
    result = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  }

  console.log(`✅ Script: "${result.hook}"`);
  return result;
}

// ============ PEXELS - TELECHARGER VIDEO ============
async function downloadPexelsVideo(keywords, outputPath) {
  console.log(`🎬 Pexels: recherche "${keywords}"`);

  if (!PEXELS_API_KEY) {
    console.log('⚠️ Pas de cle Pexels, generation video placeholder');
    generatePlaceholderVideo(outputPath);
    return outputPath;
  }

  const page = Math.floor(Math.random() * 3) + 1;
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&size=medium&per_page=15&page=${page}`;

  const resp = await fetchJSON(url, {
    headers: { 'Authorization': PEXELS_API_KEY }
  });

  if (resp.status !== 200 || !resp.data.videos || resp.data.videos.length === 0) {
    console.log('⚠️ Aucune video Pexels, generation placeholder');
    generatePlaceholderVideo(outputPath);
    return outputPath;
  }

  const videos = resp.data.videos;
  const video = videos[Math.floor(Math.random() * videos.length)];
  const fileUrl = video.video_files.find(f => f.quality === 'hd' || f.quality === 'sd');

  if (!fileUrl || !fileUrl.link) {
    console.log('⚠️ Pas de lien video, generation placeholder');
    generatePlaceholderVideo(outputPath);
    return outputPath;
  }

  await downloadFile(fileUrl.link, outputPath);
  console.log(`✅ Video telechargee: ${outputPath}`);
  return outputPath;
}

// ============ VIDEO PLACEHOLDER ============
function generatePlaceholderVideo(outputPath) {
  console.log('🎨 Generation video placeholder (fond colore)...');
  try {
    execSync(
      `ffmpeg -f lavfi -i "color=c=0x1a1a2e:s=1080x1920:d=20" -c:v libx264 -preset ultrafast -crf 28 -y "${outputPath}"`,
      { timeout: 30000, stdio: 'pipe' }
    );
    console.log('✅ Video placeholder creee');
  } catch (e) {
    console.error('❌ Erreur placeholder:', e.message);
    throw e;
  }
}

// ============ EDGE TTS - GENERER VOIX ============
function generateVoice(script, outputPath) {
  console.log('🗣️ Edge TTS: generation voix...');

  const texte = `${script.hook}. ${script.probleme}. ${script.solution}. ${script.preuve}. Ecris-moi sur WhatsApp.`;
  const texteClean = texte.replace(/['"\\]/g, '').replace(/\n/g, ' ').substring(0, 500);

  try {
    execSync(
      `edge-tts --voice fr-FR-DeniseNeural --text "${texteClean}" --write-media "${outputPath}" --rate=+15%`,
      { timeout: 30000, stdio: 'pipe' }
    );
    console.log('✅ Voix generee');
  } catch (e) {
    console.log('⚠️ Edge TTS echoue, generation silence');
    execSync(
      `ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 15 -c:a aac -y "${outputPath}"`,
      { timeout: 15000, stdio: 'pipe' }
    );
  }
  return outputPath;
}

// ============ FFMPEG - MONTER VIDEO ============
function mountVideo(videoPath, audioPath, script, outputPath) {
  console.log('✂️ FFmpeg: montage video...');

  const splitTextIntoLines = (text, maxChars = 35) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 2);
  };

  const hookRaw = (script.hook || 'Offre Speciale').replace(/['"\\:]/g, '');
  const hookLines = splitTextIntoLines(hookRaw, 35);
  const hook = hookLines.join('\\n');

  const whatsapp = (script.cta || WHATSAPP_DEFAULT).replace('wa.me/', '').replace(/[^0-9]/g, '');
  const cta = `📲 WhatsApp : ${whatsapp}`;

  const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,\
drawtext=text='${hook}':fontsize=50:fontcolor=white:x=(w-text_w)/2:y=h*0.10:borderw=4:bordercolor=black:shadowcolor=black:shadowx=3:shadowy=3:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf,\
drawtext=text='${cta}':fontsize=40:fontcolor=yellow:x=(w-text_w)/2:y=h*0.90:borderw=4:bordercolor=black:shadowcolor=black:shadowx=3:shadowy=3:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" \
    -map 0:v -map 1:a \
    -c:v libx264 -preset fast -crf 26 \
    -c:a aac -b:a 128k \
    -shortest -t 25 \
    -y "${outputPath}"`;

  try {
    execSync(cmd, { timeout: 120000, stdio: 'pipe' });
    console.log('✅ Video montee');
  } catch (e) {
    console.log('⚠️ Montage avec texte echoue, montage simple...');
    execSync(
      `ffmpeg -i "${videoPath}" -i "${audioPath}" -map 0:v -map 1:a -c:v libx264 -preset fast -crf 26 -c:a aac -shortest -t 25 -y "${outputPath}"`,
      { timeout: 120000, stdio: 'pipe' }
    );
  }

  return outputPath;
}

// ============ PUBLIER VIA BUFFER API (CORRIGÉ) ============
async function getBufferProfiles() {
  console.log('📋 Buffer: recuperation des profils...');
  
  if (!BUFFER_API_KEY) {
    console.log('❌ BUFFER_API_KEY manquante');
    return [];
  }

  const result = await fetchJSON(`https://api.bufferapp.com/1/profiles.json?access_token=${BUFFER_API_KEY}`, {
    method: 'GET'
  });

  if (result.status === 200 && Array.isArray(result.data)) {
    console.log(`✅ Buffer: ${result.data.length} profil(s) trouves`);
    result.data.forEach(p => console.log(`   → ${p.formatted_username} (${p.service}) - ID: ${p.id}`));
    return result.data;
  } else {
    console.log(`❌ Buffer profils erreur: ${JSON.stringify(result.data)}`);
    return [];
  }
}

async function uploadVideoToTmpHost(videoPath) {
  console.log('☁️ Upload video vers hebergement temporaire...');

  if (!fs.existsSync(videoPath)) {
    console.log(`❌ Fichier video inexistant: ${videoPath}`);
    return null;
  }

  const videoData = fs.readFileSync(videoPath);
  console.log(`📦 Taille video: ${(videoData.length / 1024 / 1024).toFixed(2)} MB`);

  // Essayer plusieurs services d'upload temporaire
  const hosts = [
    { hostname: 'file.io', path: '/', fieldName: 'file' },
    { hostname: '0x0.st', path: '/', fieldName: 'file' },
    { hostname: 'tmpfiles.org', path: '/api/v1/upload', fieldName: 'file' }
  ];

  for (const host of hosts) {
    try {
      console.log(`   Essai upload via ${host.hostname}...`);

      const boundary = '----BufferUpload' + Date.now();
      const fileHeader = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${host.fieldName}"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
        'utf8'
      );
      const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const fullBody = Buffer.concat([fileHeader, videoData, fileFooter]);

      const url = await new Promise((resolve) => {
        const req = https.request({
          hostname: host.hostname,
          path: host.path,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': fullBody.length
          },
          timeout: 120000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log(`   ${host.hostname} reponse: ${data.substring(0, 200)}`);
            try {
              const json = JSON.parse(data);
              if (json.link) { resolve(json.link); return; }
              if (json.data && json.data.url) { resolve(json.data.url); return; }
            } catch (e) {}
            const trimmed = data.trim();
            if (trimmed.startsWith('http')) {
              resolve(trimmed);
            } else {
              resolve(null);
            }
          });
        });

        req.on('error', (err) => {
          console.log(`   ${host.hostname} erreur: ${err.message}`);
          resolve(null);
        });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(fullBody);
        req.end();
      });

      if (url) {
        console.log(`✅ Video uploadee: ${url}`);
        return url;
      }
    } catch (e) {
      console.log(`⚠️ ${host.hostname} echoue: ${e.message}`);
    }
  }

  console.log('⚠️ Tous les services d upload ont echoue');
  return null;
}

async function publishViaBuffer(videoPath, account, script) {
  if (!BUFFER_API_KEY) {
    return { success: false, error: 'Pas de cle BUFFER_API_KEY' };
  }

  console.log(`\n📤 Buffer: publication sur ${account.platform} (${account.login})...`);

  // 1. Recuperer les profils Buffer
  const profiles = await getBufferProfiles();
  if (profiles.length === 0) {
    return { success: false, error: 'Aucun profil Buffer trouve' };
  }

  // 2. Trouver le bon profil
  const platformMap = {
    'tiktok': 'tiktok',
    'instagram': 'instagram'
  };
  const targetPlatform = platformMap[account.platform.toLowerCase()] || account.platform.toLowerCase();
  const targetLogin = account.login.replace('@', '').toLowerCase();

  let profile = profiles.find(p =>
    p.service === targetPlatform &&
    (p.formatted_username || '').replace('@', '').toLowerCase() === targetLogin
  );

  if (!profile) {
    profile = profiles.find(p => p.service === targetPlatform);
  }

  if (!profile) {
    console.log(`⚠️ Buffer: aucun profil ${targetPlatform} trouve`);
    console.log(`   Profils disponibles: ${profiles.map(p => `${p.service}:${p.formatted_username}`).join(', ')}`);
    return { success: false, error: `Profil ${targetPlatform} non trouve` };
  }

  console.log(`✅ Buffer profil selectionne: ${profile.formatted_username} (${profile.service}) - ID: ${profile.id}`);

  // 3. Upload video
  const videoUrl = await uploadVideoToTmpHost(videoPath);
  
  if (!videoUrl) {
    console.log('⚠️ Upload video echoue, tentative avec lien direct GitHub Actions');
  }

  // 4. Construire la caption
  const whatsapp = (script.cta || WHATSAPP_DEFAULT).replace('wa.me/', '');
  const caption = `${script.hook}\n\n${script.description || ''}\n\n${script.hashtags || ''}\n\n📞 Interesse ? Contacte-moi sur WhatsApp 👉 wa.me/${whatsapp}`;

  console.log(`📝 Caption (${caption.length} chars): ${caption.substring(0, 100)}...`);

  // 5. Creer le post via Buffer API v2
  const postBody = {
    text: caption.substring(0, 2200),
    profile_ids: [profile.id],
    now: true,
    media: []
  };

  if (videoUrl) {
    postBody.media = [{
      type: 'video',
      url: videoUrl,
      thumbnail_url: videoUrl
    }];
    console.log(`🎬 Video URL: ${videoUrl}`);
  } else {
    console.log('⚠️ Pas de video URL, publication texte uniquement');
  }

  console.log(`📤 Buffer: envoi du post...`);
  console.log(`   Profile ID: ${profile.id}`);
  console.log(`   Platform: ${profile.service}`);

  const postResult = await fetchJSON('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      access_token: BUFFER_API_KEY,
      ...postBody
    })
  });

  console.log(`📥 Buffer reponse: ${JSON.stringify(postResult.data).substring(0, 500)}`);

  if (postResult.status === 200 && postResult.data && (postResult.data.success || postResult.data.id)) {
    console.log(`✅ Buffer: publie avec succes sur ${account.platform} (${account.login})`);
    return { 
      success: true, 
      platform: account.platform, 
      profileId: profile.id,
      postId: postResult.data.id
    };
  } else {
    console.log(`⚠️ Buffer reponse erreur: ${JSON.stringify(postResult.data)}`);
    return { success: false, error: JSON.stringify(postResult.data) };
  }
}

// ============ PUBLIER VIA UPLOAD-POST API ============
async function publishViaUploadPost(videoPath, account, script) {
  if (!UPLOADPOST_API_KEY) {
    console.log('⚠️ Pas de cle UPLOADPOST_API_KEY, publication ignoree');
    return { success: false, error: 'Pas de cle API Upload-Post' };
  }

  const platform = account.platform.toLowerCase().replace('instagram', 'instagram').replace('tiktok', 'tiktok');
  const caption = `${script.hook}\n\n${script.description || ''}\n\n${script.hashtags || ''}\n\nInteresse ? Contacte-moi sur WhatsApp 👉 ${script.cta}`;

  console.log(`📤 Upload-Post: publication sur ${platform} (${account.login})...`);

  const videoData = fs.readFileSync(videoPath);
  const boundary = '----ViralAgent' + Date.now();

  let body = '';
  
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="user"\r\n\r\n`;
  body += `${account.login.replace('@', '')}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="platform[]"\r\n\r\n`;
  body += `${platform}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="title"\r\n\r\n`;
  body += `${caption.substring(0, 2200)}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="timezone"\r\n\r\n`;
  body += `${TZ}\r\n`;

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="async_upload"\r\n\r\n`;
  body += `true\r\n`;

  const preFileBuffer = Buffer.from(body, 'utf8');
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
    'utf8'
  );
  const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  const fullBody = Buffer.concat([preFileBuffer, fileHeader, videoData, fileFooter]);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.upload-post.com',
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            console.log(`✅ Publie sur ${platform}: ${JSON.stringify(result)}`);
          } else {
            console.log(`⚠️ Upload-Post reponse: ${data}`);
          }
          resolve(result);
        } catch (e) {
          console.log(`⚠️ Upload-Post raw: ${data}`);
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Upload-Post erreur: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('⚠️ Upload-Post timeout (traitement en cours cote serveur)');
      resolve({ success: true, message: 'Timeout mais probablement en cours' });
    });

    req.write(fullBody);
    req.end();
  });
}

// ============ TRAITER UN COMPTE ============
async function processAccount(account, products, history) {
  console.log(`\n📱 Traitement: ${account.login} (${account.platform})`);

  let accountProducts = products.filter(p =>
    (account.products && account.products.includes(p.id)) ||
    (p.linkedAccounts && p.linkedAccounts.includes(account.id))
  );

  if (accountProducts.length === 0) {
    accountProducts = products.filter(p => p.active !== false);
  }

  if (accountProducts.length === 0) {
    console.log('⚠️ Aucun produit disponible');
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const alreadyDone = history.find(h => h.date === today && h.compte === account.login);
  if (alreadyDone) {
    console.log(`⏭️ Deja genere aujourd'hui pour ${account.login}`);
    return null;
  }

  const todayIndex = new Date().getDate() % accountProducts.length;
  const product = accountProducts[todayIndex];
  console.log(`📦 Produit: ${product.nom} (${product.prix} FCFA)`);

  const script = await generateScript(product, account, history);

  const videoId = `vid_${Date.now()}`;
  const rawVideo = `output/${videoId}_raw.mp4`;
  const audioFile = `output/${videoId}.mp3`;
  const finalVideo = `output/${videoId}_final.mp4`;

  await downloadPexelsVideo(script.motsCles || 'african market woman', rawVideo);

  generateVoice(script, audioFile);

  mountVideo(rawVideo, audioFile, script, finalVideo);

  const archiveDir = 'output/archive';
  fs.mkdirSync(archiveDir, { recursive: true });
  const archiveName = `video-${today}-${product.nom.replace(/[^a-zA-Z0-9]/g, '_')}-${account.login.replace('@', '')}.mp4`;
  fs.copyFileSync(finalVideo, path.join(archiveDir, archiveName));

  try { if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo); } catch (e) {}
  try { if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile); } catch (e) {}

  let publishResult = { success: false, error: 'Non tente' };

  if (BUFFER_API_KEY) {
    console.log('\n📤 Publication via Buffer...');
    publishResult = await publishViaBuffer(finalVideo, account, script);
  }
  else if (UPLOADPOST_API_KEY) {
    console.log('\n📤 Publication via Upload-Post...');
    publishResult = await publishViaUploadPost(finalVideo, account, script);
  }
  else {
    console.log('\n⚠️ Aucun service de publication configure');
    console.log('   → BUFFER_API_KEY (recommande, gratuit): publish.buffer.com/settings/api');
    console.log('   → UPLOADPOST_API_KEY (alternative): upload-post.com');
    console.log('   → Video generee mais non publiee automatiquement');
  }

  const entry = {
    id: videoId,
    date: today,
    compte: account.login,
    plateforme: account.platform,
    produit: product.nom,
    hook: script.hook,
    persona: script.persona,
    hashtags: script.hashtags,
    description: script.description,
    whatsapp: script.cta,
    videoPath: finalVideo,
    archivePath: path.join(archiveDir, archiveName),
    statut: publishResult.success ? 'publiee' : 'generee',
    publishResult: publishResult.success ? 'OK' : (publishResult.error || 'echec'),
    vues: 0,
    likes: 0,
    commentaires: 0
  };

  history.push(entry);
  saveHistory(history);

  console.log(`\n✅ Video prete: ${finalVideo}`);
  console.log(`📁 Archive: ${archiveName}`);
  console.log(`📤 Publication: ${entry.statut} (${entry.publishResult})`);
  return { script, videoPath: finalVideo, entry, publishResult };
}

// ============ RESUME FINAL ============
function printSummary(results) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUME DE LA SESSION');
  console.log('='.repeat(50));

  const success = results.filter(r => r !== null);
  console.log(`✅ Videos generees: ${success.length}`);
  console.log(`❌ Echecs: ${results.length - success.length}`);

  success.forEach(r => {
    if (r && r.entry) {
      console.log(`  📹 ${r.entry.produit} → ${r.entry.compte} (${r.entry.plateforme})`);
      console.log(`     Hook: "${r.entry.hook}"`);
      console.log(`     WhatsApp: ${r.entry.whatsapp}`);
      console.log(`     Statut: ${r.entry.statut} (${r.entry.publishResult})`);
    }
  });

  if (fs.existsSync('output')) {
    const files = fs.readdirSync('output').filter(f => f.endsWith('_final.mp4'));
    console.log(`\n📁 Fichiers prets a publier:`);
    files.forEach(f => console.log(`  → output/${f}`));
  }

  console.log('='.repeat(50));
}

// ============ MAIN ============
async function main() {
  console.log('🚀 ViralAgent Pro - Demarrage');
  console.log(`⏰ Heure: ${new Date().toLocaleString('fr-CI', { timeZone: TZ })}`);
  console.log(`🧠 LLM: ${LLM_PROVIDER.toUpperCase()} ${getLLMKey() ? '✅ actif' : '❌ manquant'}`);
  console.log(`🎬 Pexels: ${PEXELS_API_KEY ? '✅ actif' : '⚠️ manquant (mode placeholder)'}`);
  console.log(`📤 Buffer: ${BUFFER_API_KEY ? '✅ actif (publication auto)' : '⚠️ non configure'}`);
  console.log(`📤 Upload-Post: ${UPLOADPOST_API_KEY ? '✅ actif (backup)' : '⚠️ non configure'}`);
  console.log(`📱 WhatsApp default: wa.me/${WHATSAPP_DEFAULT}`);

  fs.mkdirSync('output', { recursive: true });
  fs.mkdirSync('output/archive', { recursive: true });
  fs.mkdirSync('data', { recursive: true });

  const config = loadConfig();
  const history = loadHistory();

  console.log(`\n📦 Produits: ${config.products?.length || 0}`);
  if (config.products) {
    config.products.forEach(p => console.log(`  → ${p.nom} (${p.prix} FCFA) WhatsApp: ${p.whatsapp || WHATSAPP_DEFAULT}`));
  }

  console.log(`👥 Comptes: ${config.accounts?.length || 0}`);
  if (config.accounts) {
    config.accounts.forEach(a => console.log(`  → ${a.login} (${a.platform}) ${a.active ? '✅' : '❌'}`));
  }

  console.log(`📊 Historique: ${history.length} videos`);

  const activeAccounts = (config.accounts || []).filter(a => a.active !== false);

  if (activeAccounts.length === 0) {
    console.log('⚠️ Aucun compte actif trouve');
    return;
  }

  console.log(`\n🎯 ${activeAccounts.length} compte(s) actif(s) a traiter\n`);

  const results = [];
  for (const account of activeAccounts) {
    try {
      const result = await processAccount(account, config.products || [], history);
      results.push(result);
      if (activeAccounts.indexOf(account) < activeAccounts.length - 1) {
        console.log('⏳ Pause 5 secondes...');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      console.error(`❌ Erreur compte ${account.login}:`, err.message);
      results.push(null);
    }
  }

  printSummary(results);
  console.log('\n🎉 Agent termine !');
}

main().catch(err => {
  console.error('❌ ERREUR FATALE:', err.message);
  console.error(err.stack);
  process.exit(1);
});
