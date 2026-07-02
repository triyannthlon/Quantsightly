# Glossaire Quantsightly

> **Document conceptuel verrouillé — Phase 0, Chantier 2 (2026-06-24).**
> *Étendu le 2026-07-02 : groupes H (actifs de référence) et I (lecture des signaux), pour aligner le doc sur le vocabulaire déjà présent dans l'application.*
> Vocabulaire produit officiel. Toute formulation dans l'app (tooltips, verdicts, libellés, mode débutant et mode avancé) doit s'appuyer sur ces définitions.
>
> Persona cible : **débutant niveau 2** (connaît actions/obligations, ne connaît pas Sharpe).
> Voix : **première personne** ("je", "mon") dans l'app ; "vous" en communication externe.

---

## Format

Chaque entrée suit la même structure :

> **Terme**
> *Définition débutant* — 1 phrase, niveau 2
> *Définition technique* — 1-2 phrases
> *Exemple concret*
> *Mots liés*

---

## Groupe A — Nature des actifs (grammaire Gave)

### 1. Outil

*Un actif qui rapporte parce qu'il produit quelque chose.*

Catégorie Gave désignant les actifs dont la valeur dérive de cash-flows futurs : bénéfices d'entreprise, loyers, royalties. Aussi appelé *actif d'efficacité* dans le texte original de Charles Gave.

*Exemples : actions, indices boursiers, ETF actions, REITs cotés.*

*Mots liés : Rareté, Contrat, Actif financier, Fragile*

### 1a. Action de croissance

*Entreprise valorisée surtout pour ses profits futurs.*

Elle réinvestit beaucoup, verse souvent peu de dividendes et dépend fortement de la confiance des investisseurs. Sous-type d'Outil.

*Exemples : technologie, logiciels, santé innovante, entreprises très qualitatives.*

*Mots liés : Outil, Action value, Boom déflationniste, Fragile*

### 1b. Action value

*Entreprise déjà rentable, souvent moins chère que le marché, parfois mature ou cyclique.*

Elle peut verser des dividendes et profiter d'un retour de l'inflation ou du cycle économique. Sous-type d'Outil.

*Exemples : banques, énergie, industrie, assurance, matières premières.*

*Mots liés : Outil, Action de croissance, Boom inflationniste, Secteur (énergie)*

### 2. Rareté

*Un actif qui vaut parce qu'il en existe peu.*

Catégorie Gave désignant les actifs sans cash-flow dont la valeur tient à une quantité limitée. Aussi appelé *actif de rareté* (« scarcity value » dans le texte original).

*Exemples : or, argent, matières premières en stock, bitcoin.*

*Mots liés : Outil, Contrat, Réserve de valeur, Protecteur*

### 3. Contrat

*Actif financier qui repose sur une promesse : remboursement, coupon, dépôt ou créance.*

Sa valeur dépend de la solidité de l'émetteur et de la monnaie utilisée. Catégorie Gave désignant les engagements avec contrepartie (remboursement futur, parité monétaire, livraison) — risque de défaut toujours présent.

*Exemples : cash, obligations, dépôts bancaires, produits de taux, fonds monétaires, stablecoins (USDC, USDT).*

*Mots liés : Outil, Rareté, Réserve de valeur, Robuste*

---

## Groupe B — Classifications complémentaires

### 4. Actif réel

*Actif qui possède une valeur économique directe : entreprise, or, immobilier, matière première.*

Il ne dépend pas uniquement de la promesse de remboursement d'un tiers. Englobe à la fois les Outils (actions = parts d'entreprises réelles) et la Rareté (or, matières premières).

*Exemples : actions, or, immobilier coté (REITs), énergie, matières premières.*

*Mots liés : Actif financier, Outil, Rareté*

### 5. Actif financier

*Un actif dont la valeur repose sur une promesse écrite, pas sur une chose réelle.*

Désigne les engagements contractuels : papier représentant une dette ou une parité. Catégorie qui recouvre la quasi-totalité des Contrats.

*Exemples : obligations souveraines, obligations d'entreprise, cash, dépôts bancaires, stablecoins.*

*Mots liés : Actif réel, Contrat, Réserve de valeur*

### 6. Secteur

*Le domaine économique dans lequel un actif est exposé.*

Tag transversal qui s'ajoute à la catégorie Gave (Outil/Rareté/Contrat). Permet d'isoler les expositions sensibles à un régime macro précis — notamment l'énergie, clé de voûte du système selon Gave.

*Exemples : énergie (XLE), technologie (XLK), finance (XLF), santé, consommation discrétionnaire.*

