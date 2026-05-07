// ViralAgent Pro - Version complète et fonctionnelle
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506500';

const LLM_KEY = GROQ_API_KEY;
const LLM_PROVIDER = GROQ_API_KEY.startsWith('gsk_') ? 'groq' : '';

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
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const encoded = encodeURIComponent(text);
  try {
    await fetchJSON(`${url}?chat_id=${TELEGRAM_CHAT_ID}&text=${encoded}&parse_mode=HTML`);
  } catch(e) { console.log('Telegram error:', e.message); }
}

async function uploadToCloud(filePath) {
  console.log('   Upload vers cloud...');
  const fileData = fs.readFileSync(filePath);
  const boundary = '----FormBoundary' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
    fileData,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'file.io',
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { const j = JSON.parse(data); resolve(j.link || null); } 
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function generateScript() {
  // Hook simple sans LLM pour test (tu peux remettre Groq après)
  return { 
    hook: 'Gagne 100k/mois avec cette methode!', 
    caption: 'Decouvre comment faire', 
    hashtags: '#CIV225 #Business' 
  };
}

function generateVoice(script, outputPath) {
  const text = `${script.hook}. Contacte-moi.`.replace(/['"\\]/g, '').substring(0, 200);
  try {
    execSync(`edge-tts --voice fr-FR-DeniseNeural --text "${text}" --write-media "${outputPath}" --rate=+10%`, { timeout: 30000, stdio: 'pipe' });
    console.log('✅ Voix generee');
  } catch (e) {
    console.log('⚠️ Edge TTS echoue, silence genere');
    execSync(`ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 10 -c:a aac -y "${outputPath}"`, { stdio: 'pipe' });
  }
}

function mountVideo(videoPath, audioPath, script, outputPath) {
  console.log('🎬 Montage video...');
  
  const hook = (script.hook || 'Decouvre!').replace(/['"\\]/g, '').substring(0, 35);
  const whatsapp = WHATSAPP_DEFAULT;
  
  const hookFile = `/tmp/hook_${Date.now()}.txt`;
  const ctaFile = `/tmp/cta_${Date.now()}.txt`;
  
  fs.writeFileSync(hookFile, hook);
  fs.writeFileSync(ctaFile, `CONTACTE-MOI\n📱 ${whatsapp}`);

  const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${hookFile}':fontsize=56:fontcolor=#FFD700:borderw=8:bordercolor=black:x=(w-text_w)/2:y=(h*0.25),drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${ctaFile}':fontsize=42:fontcolor=white:borderw=6:bordercolor=black:x=(w-text_w)/2:y=(h*0.80)" -c:v libx264 -preset veryfast -crf 24 -c:a aac -shortest -t 25 -pix_fmt yuv420p -y "${outputPath}"`;

  try { 
    execSync(cmd, { timeout: 120000, stdio: 'pipe' }); 
    console.log('✅ Video montee');
  } catch (e) {
    console.log('⚠️ Montage simplifie:', e.message);
    execSync(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c copy -y "${outputPath}"`, { stdio: 'pipe' });
  } finally { 
    try { fs.unlinkSync(hookFile); fs.unlinkSync(ctaFile); } catch(e) {} 
  }
  return outputPath;
}

async function main() {
  console.log('🚀 ViralAgent Pro - Generation de video');
  
  fs.mkdirSync('output', { recursive: true });
  
  // 1. Script
  console.log('📝 Generation script...');
  const script = await generateScript();
  
  // 2. Video brute (placeholder Pexels ou couleur)
  console.log('🎬 Creation video brute...');
  const rawVideo = `output/vid_${Date.now()}_raw.mp4`;
  execSync(`ffmpeg -f lavfi -i "color=c=0xFF6B35:s=1080:1920:d=20" -c:v libx264 -pix_fmt yuv420p -y "${rawVideo}"`, { stdio: 'pipe' });
  
  // 3. Voix
  console.log('🗣️ Generation voix...');
  const audioFile = `output/vid_${Date.now()}.mp3`;
  generateVoice(script, audioFile);
  
  // 4. Montage final
  console.log('✂️ Montage final...');
  const finalVideo = `output/vid_${Date.now()}_final.mp4`;
  mountVideo(rawVideo, audioFile, script, finalVideo);
  
  // 5. Upload et envoi Telegram
  console.log('☁️ Upload et envoi Telegram...');
  const link = await uploadToCloud(finalVideo);
  
  if (link) {
    const message = `🎬 <b>Video prete!</b>\n\n📝 ${script.hook}\n\n⬇️ <a href="${link}">TELECHARGER</a>\n\n📱 ${WHATSAPP_DEFAULT}`;
    await sendTelegramMessage(message);
    console.log('✅ Lien envoye sur Telegram');
  } else {
    console.log('❌ Echec upload');
  }
  
  // 6. Nettoyage
  try { fs.unlinkSync(rawVideo); } catch(e) {}
  try { fs.unlinkSync(audioFile); } catch(e) {}
  
  console.log('✅ Termine! Video dans:', finalVideo);
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
