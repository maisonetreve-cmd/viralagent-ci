const { execSync } = require('child_process');
const fs = require('fs');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506508';

console.log('🚀 ViralAgent - Fond animé pro');

const outputDir = './output';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const timestamp = Date.now();
const finalVideo = `${outputDir}/video_${timestamp}_final.mp4`;

// HOOKS rotation pour plusieurs vidéos
const hooks = [
  "Gagne 100k/mois!",
  "3 erreurs a eviter",
  "La methode secrete",
  "Transforme ton tel",
  "Revenus passifs CI"
];
const hook = hooks[Math.floor(Math.random() * hooks.length)];

console.log('🎬 Création fond animé pro...');

// Commande FFmpeg avec effet PARTICULES + dégradé animé
const cmd = `ffmpeg -f lavfi -i "sine=frequency=1000:duration=10" -f lavfi -i "color=black:size=1080x1920" -f lavfi -i "life=sine=1/10,format=rgba,geq='r=255*gt(random(1)*sin(X/100+T*2),0.95):g=255*gt(random(1)*sin(Y/100+T*3),0.95):b=255:a=255*gt(random(1),0.98)'[particles];[1:v][particles]overlay=format=auto,format=yuv420p" -i "color=c=0xFF6B35@0.3:size=1080x1920" -filter_complex "[2:v]fade=t=out:st=8:d=2[anim];[3:v][anim]overlay=format=auto,drawtext=text='${hook}':fontsize=90:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=300:shadowx=3:shadowy=3:shadowcolor=black,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=55:fontcolor=#25D366:borderw=5:bordercolor=white:x=(w-text_w)/2:y=1500,drawtext=text='👉 LIEN EN BIO':fontsize=40:fontcolor=yellow:borderw=3:bordercolor=black:x=(w-text_w)/2:y=1650" -t 10 -c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p -y "${finalVideo}"`;

try {
  execSync(cmd, { stdio: 'pipe', timeout: 120000 });
  
  if (fs.existsSync(finalVideo)) {
    const size = fs.statSync(finalVideo).size;
    console.log(`✅ Vidéo créée: ${(size/1024).toFixed(2)} KB`);
    console.log(`📝 Hook: ${hook}`);
    
    // Notifier Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const https = require('https');
      const msg = `🎬 Vidéo animée OK!%0A📝 ${hook}%0A📊 ${(size/1024).toFixed(2)} KB`;
      https.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${msg}`);
    }
  } else {
    throw new Error('Fichier non créé');
  }
} catch (e) {
  console.error('❌ Erreur:', e.message);
  
  // Fallback ultra-simple si la commande complexe échoue
  console.log('🔄 Fallback simple...');
  const simpleCmd = `ffmpeg -f lavfi -i "gradient=s=1080x1920:r=30:d=10:start_color=FF6B35:end_color=8338EC" -vf "drawtext=text='${hook}':fontsize=80:fontcolor=white:borderw=6:bordercolor=black:x=(w-text_w)/2:y=400,drawtext=text='📱 ${WHATSAPP_DEFAULT}':fontsize=50:fontcolor=#25D366:borderw=4:bordercolor=black:x=(w-text_w)/2:y=1400" -pix_fmt yuv420p -y "${finalVideo}"`;
  
  execSync(simpleCmd, { stdio: 'pipe' });
  console.log('✅ Vidéo fallback créée');
}

console.log('✅ Terminé!');
