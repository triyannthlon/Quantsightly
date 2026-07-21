# `4q-energy-trend-rc1` → `energy-trend-v1` — recommandation d'intégration

## STATUT : **PASS AVEC RÉSERVES** (validé Yann, 2026-07-21)

Candidat validé sur toute la chaîne : **quantitatif** (Dyn+Bin, plateau L4-7) → **concordance
moteur** (28/0 candidat, 22/0 production) → **risque extrême** (queue AMÉLIORÉE, pas dégradée) →
**bootstrap** (IC>0). Branché au moteur derrière `QS_ENERGY_OVERLAY=off|trend-v1` (défaut off),
commit `8112502`, branche `4q-energy-trend-v1`.

**Contrôles franchis** : CAGR réel net supérieur · Sharpe & Sortino améliorés · downside deviation
plus faible · ES 95 % & 99 % améliorés · pire mois amélioré · drawdown non dégradé · cohérent
Dynamique & Binaire · positif après coûts · **protection effective pendant les krachs énergétiques**
(COVID 2020 : 0 mois détenu ; oil 2014-16 : 2 mois ; SPDYENT 5 % pires : actif 17 %). Cf.
`tail-risk-report.md`.

**Réserves restantes** (durabilité hors-échantillon, PAS le risque extrême) : gain de RENDEMENT
concentré sur 2021-2022 (hors-21/22 ΔCAGR ≈ +0,06 modeste) ; rotation +16-18 pt/an ; validation
**in-sample**. À traiter par **gel des paramètres + suivi parallèle**, jamais par ré-optimisation.

**⚠️ Interdits maintenus** : activation par défaut · UI · texte méthodo public · tag final · nouveau
réglage · changement du modèle public. `4q-standard-v2` reste public + rollback. rc1 FIGÉ (L=6, w=10 %,
prorata, SMA6, bande unique).

## 1. Évidence (validée, figée)

| Comparaison déterminante (Δ = +Énergie − sans) | ΔSharpe Max | % pays | pire-décile | hors 21-22 | vol | coûts |
|---|---|---|---|---|---|---|
| **Dynamique** (rc1 vs v2) | **+0,128** | 100 % | +0,064 | +0,063 | ↓ −0,29 | robuste |
| **Binaire** (+Én. vs Bin.) | **+0,112** | 100 % | +0,052 | +0,057 | ↓ −0,41 | robuste |

Les deux variantes : 100 % pays améliorés, pire-décile positif, **positif hors 2021-2022**, vol en baisse,
robuste aux coûts (0-50 bps) et aux horizons (Max/20A/10A/5A), DK sans effet. Concordance rc1 ↔ moteur
`backtestQuadrants` = **28/0** (w=0 = v2 bit à bit). Comparaison à Browne : rc1 devant, v2 ≈ Browne.

**Réserves maintenues** : gain hors-2021-2022 **modeste** (Dyn +0,063 / Bin +0,057 vs ~+0,11 total) ;
**rotation +16-18 pt/an** (nette de coûts) ; validation **in-sample** (L=6 découvert puis confirmé sur
le même historique).

## 2. Recommandation

- **La surcouche Énergie de tendance est un gain robuste sur les DEUX variantes** → candidate comme
  **composante COMMUNE Dynamique + Binaire** (règle de décision de Yann remplie).
- **Périmètre proposé : Dynamique + Binaire**, sous flag/sélecteur interne, **défaut OFF** (public = v2).
- Décision d'intégration = **humaine**, sur ce dossier. Pas d'auto-intégration.

## 3. Plan de branchement au moteur de production (à implémenter APRÈS accord)

**Bonne nouvelle : le scaffolding dormant existe déjà** (`four-quadrants/energy-overlay.ts`,
`settings.energyMode`, `resolveEnergyWeight`, `applyEnergyOverlay` prorata). Le branchement réutilise
ce socle — l'overlay prorata à 5 poches + la bande sur 5 poches sont DÉJÀ dans le moteur (prouvé par la
concordance). Étapes minimales, non destructives :

