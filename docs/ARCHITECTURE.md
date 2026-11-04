# Architecture — ClimTerrain (nom provisoire)

## 1. Choix techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Application | Next.js 16 (App Router, Server Actions), PWA | Une seule base de code, installable sur téléphone |
| Base | Postgres Neon, région **Francfort (aws-eu-central-1)** | Offre gratuite, données dans l'UE |
| Accès base | Drizzle ORM + migrations SQL versionnées | SQL lisible, pas de « magie » |
| Dév / tests | PGlite (vrai Postgres embarqué) | Zéro serveur, zéro coût, tests réalistes |
| Hébergement | Vercel, fonctions en région **fra1 / cdg1** | Offre gratuite, proche des données |
| Comptes | Fait maison : scrypt + sessions en base (cookie httpOnly) | Aucune donnée chez un tiers, aucun coût par utilisateur |

## 2. Multi-entreprises : isolation garantie par Postgres

Une seule base, une colonne `org_id` sur chaque table métier, et **Row Level Security** :

- Toutes les requêtes métier passent par `withTenant(orgId, fn)` qui, dans une transaction :
  1. pose `app.org_id` = l'entreprise de la session ;
  2. bascule sur le rôle `app_tenant` (non propriétaire des tables, donc soumis aux règles).
- Politique sur chaque table : `org_id = app_current_org()` en lecture **et** en écriture.
- Sans entreprise posée, la requête ne voit **aucune** ligne (sécurité par défaut).
- Les liens entre tables utilisent une clé composite `(org_id, id)` : impossible de rattacher
  un site (plus tard un équipement, une intervention…) à un objet d'une autre entreprise.

Pour un nouveau module : créer la table avec les colonnes communes, puis dans la migration
`SELECT enable_tenant_rls('ma_table');` (active RLS, la politique, les droits et le trigger).

## 3. Conventions « prêt pour le hors-ligne »

Chaque table métier possède :

| Colonne | Rôle |
|---|---|
| `id uuid` | Peut être généré sur le téléphone → créations hors-ligne sans collision |
| `created_at`, `updated_at` | Horodatage (trigger) |
| `row_version bigint` | Compteur global incrémenté à chaque modif → synchro « tout ce qui a changé depuis N » |
| `deleted_at` | Suppression douce → la suppression se propage aux téléphones |

Les créations sont **idempotentes** sur l'id : un enregistrement rejoué après une coupure ne crée pas de doublon.

### Niveaux de hors-ligne
1. **Fait (module 1)** : service worker (application et pages déjà consultées disponibles sans réseau),
   bandeau « hors ligne », enregistrements mis en attente et rejoués au retour du réseau (`useOffline`).
2. **À faire avant le module 3** : copie locale (IndexedDB) des données de la journée du technicien
   + file d'attente des saisies (rapports, photos, signatures) synchronisée au retour du réseau.
   Le schéma ci-dessus est déjà conçu pour ça.

## 4. Modèle de données V1

```
organizations ─┬─ memberships ── users ── sessions
               │
               ├─ clients ── sites ── equipments ──┬─ intervention_equipments
               │                         │          │
               │                         └─ leak_checks (échéances étanchéité)
               │
               ├─ interventions ──┬─ intervention_photos
               │                  ├─ signatures (horodatée, empreinte du PDF)
               │                  └─ documents (PDF rapport, CERFA 15497*04 — verrouillés)
               │
               └─ fluid_cylinders ── fluid_movements (registre : chargé / récupéré / transféré)
```

| Module | Tables | Points clés |
|---|---|---|
| 1 ✅ | `clients`, `sites` | particulier/pro, SIRET vérifié, accès, GPS |
| 2 | `equipments` | marque, modèle, n° série, fluide, charge (kg), mise en service, `qr_token` unique ; équivalent CO₂ calculé → fréquence des contrôles |
| 3 | `interventions`, `intervention_photos`, `signatures`, `documents` | statut planifiée → en cours → terminée → signée ; PDF figé + empreinte SHA-256 |
| 4 | (lecture de 2 et 3) + `documents` | CERFA généré depuis l'intervention, attestation de capacité de l'entreprise (`organizations.fluid_capacity_certificate`) |
| 5 | `fluid_cylinders`, `fluid_movements`, `leak_checks` | quantités en grammes (entiers, pas d'arrondis), alertes d'échéance |

Les photos et PDF iront dans un stockage objet situé dans l'UE (à choisir au module 3).

## 5. RGPD dès la conception

- Hébergement UE (base Francfort, fonctions Paris/Francfort).
- Minimisation : pas de champ superflu ; avertissement sur les notes libres (pas de données de santé).
- Mots de passe hachés (scrypt), jetons de session jamais stockés en clair.
- Cache des pages sur le téléphone vidé à la déconnexion.
- Archivage plutôt que suppression immédiate ; **à faire** : anonymisation d'un client sur demande
  (en conservant ce que la loi impose de garder, ex. factures) et export de ses données.
- **À faire avant les premiers payants** : registre des traitements, politique de confidentialité,
  contrats de sous-traitance (DPA) avec Neon et Vercel, limitation des tentatives de connexion.

## 6. IA

Règle absolue : l'IA **propose**, l'utilisateur **valide**. Toute extraction (grille fournisseur,
plaque signalétique) passe par un écran de validation avant écriture en base.
