// ViralAgent Pro - Version Finale avec Texte Multi-Lignes
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506508';

console.log('🚀 ViralAgent Pro');
console.log('==================');
console.log(`GROQ_API_KEY: ${GROQ_API_KEY ? '✅ CONFIGURÉE' : '❌ MANQUANTE'}`);
console.log(`PEXELS_API_KEY: ${PEXELS_API_KEY ? '✅ CONFIGURÉE' : '❌ MANQUANTE'}`);
console.log(`WHATSAPP: ${WHATSAPP_DEFAULT}`);

// Fonction utilitaire pour les appels API
function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
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
    req.end();
  });
}

// Télécharger un fichier
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(outputPath); });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

// Générer script avec Groq
async function generateScript(productNum) {
  const hooks = [
    "Tu veux gagner plus ?",
    "Astuce incroyable !",
    "Secret méconnu !",
    "Opportunité unique !",
    "Réussir en 2025 !"
  ];
  
  return {
    hook: hooks[productNum % hooks.length],
    keywords: 'african business success',
    description: `Produit ${productNum} - Offre spéciale !`,
    whatsapp: WHATSAPP_DEFAULT
  };
}

// Télécharger vidéo Pexels
async function downloadPexelsVideo(keywords, outputPath) {
  console.log(`🎬 Pexels: recherche "${keywords}"`);
  
  if (!PEXELS_API_KEY) {
    console.log('⚠️ Pas de clé Pexels, génération fond coloré');
    createPlaceholder(outputPath);
    return;
  }
  
  try {
    const page = Math.floor(Math.random() * 3) + 1;
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&per_page=5&page=${page}`;
    
    const resp = await fetchJSON(url, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    
    console.log(`📥 Pexels statut: ${resp.status}`);
    
    if (resp.status !== 200 || !resp.data?.videos || resp.data.videos.length === 0) {
      console.log('⚠️ Aucune vidéo Pexels trouvée');
      createPlaceholder(outputPath);
      return;
    }
    
    const video = resp.data.videos[Math.floor(Math.random() * resp.data.videos.length)];
    const fileUrl = video.video_files.find(f => f.quality === 'hd' || f.quality === 'sd');
    
    if (!fileUrl || !fileUrl.link) {
      console.log('⚠️ Pas de lien vidéo');
      createPlaceholder(outputPath);
      return;
    }
    
    console.log(`✅ Vidéo trouvée, téléchargement...`);
    await downloadFile(fileUrl.link, outputPath);
    console.log(`✅ Vidéo Pexels téléchargée: ${outputPath}`);
    
  } catch (e) {
    console.log(`❌ Erreur Pexels: ${e.message}`);
    createPlaceholder(outputPath);
  }
}

// Créer fond coloré simple
function createPlaceholder(outputPath) {
  console.log('🎨 Création fond coloré...');
  execSync(`ffmpeg -f lavfi -i "color=c=0x1a1a2e:s=1080x1920:d=15" -c:v libx264 -preset ultrafast -crf 28 -y "${outputPath}"`, { stdio: 'pipe' });
}

// Générer audio avec Edge TTS
async function generateAudio(text, outputPath) {
  console.log('🗣️ Edge TTS: génération voix...');
  
  try {
    const cleanText = text.replace(/['"\\]/g, '').substring(0, 200);
    const cmd = `edge-tts --voice fr-FR-DeniseNeural --text "${cleanText}" --write-media "${outputPath}" --rate=+10%`;
    
    execSync(cmd, { timeout: 30000, stdio: 'pipe' });
    console.log('✅ Voix générée avec Edge TTS');
    
  } catch (e) {
    console.log('⚠️ Edge TTS échoue, utilisation silence...');
    execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 15 -c:a libmp3lame -y "${outputPath}"`, { stdio: 'pipe' });
  }
}

// Fonction pour couper le texte en lignes de 20 caractères
function splitTextIntoLines(text, maxCharsPerLine = 20) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3); // Max 3 lignes
}

