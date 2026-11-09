# ClimTerrain (nom provisoire)

Logiciel de gestion pour climaticiens (TPE), pensé pour le téléphone et le terrain.
Architecture et choix : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Démarrer en local (aucun compte requis)

```bash
npm install
npm run dev        # http://localhost:3000 — base PGlite locale créée automatiquement (.pglite/)
npm test           # tests : comptes, clients/sites, isolation entre entreprises
```

## Brancher Neon et Vercel

Projet Neon de production : `gestionbtp` (id `icy-butterfly-48639426`), région Francfort, base `gestionbtp`. Migrations 0000 à 0002 appliquées.

1. Créer un projet Neon en région **AWS Europe Central 1 (Francfort)**.
2. Copier `.env.example` en `.env` et y mettre la chaîne de connexion Neon.
3. `npm run db:migrate`
4. Sur Vercel : variable `DATABASE_URL`, région des fonctions `fra1` ou `cdg1`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Développement |
| `npm test` | Tests automatisés |
| `npm run typecheck` | Vérification des types |
| `npm run db:generate` | Générer une migration après modification de `src/db/schema.ts` |
| `npm run db:migrate` | Appliquer les migrations sur Neon |

## Organisation

```
src/db/          schéma, migrations, accès base (withTenant)
src/server/      logique métier, testable sans Next.js
src/lib/         validation (zod), texte, session
src/app/         écrans (public : connexion/inscription ; app : clients, sites)
src/components/  composants d'interface
tests/           tests automatisés
```

## État

- [x] Socle : inscription d'une entreprise, connexion, sessions, isolation par entreprise
- [x] Module 1 : clients et sites d'intervention
- [x] Lot A : localisation fiable des sites, sous-comptes et autorisations, espace gestionnaire (`/admin`)
- [ ] Suite : voir [docs/ROADMAP.md](docs/ROADMAP.md)
