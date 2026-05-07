const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506500';

console.log('🚀 ViralAgent Pro');

const outputDir = './output';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const timestamp = Date.now();
const rawVideo = `${outputDir}/raw_${timestamp}.mp4`;
const finalVideo = `${outputDir}/video_${timestamp}_final.mp4`;

// Télécharger depuis Pexels
function downloadPexels() {
  return new Promise((resolve) => {
    if (!PEXELS_API_KEY) {
      resolve(false);
      return;
    }

    console.log('🔍 Recherche vidéo Pexels...');
    
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
              console.log('✅ Vidéo trouvée, téléchargement...');
              const fileReq = https.get(file.link, { timeout: 30000 }, (fileRes) => {
                if (fileRes.statusCode === 302 && fileRes.headers.location) {
                  https.get(fileRes.headers.location, { timeout: 30000 }, (realRes) => {
                    const writeStream = fs.createWriteStream(rawVideo);
                    realRes.pipe(writeStream);
                    writeStream.on('finish', () => {
                      console.log('✅ Téléchargé:', (fs.statSync(rawVideo).size/1024/1024).toFixed(2), 'MB');
                      resolve(true);
                    });
                  }).on('error', () => resolve(false));
                } else {
                  const writeStream = fs.createWriteStream(rawVideo);
                  fileRes.pipe(writeStream);
                  writeStream.on('finish', () => resolve(true));
                }
              }).on('error', () => resolve(false));
            } else resolve(false);
          } else resolve(false);
        } catch(e) {
          resolve(false);
        }
      });
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  // Essayer Pexels
  let usePexels = await downloadPexels();
  
  if (!usePexels) {
    console.log('🎨 Création fond coloré...');
    execSync(`ffmpeg -f lavfi -i color=c=0xFF6B35:s=1080x1920:d=15 -pix_fmt yuv420p -y "${rawVideo}"`, { stdio: 'pipe' });
  }

  if (!fs.existsSync(rawVideo)) {
    console.error('❌ Échec création vidéo brute');
    process.exit(1);
  }

  // PAS D'AUDIO pour l'instant (edge-tts bug)
  // On copie juste la vidéo brute avec texte
  
  console.log('✂️ Ajout du texte...');
  const hook = "Gagne 100k par mois!".replace(/'/g, "\\'");
  const cmd = `ffmpeg -i "${rawVideo}" -vf "scale=1080:1920,drawtext=text='${hook}':fontsize=90:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=300,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=55:fontcolor=#25D366:borderw=5:bordercolor=black:x=(w-text_w)/2:y=1500" -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p -y "${finalVideo}"`;
  
  execSync(cmd, { stdio: 'pipe' });

  // Cleanup
  try { fs.unlinkSync(rawVideo); } catch(e) {}

  if (fs.existsSync(finalVideo)) {
    const size = fs.statSync(finalVideo).size;
    console.log(`✅ VIDÉO CRÉÉE: ${(size/1024/1024).toFixed(2)} MB`);
    console.log(`🎬 Source: ${usePexels ? 'PEXELS ✅' : 'Placeholder'}`);
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const msg = `🎬 ${usePexels ? 'Pexels' : 'Placeholder'} OK!%0A📊 ${(size/1024/1024).toFixed(2)} MB%0A📝 ${hook}`;
      https.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${msg}`);
    }
  } else {
    console.error('❌ Échec final');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