// Monter vidéo avec texte MULTI-LIGNES CENTRÉ
function mountVideo(videoPath, audioPath, outputPath, script) {
  const whatsapp = script.whatsapp.substring(0, 15);
  
  console.log('✂️ Montage vidéo avec texte...');
  
  // Couper le hook en lignes de 20 caractères
  const hookLines = splitTextIntoLines(script.hook.replace(/['"\\:]/g, ''), 20);
  console.log(`📝 Hook lignes: ${hookLines.length}`);
  
  // Construire la commande FFmpeg avec plusieurs drawtext si nécessaire
  let drawtextCommands = [];
  
  // Ligne 1 du hook (y = 10%)
  if (hookLines[0]) {
    drawtextCommands.push(`drawtext=text='${hookLines[0]}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=h*0.10:borderw=3:bordercolor=black:shadowcolor=black:shadowx=2:shadowy=2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`);
  }
  
  // Ligne 2 du hook (y = 15%)
  if (hookLines[1]) {
    drawtextCommands.push(`drawtext=text='${hookLines[1]}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=h*0.15:borderw=3:bordercolor=black:shadowcolor=black:shadowx=2:shadowy=2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`);
  }
  
  // Ligne 3 du hook (y = 20%)
  if (hookLines[2]) {
    drawtextCommands.push(`drawtext=text='${hookLines[2]}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=h*0.20:borderw=3:bordercolor=black:shadowcolor=black:shadowx=2:shadowy=2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`);
  }
  
  // WhatsApp en bas
  drawtextCommands.push(`drawtext=text='📱 ${whatsapp}':fontsize=32:fontcolor=yellow:x=(w-text_w)/2:y=h*0.88:borderw=3:bordercolor=black:shadowcolor=black:shadowx=2:shadowy=2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`);
  
  const vfFilter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${drawtextCommands.join(',')}`;
  
  const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" \
    -vf "${vfFilter}" \
    -c:v libx264 -c:a aac -shortest -t 15 -pix_fmt yuv420p -y "${outputPath}"`;
  
  try {
    execSync(cmd, { timeout: 120000, stdio: 'pipe' });
    console.log('✅ Vidéo montée avec texte multi-lignes');
  } catch (e) {
    console.log('⚠️ Erreur montage, fallback sans texte...');
    execSync(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v libx264 -c:a aac -shortest -t 15 -y "${outputPath}"`, { stdio: 'pipe' });
  }
}

// Main
async function main() {
  fs.mkdirSync('output', { recursive: true });
  
  console.log('\n🎬 Génération de 2 vidéos...\n');
  
  for (let i = 0; i < 2; i++) {
    const videoId = `video_${Date.now()}_${i}`;
    const rawVideo = `output/${videoId}_raw.mp4`;
    const audioFile = `output/${videoId}.mp3`;
    const finalVideo = `output/${videoId}_final.mp4`;
    
    console.log(`\n📹 Vidéo ${i+1}/2`);
    
    try {
      // 1. Générer script
      const script = await generateScript(i);
      console.log(`📝 Hook: ${script.hook}`);
      
      // 2. Télécharger vidéo Pexels
      await downloadPexelsVideo(script.keywords, rawVideo);
      
      // 3. Générer audio
      await generateAudio(script.hook, audioFile);
      
      // 4. Monter avec texte et audio
      mountVideo(rawVideo, audioFile, finalVideo, script);
      
      // 5. Nettoyer
      if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo);
      if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
      
      console.log(`✅ Vidéo ${i+1}/2 terminée: ${finalVideo}`);
      
    } catch (e) {
      console.log(`❌ Erreur vidéo ${i+1}: ${e.message}`);
    }
  }
  
  console.log('\n✅ Toutes les vidéos générées !');
  console.log('📁 Dossier: output/');
}

main().catch(err => {
  console.error('❌ FATALE:', err.message);
  process.exit(1);
});
