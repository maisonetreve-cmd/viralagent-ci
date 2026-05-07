const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

// RÉCUPÉRATION AVEC TRIM (enlève les espaces)
const PEXELS_API_KEY = (process.env.PEXELS_API_KEY || '').trim();
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();
const WHATSAPP_DEFAULT = (process.env.WHATSAPP_DEFAULT || '2250508506500').trim();

console.log('🔍 DEBUG VARIABLES ENV');
console.log('=======================');
console.log('Toutes les variables env:', Object.keys(process.env).filter(k => k.includes('PEXEL') || k.includes('TELEGRAM')));
console.log('');
console.log('PEXELS_API_KEY brut:', process.env.PEXELS_API_KEY ? `"${process.env.PEXELS_API_KEY.substring(0, 20)}..."` : 'undefined');
console.log('PEXELS_API_KEY trim:', PEXELS_API_KEY ? `"${PEXELS_API_KEY.substring(0, 20)}..."` : 'undefined');
console.log('Longueur:', PEXELS_API_KEY.length);
console.log('Commence par espace?', process.env.PEXELS_API_KEY?.startsWith(' '));
console.log('Contient \\n?', process.env.PEXELS_API_KEY?.includes('\n'));
console.log('Contient \\r?', process.env.PEXELS_API_KEY?.includes('\r'));
console.log('=======================');
console.log('');

const outputDir = './output';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const timestamp = Date.now();
const finalVideo = `${outputDir}/video_${timestamp}_final.mp4`;

// Si pas de clé Pexels, on crée quand même une vidéo
if (!PEXELS_API_KEY) {
  console.log('⚠️ PEXELS_API_KEY vide après trim');
  console.log('⚠️ Création vidéo placeholder...');
  
  const hook = "Gagne 100k/mois!";
  const cmd = `ffmpeg -f lavfi -i color=c=0xFF6B35:size=1080x1920:rate=30 -t 10 -vf "drawtext=text='${hook}':fontsize=80:fontcolor=white:borderw=6:bordercolor=black:x=(w-text_w)/2:y=300,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=50:fontcolor=#25D366:borderw=4:bordercolor=black:x=(w-text_w)/2:y=1400" -pix_fmt yuv420p -y "${finalVideo}"`;
  
  execSync(cmd, { stdio: 'inherit' });
  
  if (fs.existsSync(finalVideo)) {
    console.log(`✅ Vidéo placeholder créée`);
  }
  process.exit(0);
}

// Si clé présente, essayer Pexels
console.log('✅ Clé Pexels détectée, tentative API...');

const options = {
  hostname: 'api.pexels.com',
  path: '/videos/search?query=business&orientation=portrait&per_page=1',
  method: 'GET',
  headers: {
    'Authorization': PEXELS_API_KEY
  },
  timeout: 10000
};

const req = https.request(options, (res) => {
  console.log('Status API:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ API Pexels accessible!');
      try {
        const json = JSON.parse(data);
        console.log('Vidéos trouvées:', json.videos?.length || 0);
      } catch(e) {
        console.log('Réponse:', data.substring(0, 200));
      }
    } else {
      console.log('❌ Erreur API:', res.statusCode);
      console.log('Réponse:', data.substring(0, 500));
    }
    
    // Créer vidéo quand même
    const hook = "Gagne 100k/mois!";
    const cmd = `ffmpeg -f lavfi -i color=c=0xFF6B35:size=1080x1920:rate=30 -t 10 -vf "drawtext=text='${hook}':fontsize=80:fontcolor=white:borderw=6:bordercolor=black:x=(w-text_w)/2:y=300,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=50:fontcolor=#25D366:borderw=4:bordercolor=black:x=(w-text_w)/2:y=1400" -pix_fmt yuv420p -y "${finalVideo}"`;
    
    execSync(cmd, { stdio: 'inherit' });
    console.log(fs.existsSync(finalVideo) ? '✅ Vidéo créée' : '❌ Échec');
  });
});

req.on('error', (e) => {
  console.log('❌ Erreur requête:', e.message);
  process.exit(1);
});

req.end();
