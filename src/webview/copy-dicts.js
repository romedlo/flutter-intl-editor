import fs from 'fs';
import path from 'path';

const dicts = {
    'en': 'dictionary-en',
    'es': 'dictionary-es',
    'fr': 'dictionary-fr'
};

const outDir = path.resolve('public/dictionaries');
fs.mkdirSync(outDir, { recursive: true });

for (const [lang, pkg] of Object.entries(dicts)) {
    const pkgPath = path.resolve('node_modules', pkg);
    fs.copyFileSync(path.join(pkgPath, 'index.aff'), path.join(outDir, `${lang}.aff`));
    fs.copyFileSync(path.join(pkgPath, 'index.dic'), path.join(outDir, `${lang}.dic`));
}
console.log('Dictionaries copied to public/dictionaries');
