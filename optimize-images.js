/* Comprime las imágenes pesadas a WebP para que la página cargue rápido.
   Uso: node optimize-images.js   (no se commitea, es solo build/local) */
const sharp = require('sharp');
const fs = require('fs');

const targets = [
  { in: 'foto1.png',  max: 1400 },
  { in: 'foto2.png',  max: 1400 },
  { in: 'foto3.png',  max: 1400 },
  { in: 'foto4.png',  max: 1400 },
  { in: 'foto5.png',  max: 1400 },
  { in: 'foto6.png',  max: 1400 },
  { in: 'foto7.png',  max: 1400 },
  { in: 'foto8.png',  max: 1400 },
  { in: 'foto9.png',  max: 1400 },
  { in: 'foto10.png', max: 1400 },
  { in: 'lata-cachupin.png', max: 1000 },
];

(async () => {
  for (const t of targets) {
    if (!fs.existsSync(t.in)) { console.log('skip (no existe):', t.in); continue; }
    const out = t.in.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    await sharp(t.in)
      .resize({ width: t.max, height: t.max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(out);
    const a = fs.statSync(t.in).size, b = fs.statSync(out).size;
    console.log(`${t.in} ${(a/1e6).toFixed(2)}MB -> ${out} ${(b/1e6).toFixed(2)}MB  (-${Math.round((1-b/a)*100)}%)`);
  }
})();
