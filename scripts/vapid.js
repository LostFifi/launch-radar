// Erzeugt ein VAPID-Schlüsselpaar für Web Push (einmalig).
//   node scripts/vapid.js
// Öffentlicher Schlüssel → src/config.json ("vapidPublic") UND Worker-Secret VAPID_PUBLIC
// Privater Schlüssel     → NUR als Worker-Secret VAPID_PRIVATE_JWK (nie ins Repo!)
const { generateKeyPairSync } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
console.log('Öffentlich (VAPID_PUBLIC, auch in src/config.json):\n' + pub);
console.log('\nPrivat (VAPID_PRIVATE_JWK – geheim halten, nur in: npx wrangler secret put VAPID_PRIVATE_JWK):\n' + JSON.stringify(jwk));
