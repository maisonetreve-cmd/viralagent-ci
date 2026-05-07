const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_DEFAULT = process.env.WHATSAPP_DEFAULT || '2250508506508';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

// ============ DEBUG PEXELS ============
console.log('🔍 DEBUG PEXELS DÉMARRÉ');
console.log('=====================================');
console.log('1. Variable PEXELS_API_KEY récupérée:', PEXELS_API_KEY ? 'OUI' : 'NON');
console.log('2. Longueur de la clé:', PEXELS_API_KEY.length, 'caractères');
console.log('3. Début de la clé:', PEXELS_API_KEY.substring(0, 10) + '...');
console.log('4. Fin de la clé:', '...' + PEXELS_API_KEY.substring(PEXELS_API_KEY.length - 5));
console.log('5. Contient des espaces?', PEXELS_API_KEY.includes(' ') ? 'OUI ❌' : 'NON ✅');
console.log('6. Contient des sauts de ligne?', PEXELS_API_KEY.includes('\n') ? 'OUI ❌' : 'NON ✅');
console.log('=====================================\n');

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: data, parseError: e.message }); }
      });
    });
    req.on('error', (err) => {
      console.log('   ❌ Erreur requête HTTP:', err.message);
      reject(err);
    });
    req.setTimeout(30000, () => { 
      req.destroy(); 
      reject(new Error('Timeout 30s')); 
    });
    req.end();
  });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`   📥 Téléchargement...`);
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, { timeout: 60000 }, (res) => {
      console.log(`   📡 Status HTTP: ${res.statusCode}`);
      console.log(`   📡 Content-Type: ${res.headers['content-type']}`);
      console.log(`   📡 Content-Length: ${res.headers['content-length'] ? (res.headers['content-length']/1024/1024).toFixed(2) + ' MB' : 'inconnu'}`);
      
      if (res.statusCode === 302 || res.statusCode === 301) {
        console.log(`   🔄 Redirection vers: ${res.headers.location.substring(0, 60)}...`);
        downloadFile(res.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
      });
      
      res.on('end', () => {
        file.end();
        console.log(`   ✅ Téléchargé: ${(downloaded/1024/1024).toFixed(2)} MB`);
        
        // Vérifier fichier
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            console.log(`   ✅ Fichier sauvegardé: ${(stats.size/1024/1024).toFixed(2)} MB`);
            resolve(outputPath);
          } else {
            reject(new Error('Fichier non créé'));
          }
        }, 500);
      });
    }).on('error', (err) => {
      console.log('   ❌ Erreur download:', err.message);
      reject(err);
    });
  });
}

async function testPexels() {
  if (!PEXELS_API_KEY) {
    console.log('❌ CLÉ PEXELS MANQUANTE - Arrêt');
    return false;
  }
  
  const keywords = 'african business';
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&orientation=portrait&per_page=5`;
  
  console.log(`🔍 Appel API: ${url}`);
  console.log(`🔑 Header Authorization: Bearer ${PEXELS_API_KEY.substring(0, 10)}...`);
  
  try {
    const response = await fetchJSON(url, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    
    console.log(`\n📊 RÉPONSE API:`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status !== 200) {
      console.log(`   ❌ ERREUR API:`);
      console.log(`   ${JSON.stringify(response.data, null, 2).substring(0, 500)}`);
      return false;
    }
    
    if (!response.data || !response.data.videos) {
      console.log(`   ❌ Format réponse invalide`);
      console.log(`   Data reçue: ${JSON.stringify(response.data).substring(0, 200)}`);
      return false;
    }
    
    console.log(`   ✅ ${response.data.videos.length} vidéos trouvées`);
    
    if (response.data.videos.length === 0) {
      console.log(`   ⚠️ Aucune vidéo pour ce mot-clé`);
      return false;
    }
    
    // Prendre la première
    const video = response.data.videos[0];
    console.log(`\n🎬 VIDÉO SÉLECTIONNÉE:`);
    console.log(`   ID: ${video.id}`);
    console.log(`   Durée: ${video.duration}s`);
    console.log(`   URL page: ${video.url}`);
    
    // Chercher fichier vidéo
    const videoFile = video.video_files.find(f => f.quality === 'sd') || 
                      video.video_files.find(f => f.quality === 'hd') ||
                      video.video_files[0];
    
    if (!videoFile) {
      console.log(`   ❌ Aucun fichier vidéo trouvé dans l'objet`);
      return false;
    }
    
    console.log(`   Qualité: ${videoFile.quality}`);
    console.log(`   Type: ${videoFile.file_type}`);
    console.log(`   Lien: ${videoFile.link.substring(0, 80)}...`);
    
    // Télécharger
    const outputPath = 'output/test_pexels.mp4';
    await downloadFile(videoFile.link, outputPath);
    
    // Vérifier
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100000) {
      console.log(`\n✅✅✅ SUCCÈS! Vidéo Pexels téléchargée ✅✅✅`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.log(`\n❌ EXCEPTION: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 TEST PEXELS DEBUG\n');
  
  fs.mkdirSync('output', { recursive: true });
  
  const pexelsOk = await testPexels();
  
  if (pexelsOk) {
    console.log('\n🎉 Pexels fonctionne! Utilise ce code pour la vraie génération.');
  } else {
    console.log('\n⚠️ Pexels ne fonctionne pas. Vérifie:');
    console.log('   1. La clé dans GitHub Secrets est exacte (copier-coller sans espace)');
    console.log('   2. La clé commence par un chiffre ou une lettre (pas d\'espace avant)');
    console.log('   3. Va sur https://www.pexels.com/api/ pour régénérer la clé si besoin');
  }
}

main().catch(err => {
  console.error('💥 Erreur fatale:', err);
  process.exit(1);
});
