const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Démarrage...');

// Créer dossier
const outputDir = './output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('✅ Dossier output créé');
}

const timestamp = Date.now();
const finalVideo = `${outputDir}/video_${timestamp}_final.mp4`;

console.log('🎬 Génération vidéo...');

// Commande simple qui marche sur GitHub Actions
const cmd = `ffmpeg -f lavfi -i color=c=blue:size=1080x1920:rate=30 -f lavfi -i anullsrc=channel_layout=mono:sample_rate=44100 -t 5 -c:v libx264 -pix_fmt yuv420p -y "${finalVideo}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  
  if (fs.existsSync(finalVideo)) {
    const size = fs.statSync(finalVideo).size;
    console.log(`✅ Vidéo créée: ${finalVideo}`);
    console.log(`📊 Taille: ${(size/1024).toFixed(2)} KB`);
  } else {
    console.error('❌ Fichier non trouvé après création');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Erreur FFmpeg:', error.message);
  process.exit(1);
}

console.log('✅ Terminé avec succès!');
