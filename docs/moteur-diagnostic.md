# Moteur de diagnostic

> **Document conceptuel verrouillé — Phase 0, Chantier 6 (2026-06-24).**
> Définit comment Quantsightly combine les briques précédentes (composition utilisateur + régime macro du Chantier 4 + matrice de rôle du Chantier 5) en un diagnostic structuré.

---

## Vue d'ensemble

Le moteur calcule **5 scores indépendants** sur `[0, 1]` (1 = bon), puis les combine en un **verdict synthétique** sur 4 niveaux.

| # | Score | Question répondue | Poids |
|---|---|---|---|
| 1 | Régime | *Le portefeuille est-il aligné avec le quadrant actuel ?* | 35 % |
| 2 | Protection | *Couvre-t-il aussi les 3 autres quadrants ?* | 30 % |
| 3 | Concentration | *Est-il diversifié sur les sous-catégories ?* | 15 % |
| 4 | Browne | *À quelle distance est-il du Portefeuille Permanent ?* | 10 % |
| 5 | Choc | *Résiste-t-il aux scénarios extrêmes archétypes ?* | 10 % |

---

## Score 1 — Régime (`s_régime`) — poids 35 %

*Cohérence avec le quadrant courant.*

```
diag_score = Σ_c  poids[c] × role[c][quadrant_courant]   ∈ [-1, +1]
s_régime   = (diag_score + 1) / 2                         ∈ [0, 1]
```

`role[c][q]` provient de la matrice du Chantier 5 (`role-actuel.md`).

| `s_régime` | Lecture |
|---|---|
| 1 | Toutes les poches sont Protectrices dans le quadrant courant |
| 0.5 | Composition neutre / robuste |
| 0 | Toutes les poches sont Fragiles |

C'est le **score central**, celui qui répond à la question fondatrice : *« mon portefeuille est-il construit pour le monde dans lequel je vis ? »*

---

## Score 2 — Protection (`s_protection`) — poids 30 %

*Résilience multi-régime (philosophie Browne).*

Pour chacun des 4 quadrants `q`, on calcule la part agrégée du portefeuille qui serait Protectrice (score de rôle ≥ +0.4) :

```
protection[q] = Σ_c  poids[c]   pour les c où role[c][q] ≥ +0.4
s_protection_brut = min over q  protection[q]              ∈ [0, ~0.5]
s_protection      = clamp(s_protection_brut / 0.25, 0, 1)  ∈ [0, 1]
```

Normalisation : on considère que **25 % d'exposition protectrice dans le pire quadrant** = couverture pleine (cohérent avec la logique Browne 25 % par actif gagnant). Au-delà, score saturé à 1.

| `s_protection` | Lecture |
|---|---|
| 1 | ≥ 25 % du portefeuille protège dans CHACUN des 4 quadrants |
| 0.5 | ~12.5 % de couverture dans le pire quadrant |
| 0 | Au moins un quadrant n'est pas couvert du tout |

---

## Score 3 — Concentration (`s_concentration`) — poids 15 %

*Diversification brute, indépendante du régime.*

Indice de Herfindahl-Hirschman sur les 7 sous-catégories :

```
HHI = Σ_c  poids[c]²              ∈ [1/7, 1]
s_concentration = (1 - HHI) × 7/6  ∈ [0, 1]
```

`1/7 ≈ 0.143` = parfaitement réparti (théorique), `1` = monoposte.

