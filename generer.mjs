#!/usr/bin/env node
// Générateur de licences Lithocoon (version git/publique, hors Play Store).
//
// La licence est un jeton SIGNÉ hors-ligne (RSA-2048 / SHA256) : l'app la vérifie
// avec la clé PUBLIQUE embarquée, sans aucun serveur. Impossible à forger sans la
// clé privée (release-hub/secrets/lithocoon-licence-private.pem, JAMAIS commitée).
//
// Usage :
//   node generer.mjs --client "Marie Dupont" --email marie@ex.fr            # licence PAYANTE
//   node generer.mjs --client "Testeur" --email t@ex.fr --type gratuite     # licence GRATUITE
//   node generer.mjs --client "..." --email ... --expire 2027-12-31         # avec expiration (option)
//   node generer.mjs --verify LITHO1.xx...yyy                               # vérifie une licence
//
// Le champ `type` (payante/gratuite) est purement informatif/traçabilité : les deux
// débloquent la version complète. Chaque licence est nominative (client + email).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const SECRETS = path.join(os.homedir(), 'Work/Entreprise/Applications/release-hub/secrets');
const PRIV_DEFAULT = path.join(SECRETS, 'lithocoon-licence-private.pem');
const PUB_DEFAULT = path.join(SECRETS, 'lithocoon-licence-public.b64.txt');
// Registre PRIVÉ des licences émises (PII client → JAMAIS commité, reste dans secrets/).
const REGISTRE = path.join(SECRETS, 'lithocoon-licences.csv');
const PREFIX = 'LITHO1';

const csvEsc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function inscrireRegistre(payload, licence, montant) {
  const entete = 'date_emission,client,email,type,expire,montant,licence\n';
  if (!fs.existsSync(REGISTRE)) fs.writeFileSync(REGISTRE, entete);
  const ligne = [payload.d, payload.c, payload.m, payload.t, payload.exp || '', montant || '', licence]
    .map(csvEsc).join(',') + '\n';
  fs.appendFileSync(REGISTRE, ligne);
}

function listerRegistre() {
  if (!fs.existsSync(REGISTRE)) { console.log('Registre vide (aucune licence émise).'); return; }
  const lignes = fs.readFileSync(REGISTRE, 'utf8').trim().split('\n');
  const rows = lignes.slice(1); // sans l'en-tête
  console.log(`\n📒 Registre des licences (${rows.length}) — ${REGISTRE}\n`);
  console.log('  Date        Type      Client                 Email');
  console.log('  ' + '─'.repeat(70));
  for (const r of rows) {
    // parse CSV simple (gère les guillemets)
    const cols = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    const [d, c, m, t] = cols;
    console.log(`  ${(d || '').padEnd(11)} ${(t || '').padEnd(9)} ${(c || '').slice(0, 21).padEnd(22)} ${m || ''}`);
  }
  const payantes = rows.filter(r => r.includes(',payante,')).length;
  console.log(`\n  Total : ${rows.length}  ·  payantes : ${payantes}  ·  gratuites : ${rows.length - payantes}\n`);
}

function args(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { o[a.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
    else if (!o._) o._ = a;
  }
  return o;
}
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function generer(o) {
  const priv = fs.readFileSync(o.key || PRIV_DEFAULT, 'utf8');
  const client = o.client && o.client !== true ? String(o.client) : null;
  const email = o.email && o.email !== true ? String(o.email) : null;
  if (!client || !email) { console.error('❌ --client et --email requis'); process.exit(1); }
  const type = o.type === 'gratuite' ? 'gratuite' : 'payante';
  const payload = {
    p: 'lithocoon',
    c: client,
    m: email,
    t: type,
    d: new Date().toISOString().slice(0, 10),
  };
  if (o.expire && o.expire !== true) payload.exp = String(o.expire);
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign('sha256', payloadBuf, priv);
  const licence = `${PREFIX}.${b64url(payloadBuf)}.${b64url(sig)}`;
  const montant = o.montant && o.montant !== true ? String(o.montant) : (type === 'gratuite' ? '0' : '');
  inscrireRegistre(payload, licence, montant);
  console.log('\n✅ Licence Lithocoon générée (inscrite au registre)\n');
  console.log('  Client :', client);
  console.log('  Email  :', email);
  console.log('  Type   :', type + (payload.exp ? ` (expire le ${payload.exp})` : ' (à vie)'));
  console.log('  Montant:', montant || '(non précisé)');
  console.log('  Émise  :', payload.d);
  console.log('\n───────────────────────────────────────────────');
  console.log(licence);
  console.log('───────────────────────────────────────────────\n');
  console.log('À transmettre au client : il la colle dans « Réglages → Version complète → Entrer une licence ».\n');
  return licence;
}

function verifier(licence, o) {
  const pubB64 = (o.pub ? fs.readFileSync(o.pub, 'utf8') : fs.readFileSync(PUB_DEFAULT, 'utf8')).trim();
  const der = Buffer.from(pubB64, 'base64');
  const pub = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
  const parts = String(licence).trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) { console.error('❌ format invalide'); process.exit(1); }
  const payloadBuf = unb64url(parts[1]);
  const sig = unb64url(parts[2]);
  const ok = crypto.verify('sha256', payloadBuf, pub, sig);
  const payload = JSON.parse(payloadBuf.toString('utf8'));
  const expiree = payload.exp && payload.exp < new Date().toISOString().slice(0, 10);
  console.log(JSON.stringify(payload, null, 2));
  console.log(ok ? (expiree ? '⚠️  signature VALIDE mais licence EXPIRÉE' : '✅ signature VALIDE') : '❌ signature INVALIDE');
  process.exit(ok && !expiree ? 0 : 1);
}

const o = args(process.argv);
if (o.liste || o.registre) listerRegistre();
else if (o.verify) verifier(o.verify === true ? o._ : o.verify, o);
else generer(o);
