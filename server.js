const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506500';

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const parsed = new URL(url);
    const req = lib.request({
      hostname: parsed.hostname,
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

async function main() {
  console.log('🚀 Démarrage génération vidéo...');
  
  // Créer dossier
  if (!fs.existsSync('output')) {
    fs.mkdirSync('output', { recursive: true });
    console.log('✅ Dossier output créé');
  }
  
  const timestamp = Date.now();
  const rawVideo = `output/vid_${timestamp}_raw.mp4`;
  const audioFile = `output/vid_${timestamp}.mp3`;
  const finalVideo = `output/vid_${timestamp}_final.mp4`;
  
  try {
    // Étape 1: Vidéo brute
    console.log('🎬 Étape 1: Création vidéo brute...');
    const cmd1 = `ffmpeg -f lavfi -i "color=c=0xFF6B35:s=1080:1920:d=15" -pix_fmt yuv420p -y "${rawVideo}"`;
    execSync(cmd1, { stdio: 'inherit' });
    console.log('✅ Vidéo brute créée:', rawVideo);
    
    // Vérifier
    if (!fs.existsSync(rawVideo)) {
      throw new Error('Vidéo brute non créée!');
    }
    
    // Étape 2: Audio
    console.log('🎵 Étape 2: Génération audio...');
    try {
      execSync(`edge-tts --voice fr-FR-DeniseNeural --text "Découvre cette astuce. Contacte moi sur WhatsApp." --write-media "${audioFile}" --rate=+10%`, { timeout: 30000 });
      console.log('✅ Audio créé:', audioFile);
    } catch(e) {
      console.log('⚠️ Edge TTS échoue, création silence...');
      execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -c:a aac -y "${audioFile}"`);
    }
    
    if (!fs.existsSync(audioFile)) {
      throw new Error('Audio non créé!');
    }
    
    // Étape 3: Montage
    console.log('✂️ Étape 3: Montage final...');
    const hook = "Gagne 100k/mois avec cette methode!";
    const whatsapp = WHATSAPP_DEFAULT;
    
    const cmd3 = `ffmpeg -i "${rawVideo}" -i "${audioFile}" -vf "scale=1080:1920,format=yuv420p,drawtext=text='${hook}':fontsize=60:fontcolor=white:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h/3,drawtext=text='📱 ${whatsapp}':fontsize=40:fontcolor=#25D366:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.7" -c:v libx264 -preset fast -crf 28 -c:a aac -shortest -y "${finalVideo}"`;
    
    execSync(cmd3, { stdio: 'inherit' });
    console.log('✅ Montage terminé:', finalVideo);
    
    // Vérifier final
    if (!fs.existsSync(finalVideo)) {
      throw new Error('Vidéo finale non créée!');
    }
    
    const stats = fs.statSync(finalVideo);
    console.log(`📊 Taille vidéo: ${(stats.size/1024/1024).toFixed(2)} MB`);
    
    // Envoi Telegram
    await sendTelegramMessage(`🎬 Vidéo générée!\n📁 ${finalVideo}\n📊 ${(stats.size/1024/1024).toFixed(2)} MB\n\n⬇️ Télécharge depuis les artifacts GitHub`);
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    await sendTelegramMessage(`❌ Erreur génération: ${error.message}`);
    process.exit(1);
  }
  
  console.log('✅ Terminé avec succès!');
}

main();
