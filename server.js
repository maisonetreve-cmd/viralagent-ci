const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506508';

console.log('🚀 ViralAgent Pro');

const outputDir = './output';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const timestamp = Date.now();
const rawVideo = `${outputDir}/raw_${timestamp}.mp4`;
const audioFile = `${outputDir}/audio_${timestamp}.mp3`;
const finalVideo = `${outputDir}/video_${timestamp}_final.mp4`;

// Télécharger Pexels
function downloadPexels() {
  return new Promise((resolve) => {
    if (!PEXELS_API_KEY) { resolve(false); return; }
    
    console.log('🔍 Recherche Pexels...');
    const options = {
      hostname: 'api.pexels.com',
      path: '/videos/search?query=african+business&orientation=portrait&per_page=5',
      method: 'GET',
      headers: { 'Authorization': PEXELS_API_KEY },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.videos && json.videos[0]) {
            const video = json.videos[0];
            const file = video.video_files.find(f => f.quality === 'sd') || video.video_files[0];
            if (file && file.link) {
              console.log('✅ Vidéo trouvée...');
              https.get(file.link, { timeout: 30000 }, (fileRes) => {
                if (fileRes.statusCode === 302 && fileRes.headers.location) {
                  https.get(fileRes.headers.location, { timeout: 30000 }, (realRes) => {
                    realRes.pipe(fs.createWriteStream(rawVideo));
                    realRes.on('end', () => resolve(true));
                  }).on('error', () => resolve(false));
                } else {
                  fileRes.pipe(fs.createWriteStream(rawVideo));
                  fileRes.on('end', () => resolve(true));
                }
              }).on('error', () => resolve(false));
            } else resolve(false);
          } else resolve(false);
        } catch(e) { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  // 1. Vidéo
  let usePexels = await downloadPexels();
  if (!usePexels) {
    console.log('🎨 Fond coloré...');
    execSync(`ffmpeg -f lavfi -i color=c=0xFF6B35:s=1080x1920:d=15 -pix_fmt yuv420p -y "${rawVideo}"`, { stdio: 'pipe' });
  }

  // 2. AUDIO (Edge TTS)
  console.log('🎵 Génération voix...');
  const hook = "Gagne 100k par mois avec cette methode";
  try {
    execSync(`edge-tts --voice fr-FR-DeniseNeural --text "${hook}. Contacte moi sur WhatsApp." --write-media "${audioFile}" --rate=+10%`, { timeout: 30000 });
    console.log('✅ Voix générée');
  } catch(e) {
    console.log('⚠️ Voix par défaut...');
    execSync(`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 5 -c:a libmp3lame -q:a 4 -y "${audioFile}"`, { stdio: 'pipe' });
  }

  // 3. Montage vidéo + audio + texte
  console.log('✂️ Montage final...');
  const hookSafe = hook.replace(/'/g, "\\'");
  const cmd = `ffmpeg -i "${rawVideo}" -i "${audioFile}" -vf "scale=1080:1920,drawtext=text='${hookSafe}':fontsize=90:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=300,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=55:fontcolor=#25D366:borderw=5:bordercolor=black:x=(w-text_w)/2:y=1500" -c:v libx264 -preset fast -crf 24 -c:a aac -b:a 128k -shortest -pix_fmt yuv420p -y "${finalVideo}"`;
  
  execSync(cmd, { stdio: 'pipe', timeout: 120000 });

  // Cleanup
  try { fs.unlinkSync(rawVideo); fs.unlinkSync(audioFile); } catch(e) {}

  if (fs.existsSync(finalVideo)) {
    const size = fs.statSync(finalVideo).size;
    console.log(`✅ VIDÉO SONORISÉE: ${(size/1024/1024).toFixed(2)} MB`);
    console.log(`🎬 ${usePexels ? 'Pexels' : 'Placeholder'} + Voix Denise`);
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const msg = `🎬 Vidéo avec SON!%0A📊 ${(size/1024/1024).toFixed(2)} MB%0A🎵 Voix: fr-FR-Denise`;
      https.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${msg}`);
    }
  }
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
