# Licences Lithocoon (version git / publique)

La version **github** (sideload, hors Play Store) débloque la version complète par une
**licence nominative signée hors-ligne** (RSA-2048 / SHA256). Aucun serveur : l'app vérifie
la signature avec la clé **publique** embarquée. Impossible à forger sans la clé **privée**.

## Générer une licence

La clé privée est dans `release-hub/secrets/lithocoon-licence-private.pem` (⚠️ JAMAIS commitée).

```bash
cd apps/../tools/licence   # dossier tools/licence du projet Lithocoon

# Licence PAYANTE (après paiement du client)
node generer.mjs --client "Marie Dupont" --email marie@exemple.fr

# Licence GRATUITE (cadeau / testeur)
node generer.mjs --client "Testeur JD" --email jd@exemple.fr --type gratuite

# Licence avec expiration (optionnel)
node generer.mjs --client "..." --email ... --expire 2027-12-31

# Vérifier une licence
node generer.mjs --verify LITHO1.xxxx.yyyy
```

Le script affiche un jeton `LITHO1.<payload>.<signature>` à transmettre au client.

## Côté client

Dans l'app (version github) : **Réglages → Version complète → « Vous avez une licence ? »**,
coller le jeton, **Activer la licence**. La version complète est débloquée immédiatement,
hors-ligne. Le nom du client s'affiche ensuite dans les Réglages.

## Notes

- Chaque licence est **nominative** (client + email inscrits dans le jeton, non modifiables).
- Les licences payantes et gratuites utilisent le **même mécanisme** ; seul le champ `type`
  diffère (traçabilité).
- La vérification est **hors-ligne** : une licence reste valide sans réseau. Une licence
  **expirée** ou **altérée** est automatiquement révoquée au démarrage (`LicenceManager.rafraichir`).
- La version **Play Store** n'utilise PAS les licences : elle se débloque par **achat
  RevenueCat** (`lithocoon_full`, 7,90 €). C'est la seule différence de déblocage entre les
  deux versions Android (avec la source de vérification des mises à jour).
