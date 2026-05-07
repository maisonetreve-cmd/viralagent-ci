// ViralAgent Pro - Version corrigée
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
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
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const encoded = encodeURIComponent(text);
  await fetchJSON(`${url}?chat_id=${TELEGRAM_CHAT_ID}&text=${encoded}&parse_mode=HTML`);
}

async function uploadToCloud(filePath) {
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

function mountVideo(videoPath, audioPath, script, outputPath) {
  let hook = (script.hook || 'Decouvre!').replace(/['"\\]/g, '').substring(0, 30);
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
    console.log('⚠️ Erreur montage:', e.message);
    execSync(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c copy -y "${outputPath}"`, { stdio: 'pipe' });
  } finally { 
    try { fs.unlinkSync(hookFile); fs.unlinkSync(ctaFile); } catch(e) {} 
  }
  return outputPath;
}

async function main() {
  console.log('🚀 ViralAgent Pro');
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Configuration Telegram manquante');
    return;
  }
  
  fs.mkdirSync('output', { recursive: true });
  
  await sendTelegramMessage('🎬 Test de publication');
  console.log('✅ Message Telegram envoye');
  
  // Ici tu ajouteras la logique de generation de videos
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