*Mots liés : Outil, Régime, Boom inflationniste*

### 7. Cash / Monnaie

*De l'argent disponible immédiatement, sous forme de billets, dépôts ou fonds monétaires.*

Bien que perçu comme « neutre », le cash est un **Contrat** selon Gave : il représente la promesse d'un État ou d'une banque de maintenir un pouvoir d'achat — promesse érodée par l'inflation et soumise à un risque de contrepartie. Son rôle dans un portefeuille est d'être **Robuste** : il ne fait pas gagner, il évite de perdre quand tout chute.

*Exemples : billets, comptes courants, livrets, fonds monétaires (XEON, BIL), comptes à terme courts.*

*Mots liés : Contrat, Robuste, Réserve de valeur, Portefeuille Permanent*

---

## Groupe C — Régime macro

### 8. Régime

*L'état général de l'économie à un moment donné, qui dicte quels actifs vont bien marcher.*

Combinaison du couple croissance × inflation qui détermine quelles classes d'actifs sont favorisées ou pénalisées. Le régime change lentement (mois ou années) mais il change.

*Exemple : en stagflation (récession + inflation), le cash et l'énergie protègent ; les actions de croissance et les obligations longues souffrent.*

*Mots liés : Quadrant, Boom déflationniste, Boom inflationniste, Stagflation, Contraction déflationniste*

### 9. Quadrant

*Une des quatre cases dans lesquelles peut se trouver l'économie.*

Cadre Gavekal (depuis 1978) qui croise deux axes : croissance qui accélère/ralentit et inflation qui accélère/décélère. Les quatre quadrants sont Boom déflationniste, Boom inflationniste, Stagflation, Contraction déflationniste.

*Exemple : 2020-2021 = Boom déflationniste (croissance forte, inflation basse) ; 2022 = Boom inflationniste puis Stagflation.*

*Mots liés : Régime + les 4 quadrants*

### 10. Boom déflationniste

*Quand l'économie va bien et que les prix montent peu.*

Quadrant croissance forte × inflation faible. Régime favorable aux actifs de longue durée : actions de croissance, immobilier, obligations longues. Régime dominant 2010-2021.

*Exemple : décennie post-2008 jusqu'à 2021.*

*Mots liés : Quadrant, Outil, Fragile*

### 11. Boom inflationniste

*Quand l'économie va bien mais que les prix montent fort.*

Quadrant croissance forte × inflation haute. Régime favorable aux actifs rares : or, matières premières, énergie, actions value, marchés émergents. Régime dominant 1970-1980.

*Exemple : 1973-1980 ; partiellement 2022.*

*Mots liés : Quadrant, Rareté, Secteur (énergie)*

### 12. Stagflation

*Quand l'économie ralentit ET que les prix montent — le pire des deux mondes.*

Quadrant récession × inflation. Régime hostile à presque tout : seuls le cash et les actifs liés à l'énergie résistent. Régime des années 1973-1975 et 1978-1980.

*Exemple : 1974, 1979, partiellement 2022.*

*Mots liés : Quadrant, Contrat (cash), Secteur (énergie), Vulnérabilité*

### 13. Contraction déflationniste

*Quand l'économie ralentit et que les prix baissent.*

Quadrant récession × désinflation. Régime favorable aux obligations d'État longues (les taux baissent, leur prix monte). Régime des grandes crises : 1929-1933, 2008.

*Exemple : 2008-2009 ; 1929-1933.*

*Mots liés : Quadrant, Contrat, Protecteur*

---

## Groupe D — Rôle de l'actif

### 14. Fragile

*Un actif qui peut perdre beaucoup quand le régime tourne mal.*

Désigne un actif qui se comporte bien dans un seul type de régime et chute dans les autres. Notion empruntée à Nassim Taleb. Les actions sont fragiles par nature : elles brillent en boom déflationniste, souffrent ailleurs.

*Exemples : actions de croissance, obligations longues en régime inflationniste.*

*Mots liés : Robuste, Protecteur, Vulnérabilité*

### 15. Robuste

*Un actif qui ne perd pas beaucoup quel que soit le régime.*

Désigne un actif dont la valeur reste stable à travers les quadrants. Ne fait pas gagner gros, mais ne fait pas perdre non plus. Le cash en est l'archétype.

*Exemples : cash, fonds monétaires, obligations courtes.*

*Mots liés : Fragile, Protecteur, Contrat*

### 16. Protecteur

*Un actif qui monte quand le reste s'effondre.*

