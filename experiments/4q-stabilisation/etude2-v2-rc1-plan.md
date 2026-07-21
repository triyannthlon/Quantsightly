# 4q-standard-v2-rc1 — jalon candidat & plan de migration (INTERNE)

> **Document interne.** La méthodologie (formule de bande, seuil δ=5) NE DOIT PAS être
> exposée publiquement. Voir §5.

## 1. Ce qui est validé (branche `4q-standard-v2-band5`)

- **Étude** reproduite et robuste (cf. `etude2-synthese.md`) : bande δ=5 = amélioration
  d'efficience/coûts, plateau δ=4-5, validée hors-échantillon (sous-périodes, LOCO), robuste
  en binaire et T∈{0,50}.
- **Moteur** : deux versions méthodologiques explicites (`model-version.ts`). v1 = comportement
  historique ; v2 = bande δ=5 à l'exécution. **Coûts hors moteur.**
- **Tests** : `band.test.ts` (10, mécanique) + `standard-v2.test.ts` + `golden-v2.json`
  (golden DISTINCT de v1) ; v1 `standard-v1.test.ts` **inchangé**. Suite 209 verts, tsc + build OK.
- **Concordance production ↔ harnais** (`etude2-concordance.md`) : v1 inchangé (US 6,32 %/36,8 %),
  v2 rotation −25,8 % / fréquence 11,7→4,2/an (−64 %) = valeurs annoncées ; écarts ≤ bruit
  (sauf rotation fenêtrée, écart d'entrée documenté et bénin).

## 2. État de coexistence (déjà en place)

- **Production = v1** (`DEFAULT_MODEL_VERSION = "v1"`) : l'UI, les pages et les fixtures publiques
  sont **inchangées**. Aucune régression visible.
- **v2 opt-in** : le service accepte un paramètre `version` (`getCountryQuadrantModel`,
  `computeAllCountryQuadrantModels`, `computeQuadrantsRealSeries`). v2 est **prêt mais non branché**.
- **Rollback** = trivial : ne rien brancher (rester v1) ou repasser `version` à `"v1"`.

## 3. Migration vers v2 (À FAIRE seulement après décision, PAS dans ce jalon)

1. **Bascule serveur** : passer les loaders de pages 4Q (`page.tsx`, actions) à `version: "v2"`
   (ou basculer `DEFAULT_MODEL_VERSION`). Décision : bascule **explicite par page** d'abord (plus
   réversible) plutôt que le défaut global.
2. **Fixtures & goldens applicatifs** : la Vue pays / Comparaison / vs Actions afficheront les
   métriques v2 (rotation plus basse, perf nette ≈ ou > v1). Régénérer les éventuelles fixtures UI
   dépendantes ; `golden-v2.json` sert déjà de référence moteur. Documenter le changement de chiffres
   comme **volontaire** (v1 → v2).
3. **Non-régression** : après bascule, relancer la recette data-level des 4 vues (comme pour v1) et
   confirmer que seuls rotation/perf changent dans le sens attendu, régime/allocation-cible identiques.
4. **UI / pédagogie** (cf. §5) : ajuster la Méthodologie et les libellés **sans révéler le seuil** ;
   présenter le bénéfice comme **efficience / moins d'opérations**, jamais comme de l'alpha.

## 4. Plan de mise en production proposé (étapes, à valider par Yann)

1. **v2-rc1** (ce jalon) : candidat figé sur branche + tag, v1 reste la prod. ← *nous sommes ici*
2. **Recette visuelle** : lancer l'app en `version:"v2"` sur quelques pages (staging local),
   vérifier le rendu (Vue pays, comparaisons) et la cohérence des libellés.
3. **Go/No-Go** : si OK, bascule serveur page par page ; sinon rollback (rester v1).
4. **v2 officiel** : une fois basculé et re-validé, promouvoir `4q-standard-v2` en socle
   (nouveau tag `4q-standard-v2`), conserver v1 pour comparaison/rollback un temps.
5. **Puis seulement** : reprise des chantiers gelés (vitesse/accélération, comparaison Browne).

## 5. Confidentialité (règle produit)

- **Interne uniquement** : la formule de bande et le seuil **δ=5** (ce dossier, `model-version.ts`,
  `experiments/4q-stabilisation/`). Ne pas les publier.
- **UI publique** : peut mentionner « réallocation peu fréquente / portefeuille stable / efficience
  de coûts » et éventuellement un ordre de grandeur d'opérations par an, **sans** donner le seuil ni
  la règle exacte. La Méthodologie publique décrit le principe (« on ne réalloue que si l'écart à la
  cible est significatif ») **sans chiffrer** le seuil propriétaire.

## 6. Ne pas faire maintenant
- Ne pas basculer l'UI ni remplacer v1 (fait seulement après recette visuelle + décision).
- Ne pas lancer vitesse/accélération, ni nouvelle optimisation, ni comparaison Browne avant
  validation de v2-rc1 (consigne Yann).
