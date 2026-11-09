# Feuille de route

Ordre de construction choisi selon les **dépendances** : chaque lot s'appuie sur les précédents.
Chaque lot est testé (tests automatisés + parcours au format téléphone) puis mis en ligne avant de passer au suivant.

| Lot | Contenu | Dépend de | État |
|---|---|---|---|
| 0 | Socle multi-entreprises, clients et sites | — | ✅ en ligne |
| A | Localisation fiable des sites · sous-comptes et autorisations · espace gestionnaire (validation des comptes) | 0 | ✅ |
| B | **Réglages de l'entreprise** : identité légale, assurance décennale, TVA (taux par produit, DOM), numérotation, mise en page des documents (logo, couleurs, dispositions), CGV, délais des opportunités | A | à faire |
| C | **Fournisseurs et catalogue** : produits / services / main-d'œuvre, prix d'achat, coefficient de marge, TVA par article, suivi en stock et n° de série, historique des prix ; import de grille fournisseur par photo/PDF (IA + écran de validation) | B | à faire |
| D | **Devis et factures** conformes : mentions obligatoires forcées, numérotation chronologique continue, acomptes, avoirs, signature du devis, mention TVA réduite, PDF à la charte du client, export Factur-X | B, C | à faire |
| E | **Achats et stock** : bons de commande générés en un clic depuis un devis (un par fournisseur), factures d'achat, mouvements de stock, numéros de série suivis de l'entrée au client, ventes par produit | C, D | à faire |
| F | **V1 terrain** : parc d'équipements + QR code, interventions (planning, rapport, photos, signature, PDF verrouillé), CERFA 15497*04, registre des fluides et alertes d'étanchéité | A, E (n° de série) | à faire |
| G | **Chantiers et rentabilité** : coûts réels (factures d'achat, main-d'œuvre, frais saisis à la main) contre le vendu, marge en temps réel | D, E, F | à faire |
| H | **Entretien et opportunités** : contrats d'entretien, visites planifiées, facturation récurrente ; opportunités automatiques (ex. installation facturée il y a 11 mois) avec message WhatsApp pré-rempli en 1–2 clics ; délai réglable ; relances e-mail (impayés, entretiens) | D, F | à faire |
| I | **Pilotage** : tableau de bord personnalisable (glisser les tuiles), devis émis / à valider / à facturer, CRM (pipeline des devis), trésorerie | D, E, G, H | à faire |
| J | **Pré-comptabilité et espace comptable** : journaux ventes/achats, rapprochement des règlements, export FEC et CSV, accès dédié pour le comptable (droit « Accéder à l'espace comptable ») | D, E | à faire |
| K | **Facturation électronique** via une plateforme agréée (obligation d'émission des TPE au 1er septembre 2027), lecture de plaque signalétique par photo, aide au diagnostic par code erreur | D, F | à faire |

> Le lot F (V1 terrain) est placé après les achats/stock pour que les numéros de série
> suivent le matériel depuis la commande jusqu'à l'équipement posé chez le client.
> S'il faut une démo terrain plus tôt pour les pilotes, il peut passer avant C.

## Règles légales à respecter (vérifiées en novembre 2026)

Sources : service-public.gouv.fr (fiche « Mentions obligatoires sur une facture », mise à jour le 11/08/2026),
impots.gouv.fr (taux de TVA dans les DOM), BOFiP / FFB (suppression des attestations de TVA), DGFiP (réforme).
**À faire valider par un expert-comptable avant la mise en vente.**

### Factures — mentions forcées par le logiciel
- Date d'émission, **numéro unique d'une séquence chronologique et continue** (aucun trou, aucun doublon, jamais modifiable après émission).
- Date de la vente / fin de la prestation (ou date de l'acompte).
- Vendeur : dénomination, forme juridique, capital, adresse du siège, SIREN (ou « EI » + nom pour un entrepreneur individuel), n° de TVA intracommunautaire.
- Client : nom ou dénomination, adresse de facturation ; n° de TVA du client professionnel.
- N° de bon de commande du client s'il en a émis un.
- Pour chaque ligne : désignation précise, quantité, prix unitaire HT, taux de TVA ; remises.
- Totaux HT, TVA par taux, TTC.
- Date d'échéance, conditions d'escompte (ou « Escompte pour paiement anticipé : néant »), taux des pénalités de retard.
- **Indemnité forfaitaire de 40 €** pour frais de recouvrement si le client est un professionnel.
- **Artisan du bâtiment : assurance professionnelle** (assureur, garant, couverture géographique) — décennale.
- Cas particuliers : « Auto-liquidation » (sous-traitance BTP), « TVA non applicable, art. 293 B du CGI » (franchise).
- **Réforme (TPE au 1er septembre 2027)** : SIREN du client professionnel, adresse de livraison si différente,
  nature de l'opération (biens / services / les deux), « Option pour le paiement de la taxe d'après les débits » le cas échéant.
- Une facture émise ne se modifie ni ne se supprime : on la corrige par un **avoir**.
- Sanction : 15 € par mention manquante (plafond : quart du montant de la facture) ; 50 € par facture électronique non conforme (plafond 15 000 €/an).

### Numérotation
- Une séquence chronologique et continue par série. Plusieurs séries sont admises (ex. factures / avoirs / acomptes)
  si elles sont chacune continues. Format réglable par le propriétaire (préfixe, année, nombre de chiffres)
  **avant la première facture** ; ensuite le format est verrouillé pour l'exercice en cours.
- Le numéro est attribué **au moment de l'émission** (pas à la création du brouillon) : impossible de créer un trou.

### Devis (travaux et dépannage)
- Identité complète de l'entreprise + assurance décennale, date, durée de validité, client et adresse du chantier,
  décompte détaillé (fournitures et main-d'œuvre, quantités, prix unitaires), frais de déplacement, TVA, totaux,
  date de début et durée estimée des travaux, conditions de paiement, mention « Devis reçu avant l'exécution des travaux »
  et signature du client (« Bon pour accord »).
- **Taux réduits 10 % / 5,5 %** (logements de plus de 2 ans) : l'attestation CERFA est supprimée depuis le 16/02/2025 ;
  elle est remplacée par une **mention signée par le client sur le devis ou la facture** (modèle publié au BOFiP le 22/10/2025).
  Le logiciel insère la mention et la ligne de signature dès qu'une ligne utilise ces taux.

### TVA : taux proposés par défaut (modifiables par le propriétaire)
| Zone | Normal | Réduit | Autres |
|---|---|---|---|
| Métropole | 20 % | 10 % (rénovation) · 5,5 % (amélioration énergétique) | 2,1 % |
| Guadeloupe, Martinique, La Réunion | 8,5 % | 2,1 % (opérations relevant de 5,5 % / 10 % en métropole) | 1,75 % · 1,05 % |
| Guyane, Mayotte | TVA non applicable (art. 294-1 CGI) | — | — |

## Choix techniques retenus pour la suite
- **WhatsApp** : liens « click-to-chat » (`wa.me`) avec message pré-rempli → gratuit, sans compte API, 1–2 clics. L'envoi automatique (API WhatsApp Business) reste possible plus tard (payant).
- **E-mails** (relances) : fournisseur transactionnel hébergé dans l'UE, offre gratuite au démarrage.
- **Fichiers** (logos, photos, PDF) : stockage objet dans l'UE.
- **IA** (grilles fournisseurs, plaques signalétiques) : toujours un écran de validation avant enregistrement.