Désigne un actif qui gagne précisément quand les autres perdent — il **profite** du désordre, il n'y résiste pas. Aussi appelé *antifragile* (Taleb) en mode avancé. L'or protège en régime inflationniste, les obligations longues d'État protègent en contraction déflationniste.

*Exemples : or en boom inflationniste, obligations longues en contraction déflationniste.*

*Mots liés : Fragile, Robuste, Rareté, Régime*

---

## Groupe E — Métriques

### 17. Performance réelle / rendement réel

*Ce que mon argent gagne vraiment, une fois l'inflation déduite.*

Performance nominale moins l'inflation. C'est la seule mesure honnête sur longue période : un placement à 5 % pendant que l'inflation est à 7 % perd 2 % de pouvoir d'achat.

*Exemple : S&P 500 → 6,5 % CAGR réel sur longue période (Gave) ; Browne classique → 4,3 % CAGR réel.*

*Mots liés : Volatilité, Drawdown*

### 18. Volatilité

*À quel point la valeur d'un actif monte et descend dans le temps.*

Mesure statistique (écart-type des rendements) de l'amplitude des variations. Une volatilité élevée signifie de gros écarts à la hausse comme à la baisse — pas seulement du risque de perte.

*Exemple : S&P 500 vol ≈ 12,5 % annuelle ; Portefeuille Permanent ≈ 6,9 % ; cash ≈ 0 %.*

*Mots liés : Drawdown, Sharpe*

### 19. Drawdown

*La pire baisse subie depuis le plus haut, avant de remonter.*

Mesure la chute maximale d'un portefeuille entre un sommet et le creux qui suit. Critère central : un drawdown profond est psychologiquement et financièrement plus douloureux qu'une volatilité élevée.

*Exemple : S&P 500 → drawdown max -52 % (2008-2009) ; Portefeuille Permanent → -25 %.*

*Mots liés : Volatilité, Ursus magnus, Vulnérabilité*

### 20. Sharpe *(mode avancé)*

*Combien de rendement on gagne pour chaque unité de risque pris.*

Ratio rendement / volatilité (rapporté au taux sans risque). Mesure technique : un Sharpe élevé veut dire « beaucoup de gain pour peu de secousses ». Réservé au mode avancé du produit.

*Exemple : S&P 500 ≈ 0,5 ; Portefeuille Permanent ≈ 0,6 ; Browne dynamique ≈ 0,9.*

*Mots liés : Volatilité, Performance réelle*

### 21. Ursus magnus

*Une chute massive et durable des actions — plus de 40 % en valeur réelle.*

Terme Gave désignant un effondrement majeur du marché actions, mesuré en pouvoir d'achat (donc inflation incluse). Distinct d'une simple correction. Survient typiquement quand les actions sous-performent l'or sur longue période.

*Exemple : 1929-1932, 1973-1982 en termes réels, 2000-2009.*

*Mots liés : Drawdown, Marché baissier (au sens Gave), Fragile*

### 22. Marché baissier (au sens Gave)

*Une période où les actions perdent du terrain face à l'or, pas seulement où elles baissent en euros.*

Définition Gave qui rompt avec la convention de marché. Le critère standard (« -20 % nominal ») est trompeur car il ignore l'érosion monétaire : des actions stables en euros pendant que l'or double, c'est déjà un marché baissier. Le vrai juge de paix est la performance relative actions/or sur longue période.

*Exemple : 1966-1980 — le Dow Jones est resté stable en dollars, mais s'est effondré de ~80 % face à l'or. Marché baissier majeur au sens Gave.*

*Mots liés : Ursus magnus, Performance réelle, Rareté*

---

## Groupe F — Portefeuilles de référence

### 23. Portefeuille Permanent *(Browne classique)*

*Le portefeuille de Harry Browne : 25 % actions, 25 % obligations longues, 25 % or, 25 % cash.*

Construction proposée par Harry Browne dans les années 1980. Chaque quart est conçu pour briller dans un quadrant macro précis : actions pour boom déflationniste, obligations pour contraction déflationniste, or pour boom inflationniste, cash pour stagflation. Référence comparative dans Quantsightly.

*Exemple : performance historique 4,3 % CAGR réel, vol 6,9 %, drawdown max -25 %.*

*Mots liés : Browne amélioré, Browne dynamique, Quadrant*

### 24. Browne amélioré

*Le Portefeuille Permanent avec une rotation or↔obligations selon la tendance.*

Variante proposée par Gave : on bascule entre or et obligations longues selon que les obligations sont au-dessus ou en-dessous de leur moyenne mobile 7 ans. Garde la simplicité, améliore la performance.