| `s_concentration` | Lecture |
|---|---|
| 1 | Réparti uniformément sur les 7 sous-catégories |
| 0.5 | Concentration modérée (typique d'un portefeuille équilibré 3-4 postes) |
| 0 | 100 % sur une seule sous-catégorie |

---

## Score 4 — Écart à Browne (`s_browne`) — poids 10 %

*Distance au Portefeuille Permanent (référence comparative, pas prescriptif).*

Cible Browne (classique) : 25 % OUT-broad + 25 % RAR-or + 25 % CON-long + 25 % CON-cash.

```
d_browne = (1/2) × Σ_c  | poids_actuel[c] - poids_browne[c] |   ∈ [0, 1]
s_browne = 1 - d_browne                                          ∈ [0, 1]
```

(Le facteur 1/2 normalise la distance L1 sur [0, 1].)

| `s_browne` | Lecture |
|---|---|
| 1 | Composition identique à Browne |
| 0.5 | À mi-chemin |
| 0 | Diamétralement opposé (ex. 100 % en RAR-crypto) |

Note : **score informationnel, pas prescriptif**. Un faible `s_browne` n'est pas mauvais en soi — c'est une distance, pas un défaut.

---

## Score 5 — Choc (`s_choc`) — poids 10 %

*Résistance à 3 scénarios extrêmes archétypes.*

### Définition des scénarios

Pertes (et gains) instantanés par sous-catégorie, en pourcentage. Valeurs basées sur les ordres de grandeur historiques.

| Sous-catégorie | Choc actions *(Ursus magnus, ex. 2008)* | Choc inflation *(bascule stagflation, ex. 1973, 2022)* | Choc déflation *(évaporation liquidité, ex. 2008 phase 1)* |
|---|---|---|---|
| OUT-broad | **-50 %** | -25 % | -35 % |
| OUT-value | -40 % | **+10 %** | -45 % |
| RAR-or | +5 % | **+30 %** | -5 % |
| RAR-mp | -40 % | **+25 %** | -50 % |
| RAR-crypto | -70 % | -50 % | **-75 %** |
| CON-long | **+20 %** | -40 % | **+25 %** |
| CON-cash | 0 % | -10 % | 0 % |

### Calcul du score

```
loss[scénario] = Σ_c  poids[c] × perte[c][scénario]         ∈ [-1, +1]
loss_pire      = max( |loss[s]| over the 3 scenarios )       ∈ [0, 1]
s_choc         = max(0, 1 - loss_pire / 0.5)                ∈ [0, 1]
```

Une perte de 50 % dans le pire scénario → `s_choc = 0`. Une perte de 25 % → `s_choc = 0.5`.

| `s_choc` | Lecture |
|---|---|
| 1 | Aucun scénario ne fait perdre plus de quelques pour cent |
| 0.5 | Pire scénario causerait ~25 % de perte |
| 0 | Pire scénario causerait ≥ 50 % de perte |

---

## Combinaison → score final

### Moyenne pondérée

```
score_brut = 0.35 × s_régime
           + 0.30 × s_protection
           + 0.15 × s_concentration
           + 0.10 × s_browne
           + 0.10 × s_choc
```

### Plancher catastrophique (philosophie Gave — maillon faible)

Si l'un des **3 scores critiques** (Régime, Protection, Choc) est en zone catastrophique (`< 0.2`), on capte le résultat à 0.35 (verdict 🔴 maximum, jamais 🟡 ni 🟢) :

```
si min(s_régime, s_protection, s_choc) < 0.2 :
    score_final = min(score_brut, 0.35)
sinon :
    score_final = score_brut
```

### Discrétisation — 4 verdicts

```
score_final ≥ 0.75 → 🟢 Solidement diversifié face au régime actuel
0.50 ≤ x < 0.75    → 🟡 Équilibré avec réserves
0.25 ≤ x < 0.50    → 🔴 Vulnérable au régime actuel
score_final < 0.25 → ⚫ Très vulnérable
```

La verbalisation complète des verdicts (phrases pédagogiques) sera figée au Chantier 7.

---

## Sortie structurée du moteur

Pour chaque diagnostic d'un portefeuille utilisateur :

```ts
type DiagnosticOutput = {
  verdict: "vert" | "jaune" | "rouge" | "noir";    // discrétisation
  score_final: number;                              // [0, 1]
  quadrant_courant: Quadrant;                       // boom_def | boom_inflation | stagflation | contraction_def

  scores: {
    regime:        { value: number; details: { diag_score: number } };
    protection:    { value: number; details: { weak_quadrant: Quadrant; protection_par_quadrant: Record<Quadrant, number> } };
    concentration: { value: number; details: { hhi: number; top_subcat: { code: string; poids: number } } };
    browne:        { value: number; details: { distance: number } };
    choc:          { value: number; details: { pire_scenario: "actions"|"inflation"|"deflation"; pire_perte: number; pertes: Record<Scenario, number> } };
  };

  composition: Array<{
    sous_categorie: SubCategorie;   // OUT-broad, OUT-value, RAR-or, RAR-mp, RAR-crypto, CON-long, CON-cash
    poids: number;
    role_courant: { score: number; label: "Fragile" | "Robuste" | "Protecteur" };
  }>;
}
```

Cette structure alimente :
- **Page 1 — Mon portefeuille** : `verdict`, `score_final`, `quadrant_courant`, top 3 lignes de `composition`.
- **Page 2 — Mon portefeuille (détail)** : tableau complet `composition` + détails par score.
- **Page 3 — Régime macro** : `quadrant_courant` + historique (cf. Chantier 4).
- **Page 4 — Comparaison vs Browne** : `scores.browne` + benchmark visuel.

---

## Préalables techniques (rappel hors Chantier 6)

- `src/lib/coredata-db.ts` à réécrire pour le nouveau schéma (cf. Chantier 4)
- Table `etf_classification` à créer pour le mapping ETF → sous-catégorie (cf. Chantier 5)
- Conversion yield → prix nu des bonds 10Y (formule par duration, cf. Chantier 4)
- Schéma Prisma `Position` à créer (cf. Sprint 1 dans memory)