1. **Signal (service serveur)** — `four-quadrants-service.ts` : charger le global `SPDYENT Index-XX-5-2`
   (USD), calculer `active_t = SPDYENT_t > SMA6` (module `signal.ts` porté en pur, causal), injecter
   `energyScore ∈ {0, 100}` (100 si actif) dans `buildModel`. Charger + convertir SPDYENT en devise
   locale (même `convertCurrency` que l'or) pour la perf de la poche (`energyTotalReturn`).
2. **Résolution du poids** — `settings.energyMode = "automatic"`, `energyMaxWeight = 0.10` : le moteur
   existant produit alors la cible 5 poches prorata `[(1-e)A,…, e]` avec `e = 10 %` quand actif. La bande
   v2 sur 5 poches est déjà appliquée par `backtestQuadrants`. **Aucune formule nouvelle.**
3. **Flag/variante** — nouvelle constante de build (miroir de `model-version.ts`), ex.
   `ENERGY_TREND_ENABLED` (env `NEXT_PUBLIC_QS_ENERGY_TREND`), **défaut OFF**. OFF ⇒ `energyMode="disabled"`
   ⇒ **exactement v2** (public/rollback intacts). ON ⇒ overlay actif sur Dynamique ET Binaire.
4. **Surfaces** — le flag traverse service + recalcul client (comme v1/v2). Aucune page produit modifiée
   tant que le flag est OFF ; l'UI Énergie (composition 6ᵉ poche, méthodo) = chantier séparé ultérieur.

## 4. Concordance de PRODUCTION (bloquante avant tout déploiement)

Après branchement, prouver dans un harnais dédié :

1. **Flag OFF = `4q-standard-v2` bit à bit** (aucune régression : golden v1/v2 inchangés).
2. **Flag ON reproduit les GOLDEN rc1** (`golden.json`, US/FR/JP/BR : horizons, épisodes, rotation,
   coûts, série mensuelle poids détenus/cibles) — Dynamique ET Binaire.
3. Réutiliser la passe de concordance existante (`concordance.mts`, 28/0) comme oracle : le moteur câblé
   doit égaler rc1 câblé qui égale déjà `backtestQuadrants`.
4. tsc + lint + `test:run` (212 tests) + build verts ; nouveau golden production + non-régression.

## 5. Déploiement (derrière sélecteur/drapeau interne)

- Défaut **v2** (Énergie OFF) partout. Recette en staging via `NEXT_PUBLIC_QS_ENERGY_TREND=on`
  (source unique client+serveur, bannière interne), comme la bascule v1→v2.
- **Jalon expérimental figé** : tag/branche `4q-energy-trend-rc1` (le commit du candidat), séparé du
  socle public. Rollback = flag OFF (aucun changement de code).
- **Aucune bascule par défaut** sans recette visuelle + décision explicite de Yann (comme v2).

## 6. Garde-fous (rappel)

- **Ne PAS** re-toucher L, w, financement, signal, bande. rc1 est figé.
- **Ne PAS** modifier Browne ni le quadrant national.
- **Ne PAS** basculer le défaut public ; v2 reste le socle et le rollback.
- La décision d'exposer une UI Énergie (6ᵉ poche, méthodo, badges) = chantier produit séparé, après
  intégration moteur validée.

## 7. Décisions à confirmer par Yann avant implémentation

1. **GO branchement** (Dynamique + Binaire, flag OFF par défaut) ?
2. Nom du flag/variante (`ENERGY_TREND_ENABLED` / `4q-standard-v3` ? — noter que ce n'est PAS une v3
   du socle mais une surcouche optionnelle ; nommage à trancher).
3. Réutiliser le scaffolding `energyMode="automatic"` (recommandé) ou créer un mode dédié `"trend"` plus
   explicite (plus de code, plus lisible) ?
4. Périmètre de la 1ʳᵉ étape : **moteur + concordance seuls** (pas d'UI), UI Énergie en étape 2 ?
