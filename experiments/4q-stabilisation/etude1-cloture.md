# Étude 1 — Stabilisation 4Q : clôture & décision

> **Statut : CLÔTURÉE — non intégrée.** Le socle officiel reste **`4q-standard-v1`**
> (Standard v1, sans stabilisation). Aucune modification du moteur, de l'interface, du
> tag `4q-standard-v1`, de l'Énergie ou de la comparaison Browne. L'étude reste
> archivée à titre de référence dans `experiments/4q-stabilisation/`.

## 1. Protocole

Voir [`docs/4q-stabilisation-protocole.md`](../../docs/4q-stabilisation-protocole.md) :
méthodes (Standard v1, bande minimale de réallocation `δ`, hystérésis `h`), paramètres,
référence, métriques, panel (22 pays × Max/20A/10A/5A × dynamique+binaire × T=0/20/50),
critères de rétention/rejet. Vitesse/accélération réservées à une éventuelle étude 2.

## 2. Résultats complets

Voir [`etude1-resultats.md`](./etude1-resultats.md) (reproductible :
[`study1.mts`](./study1.mts), `simulate(Standard)` vérifié identique au moteur figé).

Synthèse chiffrée (dynamique · T=20 · 20A, médianes inter-pays ; robuste Max/10A/5A) :

| Variante | Rotation (volume) | Nb réallocations | ΔCAGR réel | ΔSharpe / ΔMDD | Admissible* |
|---|---|---|---|---|---|
| band δ2 | −7 % | −28 % | −0,01 | ≈ 0 | non |
| **band δ3** | **−14 %** | **−45 %** | **≈ 0** | **≈ 0** | non (rotation) |
| band δ5 | −26 % | −65 % | +0,01 | ≈ 0 | non (rotation, à 4 pts) |
| hyst h5/10/20 | −0 à −5 % | ~0 % | ≈ 0 | ≈ 0 | non |

\* Critères : rotation −30 % · nb réalloc −30 % · CAGR ≥ −0,30 · Sharpe ≥ −0,05 · MDD ≤ +2.

**Constat central** : en dynamique, la rotation est **dominée par la correction de
dérive**, pas par les bascules de signal. La bande réduit donc surtout le **nombre** de
transactions (peu le **volume**) ; l'hystérésis, qui vise les bascules, est
**inopérante**. Dans tous les cas la performance réelle est **≈ inchangée** → une large
part du trading Standard est **économiquement du bruit**. **Aucune variante n'est
admissible** à l'horizon principal (le seuil bloquant est rotation‑volume −30 %,
plafonnée à −26 % à δ5).

## 3. Décision : non-intégration

**On conserve 4Q Standard v1 sans stabilisation.** Ni bande ni hystérésis ne sont
intégrées au produit. Raisons :

- Le gain est **opérationnel et limité** (moins de transactions), pas économique
  (performance réelle inchangée).
- Aucune variante ne franchit les critères stricts à l'horizon de décision.
- **La simplicité du modèle standard prime** actuellement sur cette amélioration
  opérationnelle limitée : un mécanisme de stabilisation ajouterait un paramètre et une
  couche d'exécution sans bénéfice démontré côté produit/utilisateur.

**Réexamen conditionnel** — une option « Plus stable » ne sera reconsidérée que si :
1. on **intègre des coûts de transaction** (qui donneraient une valeur économique à la
   baisse du nombre de trades) ; **ou**
2. la **fréquence des opérations devient un besoin utilisateur clairement identifié**.

## 4. Rejet de l'hystérésis (définitif pour cette version)

L'hystérésis est **définitivement écartée** :

- **Inopérante en dynamique** : la rotation étant portée par la dérive et non par les
  bascules de signal, filtrer les bascules ne réduit quasiment rien (rotation −0 à −5 %,
  nb réalloc ~0 %).
- **Nuisible en binaire** : elle y réduit la rotation (h20 −41 %) **au prix** d'une forte
  **dispersion** et de **dégradations extrêmes** — `IN` ΔMDD **+5,2 pts**, `DK` ΔCAGR
  **−1,8 pt**, 8/22 pays dégradés de > 0,3 pt à h20. Elle **transforme le comportement
  économique** du modèle (fige des paris concentrés), ce qui est contraire à l'esprit du
  4 Quadrants.

## 5. `band δ=3` — archivé comme piste future

Conservé **uniquement** comme **candidat expérimental documenté** (non intégré) :

- réduit le **nombre de réallocations d'environ 45 %** ;
- impact **négligeable** sur la performance (ΔCAGR réel ≈ 0, Sharpe/MDD inchangés) ;
- **mais seulement ~14 % de réduction du volume** échangé (rotation) ;
- simple à expliquer, robuste entre pays et périodes, monotone (zone stable δ=2–3).

Définition (pour reprise ultérieure) : à la clôture `t`, si la rotation-vers-cible
`½·Σ|cible − détenu(dérivé)| ≤ 3 %` → conserver les poids détenus ; sinon réallouer
intégralement. Poids appliqués à `t+1`.

**⚠️ Ne pas explorer `δ > 5`** : cela reviendrait à chercher artificiellement le seuil
d'admissibilité et modifierait progressivement le **comportement économique** du modèle.

## Suite

- **Pas d'étude 2 (vitesse/accélération)** pour l'instant : elle ajouterait de la
  complexité sans problème produit démontré à résoudre.
- Le socle officiel reste **`4q-standard-v1`**. Ni Énergie ni comparaison Browne.
