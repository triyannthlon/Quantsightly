# `4q-energy-trend-rc1` — candidat expérimental (suivi de tendance Énergie)

**Statut : CANDIDAT EXPÉRIMENTAL. Non intégré. Production INTACTE.**
Aucun fichier de `src/`, aucune page produit, aucun défaut, aucun tag officiel n'est touché.
Tout vit dans ce dossier. Le socle de production reste `4q-standard-v2`.

## Origine

Clôture de l'étude Énergie v2 (`../4q-energie-v2/etude-energie-v2-synthese.md`) : les signaux macro
de régime mondial sont rejetés, mais un **filtre de tendance rapide sur SPDYENT** montre un plateau
robuste sur L=4-7 (survit au retrait de 2021-2022 et 2007-2008, leave-one-episode-out, 100 % pays,
robuste 50 bps). Par la règle de décision de Yann, un plateau robuste ⇒ préparer un candidat séparé
avec concordance complète **avant toute décision d'intégration**. C'est ce dossier.

## Spécification FIGÉE (cellule canonique)

| Élément | Valeur |
|---|---|
| Signal (mondial, niveau USD) | `energyActive_t = SPDYENT_t > SMA_L(SPDYENT)_t` |
| Lookback `L` | **6 mois** (SMA incluant t, obs ≤ t, décision appliquée à t+1) |
| Poids Énergie `w` | **10 %** |
| Financement | **prorata** des 4 poches nationales : `[(1-w)A, (1-w)O, (1-w)G, (1-w)C, w]` |
| Inactif | cible = `4q-standard-v2` exacte, 5ᵉ poche = 0 |
| Bande | **UNE seule** bande v2 (δ=5) sur la cible à 5 poches |
| Actif investi | `SPDYENT Index-XX-5-2` (S&P GSCI Energy Dynamic Roll TR), converti en devise locale (même méthode que l'or) |
| Décalage | `t → t+1` (poids figés à la clôture t, appliqués aux rendements t+1) |
| Coûts | intégrés au compounding, sur la rotation **exécutée** uniquement |

`w = 15 %` = **variante de sensibilité documentée seulement** (résultats supérieurs mais exposition
moins prudente) — **jamais** la cellule principale. `SPDYENT` n'entre JAMAIS dans le signal du quadrant
national ; il n'est **que** l'actif investi et le support du filtre de tendance.

## Fichiers

- `signal.ts` — signal de tendance SMA6 (pur, causal, gestion d'indisponibilité sans interpolation).
- `portfolio.ts` — cible 5 poches prorata (pur, somme = 1).
- `rc1.ts` — candidat : boucle de bande + net de coûts + séries poids détenus/cibles + épisodes (pur).
- `concordance.mts` — harnais : 10 points de concordance + tests de frontière + golden + rapport.
- `golden.json` — fixtures figées (US/FR/JP/BR : horizons, épisodes, rotation, coûts, série mensuelle).
- `concordance-report.md` — rapport de concordance (généré).
- `comparison-protocol.md` — protocole de comparaison v2 / rc1 / Browne **(spec, NON lancé)**.

## Lancer la concordance

```
pnpm exec tsx experiments/4q-energy-trend-rc1/concordance.mts
```

Dernier résultat : **28 ✅ / 0 ❌** — concordance complète contre le moteur `backtestQuadrants`
(référence indépendante), w=0 = v2 bit à bit (~1e-16), déterministe.

## Performance (médiane 21 pays, réel net 25 bps)

| variante | ΔSharpe Max | ΔCAGR Max | ΔSharpe pré-2021 | ΔSharpe post-lancement |
|---|---|---|---|---|
| **rc1 (L6/w10)** | +0,128 | +0,84 | +0,070 | +0,108 |
| contrôle (L6/w15) | +0,163 | +1,23 | +0,085 | +0,136 |
| Énergie toujours 10 % (sans filtre) | +0,033 | +0,13 | **−0,073** | +0,002 |

La valeur PROPRE du filtre = `rc1 − toujours-investi` : le filtre récupère la traîne de l'actif brut
(l'Énergie toujours détenue DÉGRADE le pré-2021 ; le filtre la rend positive).

## ⚠️ Réserves (pour la décision d'intégration ULTÉRIEURE)

1. **2021-2022 reste le principal épisode** (≈ 53 % du gain à L=6). Le résultat **hors 2021-2022
   demeure positif** (sans-21/22 > 0 sur tout L=4-7), mais l'épisode pèse lourd.
2. **La rotation augmente** (≈ +17 pt/an vs v2), déjà nette de coûts — à surveiller en exécution réelle.
3. **Le signal RAPIDE (L≤7) est indispensable** ; les filtres lents (L≥8-9) échouent.
4. **La validation utilise le même historique qui a servi à découvrir l'hypothèse** (L=6 identifié au
   bord de grille puis confirmé sur L=4-8). Pas d'out-of-sample temporel réellement neuf → prudence.

**La concordance NE vaut PAS décision d'intégration.** Prochaine étape = comparaison normalisée
`v2 / rc1 / Browne` (cf. `comparison-protocol.md`), à lancer UNIQUEMENT après validation par Yann du
candidat ET du protocole. Aucune page, aucun défaut, aucun tag ne bouge d'ici là.
