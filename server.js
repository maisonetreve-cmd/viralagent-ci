const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506508';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

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
    if (options.body) req.write(options.body);
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

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('⚠️ Telegram non configuré');
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const encoded = encodeURIComponent(text);
  try {
    await fetchJSON(`${url}?chat_id=${TELEGRAM_CHAT_ID}&text=${encoded}&parse_mode=HTML`);
    console.log('✅ Message Telegram envoyé');
  } catch(e) { 
    console.log('❌ Telegram error:', e.message); 
  }
}

async function downloadPexelsVideo(keywords, outputPath) {
  if (!PEXELS_API_KEY) {
    console.log('⚠️ PEXELS_API_KEY manquant - utilisation placeholder');
    return false;
  }
  
  try {
    console.log(`🔍 Recherche Pexels: ${keywords}`);
    const resp = await fetchJSON(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&per_page=10`, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    
    if (resp.status === 200 && resp.data?.videos?.length > 0) {
      const video = resp.data.videos[Math.floor(Math.random() * resp.data.videos.length)];
      const file = video.video_files.find(f => f.quality === 'sd' || f.quality === 'hd');
      if (file && file.link) {
        console.log(`   Téléchargement: ${file.link.substring(0, 50)}...`);
        await downloadFile(file.link, outputPath);
        console.log('   ✅ Vidéo Pexels téléchargée');
        return true;
      }
    }
    console.log('   ⚠️ Aucune vidéo trouvée sur Pexels');
    return false;
  } catch(e) {
    console.log('   ⚠️ Erreur Pexels:', e.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Démarrage génération vidéo...');
  
  if (!fs.existsSync('output')) {
    fs.mkdirSync('output', { recursive: true });
  }
  
  const timestamp = Date.now();
  const rawVideo = `output/vid_${timestamp}_raw.mp4`;
  const audioFile = `output/vid_${timestamp}.mp3`;
  const finalVideo = `output/vid_${timestamp}_final.mp4`;
  
  try {
    // Étape 1: Vidéo (Pexels ou placeholder)
    console.log('🎬 Étape 1: Récupération vidéo...');
    const pexelsOk = await downloadPexelsVideo('african business success', rawVideo);
    
    if (!pexelsOk) {
      console.log('🎨 Création placeholder...');
      execSync(`ffmpeg -f lavfi -i color=c=0xFF6B35:size=1080x1920:d=15 -pix_fmt yuv420p -y "${rawVideo}"`, { stdio: 'pipe' });
    }
    
    if (!fs.existsSync(rawVideo)) {
      throw new Error('Vidéo brute non créée!');
    }

    // Étape 2: Audio
    console.log('🎵 Étape 2: Génération audio...');
    try {
      execSync(`edge-tts --voice fr-FR-DeniseNeural --text "Découvre cette astuce. Contacte moi." --write-media "${audioFile}" --rate=+10%`, { timeout: 30000 });
    } catch(e) {
      execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -c:a aac -y "${audioFile}"`);
    }

    // Étape 3: Montage avec TEXTE CORRIGÉ (pas de débordement)
    console.log('✂️ Étape 3: Montage final...');
    
    // CORRECTION: Texte court pour éviter débordement
    const hook = "Gagne 100k/mois!"; // 20 caractères max
    const whatsapp = WHATSAPP_DEFAULT;
    
    // CORRECTION: Police plus petite et position ajustée
    const cmd3 = `ffmpeg -i "${rawVideo}" -i "${audioFile}" -vf "scale=1080:1920,format=yuv420p,drawtext=text='${hook}':fontsize=90:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=300,drawtext=text='📱 ${whatsapp}':fontsize=50:fontcolor=#25D366:borderw=5:bordercolor=black:x=(w-text_w)/2:y=1500" -c:v libx264 -preset fast -crf 28 -c:a aac -shortest -y "${finalVideo}"`;
    
    execSync(cmd3, { stdio: 'pipe' });
    
    if (!fs.existsSync(finalVideo)) {
      throw new Error('Vidéo finale non créée!');
    }
    
    const stats = fs.statSync(finalVideo);
    console.log(`📊 Taille: ${(stats.size/1024/1024).toFixed(2)} MB`);
    
    await sendTelegramMessage(`🎬 Vidéo prête!\\n📊 ${(stats.size/1024/1024).toFixed(2)} MB\\n📁 ${finalVideo}`);
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    await sendTelegramMessage(`❌ Erreur: ${error.message}`);
    process.exit(1);
  }
  
  console.log('✅ Terminé!');
}

main();
