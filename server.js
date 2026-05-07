const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506500';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

console.log('🚀 ViralAgent Pro');
console.log('==================');
console.log('PEXELS_API_KEY:', PEXELS_API_KEY ? `Présent (${PEXELS_API_KEY.length} car)` : 'MANQUANT');

// Créer dossier
const outputDir = './output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const timestamp = Date.now();
const rawVideo = `${outputDir}/raw_${timestamp}.mp4`;
const finalVideo = `${outputDir}/video_${timestamp}_final.mp4`;

// Fonction téléchargement Pexels
function downloadPexels() {
  return new Promise((resolve) => {
    if (!PEXELS_API_KEY) {
      console.log('❌ Clé Pexels manquante');
      resolve(false);
      return;
    }

    console.log('🔍 Recherche Pexels...');
    
    const options = {
      hostname: 'api.pexels.com',
      path: '/videos/search?query=african+business&orientation=portrait&per_page=5',
      method: 'GET',
      headers: {
        'Authorization': PEXELS_API_KEY.trim() // trim pour enlever espaces
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.videos && json.videos.length > 0) {
            const video = json.videos[0];
            const file = video.video_files.find(f => f.quality === 'sd' || f.quality === 'hd');
            if (file && file.link) {
              console.log('✅ Vidéo trouvée, téléchargement...');
              downloadFile(file.link, rawVideo).then(resolve).catch(() => resolve(false));
              return;
            }
          }
          console.log('⚠️ Aucune vidéo trouvée');
          resolve(false);
        } catch(e) {
          console.log('⚠️ Erreur parse JSON:', e.message);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.log('⚠️ Erreur API:', e.message);
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('⚠️ Timeout API');
      resolve(false);
    });
    
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode === 302 && response.headers.location) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        if (fs.statSync(dest).size > 10000) { // Plus de 10KB
          resolve(true);
        } else {
          reject(new Error('Fichier trop petit'));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Essayer Pexels
  let usePexels = await downloadPexels();
  
  if (!usePexels || !fs.existsSync(rawVideo)) {
    console.log('🎨 Création fond couleur...');
    execSync(`ffmpeg -f lavfi -i color=c=0xFF6B35:size=1080x1920:rate=30 -t 15 -pix_fmt yuv420p -y "${rawVideo}"`, { stdio: 'pipe' });
    usePexels = false;
  }

  // Audio
  const audioFile = `${outputDir}/audio_${timestamp}.mp3`;
  try {
    execSync(`edge-tts --voice fr-FR-DeniseNeural --text "Découvre cette astuce maintenant." --write-media "${audioFile}" --rate=+15%`, { timeout: 30000 });
  } catch(e) {
    execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -c:a aac -y "${audioFile}"`, { stdio: 'pipe' });
  }

  // Montage final
  console.log('✂️ Montage final...');
  const hook = "Gagne 100k/mois!".replace(/'/g, "\\'");
  const cmd = `ffmpeg -i "${rawVideo}" -i "${audioFile}" -vf "scale=1080:1920,format=yuv420p,drawtext=text='${hook}':fontsize=90:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=250,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=55:fontcolor=#25D366:borderw=5:bordercolor=black:x=(w-text_w)/2:y=1500" -c:v libx264 -preset fast -crf 26 -c:a aac -shortest -y "${finalVideo}"`;
  
  execSync(cmd, { stdio: 'pipe' });

  // Nettoyer
  try { fs.unlinkSync(rawVideo); } catch(e) {}
  try { fs.unlinkSync(audioFile); } catch(e) {}

  // Vérification
  if (fs.existsSync(finalVideo)) {
    const size = fs.statSync(finalVideo).size;
    console.log(`✅ VIDÉO CRÉÉE: ${finalVideo}`);
    console.log(`📊 Taille: ${(size/1024/1024).toFixed(2)} MB`);
    console.log(`🎬 Source: ${usePexels ? 'Pexels' : 'Placeholder'}`);
    
    // Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const msg = `🎬 Vidéo ${usePexels ? 'Pexels' : 'Placeholder'} OK\n📊 ${(size/1024/1024).toFixed(2)} MB\n📱 ${WHATSAPP_DEFAULT}`;
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(msg)}`;
      https.get(url).on('error', () => {});
    }
  } else {
    console.error('❌ Échec création vidéo');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