*Exemple : 6,0 % CAGR réel (vs 4,3 % pour Browne classique).*

*Mots liés : Portefeuille Permanent, Browne dynamique*

### 25. Browne dynamique

*Browne amélioré + une poche énergie pour profiter du cycle pétrolier.*

Browne amélioré auquel Gave ajoute une exposition à l'énergie (XLE.US). Reconnaît le rôle central de l'énergie dans le système économique.

*Exemple : 6,7 % CAGR réel — meilleure performance des trois variantes Browne.*

*Mots liés : Browne amélioré, Secteur (énergie)*

### 26. Réserve de valeur

*Un actif qui garde son pouvoir d'achat sur très longue période.*

Notion centrale chez Gave : sur des décennies, seuls certains actifs préservent ce qu'on y a mis. L'or en est l'archétype historique, le cash en monnaie fiat ne l'est pas (érodé par l'inflation).

*Exemples : or, bitcoin (débattu), certaines actions de qualité.*

*Mots liés : Rareté, Performance réelle, Protecteur*

---

## Groupe G — Diagnostic Quantsightly

### 27. Diagnostic

*Le verdict que Quantsightly pose sur mon portefeuille.*

Cœur du produit : pas une recommandation d'achat/vente, pas un score, mais une lecture honnête de la composition à travers la grille Gave et le régime macro actuel. Le diagnostic répond à la question fondatrice : *« mon portefeuille est-il construit pour le monde dans lequel je vis ? »*

*Exemple : « Vulnérable au régime actuel : 80 % en Outils, aucune protection contre l'inflation. »*

*Mots liés : Cohérence, Vulnérabilité*

### 28. Cohérence

*Mon portefeuille est-il aligné avec le régime macro actuel ?*

Mesure le degré d'adéquation entre la composition (Outils/Rareté/Contrats) et ce que le quadrant en cours favorise. Un portefeuille 100 % actions est cohérent en Boom déflationniste, incohérent en Stagflation.

*Exemple : un portefeuille équilibré Browne est cohérent dans tous les quadrants (par construction).*

*Mots liés : Diagnostic, Régime, Vulnérabilité*

### 29. Vulnérabilité

*Ce qui peut faire mal à mon portefeuille si le régime change ou si un choc arrive.*

Identification des expositions concentrées et des manques de protection. La vulnérabilité n'est pas un risque abstrait : c'est nommer précisément ce qui s'effondrerait en cas de bascule de quadrant ou de choc énergétique.

*Exemple : « concentration de 90 % en actions US — vulnérable à un Ursus magnus » ; « aucune protection or — vulnérable à un boom inflationniste ».*

*Mots liés : Diagnostic, Cohérence, Fragile, Drawdown*

---

## Groupe H — Actifs de référence

*Les actifs concrets suivis par l'application. Le Cash / Monnaie est déjà défini en 7 (groupe B).*

### 30. Or

*Un actif réel rare, sans risque de faillite, qui ne verse aucun revenu.*

L'or ne produit rien et ne promet rien : sa valeur tient à sa rareté. Il peut protéger le pouvoir d'achat quand la monnaie se déprécie ou quand la confiance dans les contrats financiers s'effrite. Archétype de la Rareté et actif Protecteur en régime inflationniste.

*Exemple : en boom inflationniste (1970-1980, partiellement 2022), l'or surperforme les actions et les obligations.*

*Mots liés : Rareté, Protecteur, Réserve de valeur, Boom inflationniste*

### 31. Obligation longue

*Un prêt à long terme à un État ou une entreprise, remboursé avec intérêts.*

Son prix évolue à l'inverse des taux : il monte quand les taux baissent, il chute quand l'inflation ou les taux remontent. C'est un Contrat, Protecteur en contraction déflationniste mais Fragile en régime inflationniste.

*Exemple : en 2008-2009, les obligations d'État longues montent pendant que les actions s'effondrent ; en 2022, elles chutent avec le retour de l'inflation.*

*Mots liés : Contrat, Protecteur, Fragile, Contraction déflationniste, Taux réel*

### 32. Matières premières

*Des ressources physiques utilisées dans l'économie, dont la valeur tient à leur rareté.*

Sans cash-flow, elles relèvent de la Rareté. Elles se comportent souvent bien quand l'inflation accélère ou quand l'énergie devient rare et chère. L'énergie (pétrole) y joue un rôle central dans la lecture Gave.

*Exemples : pétrole, gaz, cuivre, blé.*

*Mots liés : Rareté, Secteur (énergie), Boom inflationniste*

---

## Groupe I — Lecture des signaux (méthode)

*Comment le moteur lit les marchés pour en déduire le régime. Ces termes sont des concepts de méthode, pas des statistiques officielles.*

### 33. Proxy

*Un indicateur indirect utilisé pour mesurer une réalité difficile à observer.*

Le modèle n'utilise ni le PIB ni l'inflation officielle (publiés tard, souvent révisés). Il lit des prix de marché, plus réactifs, pour estimer la croissance et l'inflation en temps réel.

*Exemple : la croissance est approchée par le rapport actions / pétrole plutôt que par le PIB.*

*Mots liés : Axe croissance, Axe inflation, Régime*

### 34. Axe croissance

*Mesure si l'activité économique accélère ou ralentit, à partir des prix de marché.*

Proxy : actions / pétrole. Si les actions surperforment le pétrole, l'économie transforme efficacement l'énergie en valeur — la croissance est jugée solide. Si le pétrole domine, la croissance se fragilise. Ce n'est pas le PIB officiel.

*Mots liés : Proxy, Régime, Quadrant, Énergie efficace*

### 35. Axe inflation

*Mesure si la pression sur les prix accélère ou décélère, à partir des prix de marché.*

Proxy : or / obligations 10 ans. Si l'or surperforme les obligations, le marché signale une perte de pouvoir d'achat de la monnaie. Sur la page Signaux, le même couple est présenté à l'envers (obligations / or), sous l'angle de la solidité de la devise — même information, sens inversé.

*Mots liés : Proxy, Régime, Devise protectrice, Réserve de valeur*

### 36. Moyenne mobile 7 ans

*La tendance longue d'un ratio, utilisée comme point de comparaison.*

Le modèle compare chaque ratio à sa moyenne sur 7 ans (84 mois) pour éviter de réagir à un simple bruit de court terme. Le franchissement de cette moyenne fait basculer le signal.

*Exemple : un ratio S&P 500 / WTI au-dessus de sa moyenne 7 ans indique une énergie plus productive pour l'économie.*

*Mots liés : Signal positif, Signal négatif, Zone neutre*

### 37. Signal positif / négatif

*Le ratio est au-dessus (positif) ou en-dessous (négatif) de sa tendance longue.*

Un signal positif indique que l'axe concerné accélère (croissance ou inflation plus forte selon le ratio observé) ; un signal négatif, qu'il décélère. Le caractère favorable dépend de l'actif considéré, pas du signe seul.

*Mots liés : Moyenne mobile 7 ans, Zone neutre, Régime*

### 38. Zone neutre / Transition

*Quand le signal est trop proche de sa tendance longue pour trancher.*

Au moins un des deux axes est trop près de sa moyenne : le régime est instable ou en bascule. Le modèle affiche « Transition » plutôt qu'une fausse précision, et exige une confirmation sur deux observations avant de changer de régime.

*Mots liés : Conviction, Régime, Signal positif*

### 39. Conviction

*La force du signal calculé par le modèle.*

Plus les deux axes sont éloignés de leur moyenne longue, plus le régime est jugé robuste et la conviction élevée. Une conviction faible signale un régime proche d'une zone de bascule.

*Mots liés : Zone neutre, Régime, Quadrant*

---

## Récapitulatif

| Groupe | Termes | Plage |
|---|---|---|
| A — Nature des actifs | Outil (+ Action de croissance, Action value), Rareté, Contrat | 1-3 (+1a, 1b) |
| B — Classifications complémentaires | Actif réel, Actif financier, Secteur, Cash/Monnaie | 4-7 |
| C — Régime macro | Régime, Quadrant + 4 quadrants | 8-13 |
| D — Rôle de l'actif | Fragile, Robuste, Protecteur | 14-16 |
| E — Métriques | Performance réelle, Volatilité, Drawdown, Sharpe, Ursus magnus, Marché baissier (Gave) | 17-22 |
| F — Portefeuilles de référence | Portefeuille Permanent, Browne amélioré, Browne dynamique, Réserve de valeur | 23-26 |
| G — Diagnostic Quantsightly | Diagnostic, Cohérence, Vulnérabilité | 27-29 |
| H — Actifs de référence | Or, Obligation longue, Matières premières | 30-32 |
| I — Lecture des signaux (méthode) | Proxy, Axe croissance, Axe inflation, Moyenne mobile 7 ans, Signal positif/négatif, Zone neutre/Transition, Conviction | 33-39 |

**Total : 41 entrées** (39 numérotées + 2 sous-types d'actions : Action de croissance, Action value).
