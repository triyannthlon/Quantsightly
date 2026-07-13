// Dictionnaire de définitions produit — source unique pour les tooltips, le
// panneau « Lexique » de chaque page, et (à terme) l'agent vocal.
//
// Persona : débutant niveau 2. `base` = définition COURTE (1 phrase, toujours
// visible dans le panneau) ; `technique` = définition détaillée (dépliée) ;
// `privilegier`/`reduire` = orientation d'actifs (régimes) ; `exemple` = ancrage.
// `group` = section du panneau. `source` = provenance (glossaire vs méthode).

export interface GlossaryEntry {
  key: string;
  term: string;
  group: string;
  /** Définition courte (toujours visible). */
  base: string;
  /** Définition détaillée (dépliée). */
  technique?: string;
  /** Régimes : classes d'actifs à privilégier. */
  privilegier?: string;
  /** Régimes : classes d'actifs à réduire. */
  reduire?: string;
  /** Exemples concrets. */
  exemple?: string;
  /** Formule simplifiée. */
  formule?: string;
  /** Point clé à retenir (mis en avant). */
  retenir?: string;
  source: "glossaire" | "méthode";
}

const G_REGIME = "Régime macro";
const G_ACTIFS = "Nature des actifs";
const G_SIGNAUX = "Calcul des signaux";
const G_CLASSES = "Classes de données";
const G_MESURES = "Mesures disponibles";
const G_SIG_REGIME = "Lecture du régime";
const G_SIG_RATIOS = "Ratios clés";
const G_SIG_TENDANCES = "Signaux et tendances";
const G_SIG_ACTIFS = "Actifs et interprétation";
// Browne (page Modèles > Browne)
const G_BR_PILOTAGE = "Portefeuille & pilotage";
const G_BR_PERF = "Performance";
const G_BR_RISQUE = "Risque";
const G_BR_RR = "Rendement-risque";
const G_BR_INFLATION = "Inflation & pouvoir d’achat";
const G_BR_COMPARAISON = "Comparaison & sources";
const G_BR_DONNEES = "Données & graphes";
const G_BR_VS_ACTIONS = "Browne vs Actions";

const ENTRIES: Record<string, GlossaryEntry> = {
  // ─── Régime macro ─────────────────────────────────────────────────────────
  regime: {
    key: "regime",
    term: "Régime",
    group: G_REGIME,
    base: "L’état général de l’économie à un moment donné.",
    technique:
      "Il combine deux forces : la croissance et l’inflation. Selon le régime, certaines classes d’actifs sont favorisées, tandis que d’autres deviennent plus fragiles.",
    source: "glossaire",
  },
  quadrant: {
    key: "quadrant",
    term: "Quadrant",
    group: G_REGIME,
    base: "Une des quatre situations possibles de l’économie.",
    technique:
      "Le cadre croise deux axes : croissance qui accélère ou ralentit, et inflation qui accélère ou décélère. Chaque quadrant correspond à un environnement de marché différent.",
    source: "glossaire",
  },
  croissance: {
    key: "croissance",
    term: "Croissance",
    group: G_REGIME,
    base: "Mesure si l’activité économique accélère ou ralentit.",
    technique:
      "Proxy utilisé : actions / pétrole. Si les actions surperforment le pétrole, l’économie est jugée plus productive. Si le pétrole domine, la croissance devient plus fragile. Ce n’est pas le PIB officiel.",
    source: "méthode",
  },
  inflation: {
    key: "inflation",
    term: "Inflation",
    group: G_REGIME,
    base: "Mesure si la pression sur les prix accélère ou décélère.",
    technique:
      "Proxy utilisé : or / obligations 10 ans. Si l’or surperforme les obligations, le marché signale une perte de pouvoir d’achat de la monnaie ou une hausse du risque inflationniste. Ce n’est pas l’inflation officielle. Sur la page Signaux, ce même couple est présenté à l’envers (Obligations / Or), sous l’angle de la solidité de la devise : même information, sens inversé.",
    source: "méthode",
  },
  "boom-inflationniste": {
    key: "boom-inflationniste",
    term: "Boom inflationniste",
    group: G_REGIME,
    base: "L’économie accélère, mais les prix montent aussi.",
    technique:
      "Les entreprises vendent plus, mais leurs coûts augmentent. C’est un régime de croissance nominale forte.",
    privilegier: "or, matières premières, énergie, actions value.",
    reduire: "obligations longues.",
    source: "glossaire",
  },
  "boom-deflationniste": {
    key: "boom-deflationniste",
    term: "Boom déflationniste",
    group: G_REGIME,
    base: "L’économie accélère et les prix restent maîtrisés.",
    technique:
      "Les entreprises produisent plus efficacement grâce à l’innovation, à la productivité ou à une meilleure organisation.",
    privilegier: "actions de croissance, entreprises innovantes, obligations longues.",
    reduire: "matières premières.",
    source: "glossaire",
  },
  "contraction-inflationniste": {
    key: "contraction-inflationniste",
    term: "Contraction inflationniste",
    group: G_REGIME,
    base: "L’économie ralentit alors que les prix continuent de monter.",
    technique:
      "C’est la stagflation : les coûts montent, les marges baissent et les actifs classiques deviennent fragiles.",
    privilegier: "cash, or, énergie.",
    reduire: "actions de croissance, obligations longues.",
    source: "glossaire",
  },
  "contraction-deflationniste": {
    key: "contraction-deflationniste",
    term: "Contraction déflationniste",
    group: G_REGIME,
    base: "L’économie ralentit et les prix baissent.",
    technique:
      "La demande diminue, le poids réel de la dette augmente et les investisseurs recherchent la sécurité.",
    privilegier: "obligations d’État longues, cash.",
    reduire: "actions, matières premières, actifs risqués.",
    source: "glossaire",
  },
  transition: {
    key: "transition",
    term: "Transition",
    group: G_REGIME,
    base: "Le signal n’est pas assez clair pour choisir un quadrant.",
    technique:
      "Au moins un des deux axes est trop proche de sa tendance longue. Le régime est instable ou en bascule. Le modèle préfère éviter une fausse précision.",
    source: "méthode",
  },

  // ─── Nature des actifs ────────────────────────────────────────────────────
  "action-croissance": {
    key: "action-croissance",
    term: "Action de croissance",
    group: G_ACTIFS,
    base: "Entreprise valorisée surtout pour ses profits futurs.",
    technique:
      "Elle réinvestit beaucoup, verse souvent peu de dividendes et dépend fortement de la confiance des investisseurs.",
    exemple: "technologie, logiciels, santé innovante.",
    source: "glossaire",
  },
  "action-value": {
    key: "action-value",
    term: "Action value",
    group: G_ACTIFS,
    base: "Entreprise déjà rentable, souvent moins chère que le marché.",
    technique:
      "Elle est souvent mature, cyclique ou moins à la mode. Elle peut verser des dividendes et profiter d’un retour de l’inflation ou du cycle économique.",
    exemple: "banques, énergie, industrie, assurance.",
    source: "glossaire",
  },
  "actif-reel": {
    key: "actif-reel",
    term: "Actif réel",
    group: G_ACTIFS,
    base: "Actif qui possède une valeur économique directe.",
    technique:
      "Il ne dépend pas uniquement d’une promesse de remboursement. Il peut produire des revenus, représenter une entreprise ou une ressource rare.",
    exemple: "actions, or, immobilier, énergie, matières premières.",
    source: "glossaire",
  },
  contrat: {
    key: "contrat",
    term: "Contrat",
    group: G_ACTIFS,
    base: "Actif financier qui repose sur une promesse.",
    technique:
      "Il donne droit à un remboursement, un intérêt, un coupon ou une créance. Sa valeur dépend de l’émetteur et de la monnaie utilisée.",
    exemple: "cash, obligations, dépôts bancaires.",
    source: "glossaire",
  },
  cash: {
    key: "cash",
    term: "Cash",
    group: G_ACTIFS,
    base: "Liquidités disponibles immédiatement.",
    technique:
      "Le cash ne cherche pas à gagner beaucoup. Il sert surtout à protéger le portefeuille et à conserver de la flexibilité quand les marchés sont instables.",
    source: "glossaire",
  },
  "obligation-longue": {
    key: "obligation-longue",
    term: "Obligation longue",
    group: G_ACTIFS,
    base: "Prêt à long terme à un État ou une entreprise.",
    technique:
      "Son prix monte souvent quand les taux baissent. Mais elle peut beaucoup souffrir lorsque l’inflation ou les taux remontent.",
    source: "glossaire",
  },
  or: {
    key: "or",
    term: "Or",
    group: G_ACTIFS,
    base: "Actif réel rare, sans risque de faillite.",
    technique:
      "L’or ne verse pas de revenu, mais il peut protéger contre la perte de pouvoir d’achat de la monnaie ou les crises de confiance.",
    source: "glossaire",
  },
  "matieres-premieres": {
    key: "matieres-premieres",
    term: "Matières premières",
    group: G_ACTIFS,
    base: "Ressources physiques utilisées dans l’économie.",
    technique:
      "Elles peuvent bien se comporter lorsque l’inflation accélère ou lorsque l’énergie devient rare et chère.",
    exemple: "pétrole, gaz, cuivre, blé.",
    source: "glossaire",
  },

  // ─── Calcul des signaux ───────────────────────────────────────────────────
  proxy: {
    key: "proxy",
    term: "Proxy",
    group: G_SIGNAUX,
    base: "Indicateur indirect utilisé pour mesurer une réalité difficile à observer.",
    technique:
      "Le modèle n’utilise pas directement le PIB ou l’inflation officielle. Il utilise des prix de marché, plus réactifs.",
    source: "méthode",
  },
  mm7y: {
    key: "mm7y",
    term: "Moyenne mobile 7 ans",
    group: G_SIGNAUX,
    base: "Tendance longue utilisée comme point de comparaison.",
    technique:
      "Le modèle compare les ratios actuels à leur moyenne sur 7 ans. Cela permet d’éviter de réagir à un simple bruit de marché.",
    source: "méthode",
  },
  "signal-positif": {
    key: "signal-positif",
    term: "Signal positif",
    group: G_SIGNAUX,
    base: "Le ratio est au-dessus de sa tendance longue.",
    technique:
      "Cela indique que l’axe concerné accélère : croissance plus forte ou inflation plus forte selon le ratio observé.",
    source: "méthode",
  },
  "signal-negatif": {
    key: "signal-negatif",
    term: "Signal négatif",
    group: G_SIGNAUX,
    base: "Le ratio est sous sa tendance longue.",
    technique:
      "Cela indique que l’axe concerné décélère : croissance plus faible ou inflation plus faible selon le ratio observé.",
    source: "méthode",
  },
  "zone-neutre": {
    key: "zone-neutre",
    term: "Zone neutre",
    group: G_SIGNAUX,
    base: "Zone où le signal est trop proche de zéro.",
    technique:
      "Elle évite de changer de régime pour un écart trop faible. C’est une zone d’incertitude assumée.",
    source: "méthode",
  },
  conviction: {
    key: "conviction",
    term: "Conviction",
    group: G_SIGNAUX,
    base: "Force du signal calculé par le modèle.",
    technique:
      "Plus les deux axes sont éloignés de leur tendance longue, plus le régime est considéré comme robuste.",
    source: "méthode",
  },

  // ─── Comparateur — Classes de données ─────────────────────────────────────
  "data-croissance-reelle": {
    key: "data-croissance-reelle",
    term: "Croissance réelle",
    group: G_CLASSES,
    base: "Mesure l’évolution de l’activité économique après correction de l’inflation.",
    technique:
      "Elle permet de savoir si l’économie produit réellement plus de biens et services, et pas seulement si les prix montent.",
    retenir: "La croissance réelle mesure le volume d’activité, pas la hausse des prix.",
    source: "glossaire",
  },
  "data-indice-boursier": {
    key: "data-indice-boursier",
    term: "Indice boursier",
    group: G_CLASSES,
    base: "Panier d’actions représentant un marché, un pays, une région ou un secteur.",
    technique:
      "Il sert à suivre la performance globale d’un marché actions plutôt qu’une seule entreprise.",
    exemple: "S&P 500, CAC 40, DAX, Nikkei 225.",
    retenir: "Un indice boursier donne une vue synthétique de la santé du marché actions.",
    source: "glossaire",
  },
  "data-inflation": {
    key: "data-inflation",
    term: "Inflation",
    group: G_CLASSES,
    base: "Mesure la hausse générale des prix dans une économie.",
    technique:
      "Elle indique si le pouvoir d’achat de la monnaie baisse avec le temps. Une inflation élevée réduit la valeur réelle du cash et peut pénaliser les obligations.",
    retenir: "L’inflation mesure la perte de pouvoir d’achat de la monnaie.",
    source: "glossaire",
  },
  "data-liquidite": {
    key: "data-liquidite",
    term: "Liquidité",
    group: G_CLASSES,
    base: "Désigne l’argent disponible immédiatement ou les placements très courts.",
    technique:
      "Elle représente la partie la plus défensive d’un portefeuille. Elle protège moins contre l’inflation, mais offre de la flexibilité en période d’incertitude.",
    exemple: "Cash, dépôts, bons du Trésor très courts, taux monétaires.",
    retenir: "La liquidité sert surtout à attendre, protéger et saisir des opportunités.",
    source: "glossaire",
  },
  "data-obligation-10a": {
    key: "data-obligation-10a",
    term: "Obligation à 10 ans",
    group: G_CLASSES,
    base: "Titre de dette émis par un État ou une entreprise, avec une échéance proche de 10 ans.",
    technique:
      "Elle sert souvent de référence pour mesurer le coût de l’argent à long terme. Son prix monte généralement lorsque les taux baissent, et baisse lorsque les taux montent.",
    retenir: "L’obligation à 10 ans est un thermomètre du marché des taux longs.",
    source: "glossaire",
  },
  "data-taux-change": {
    key: "data-taux-change",
    term: "Taux de change",
    group: G_CLASSES,
    base: "Prix d’une monnaie exprimé dans une autre monnaie.",
    technique:
      "Il permet de mesurer la force ou la faiblesse d’une devise. Il influence les exportations, les importations, l’inflation et la performance des actifs étrangers.",
    exemple: "EUR/USD, USD/JPY, GBP/USD.",
    retenir: "Le taux de change mesure la valeur relative d’une monnaie.",
    source: "glossaire",
  },

  // ─── Comparateur — Mesures disponibles ────────────────────────────────────
  "mesure-prix": {
    key: "mesure-prix",
    term: "Prix",
    group: G_MESURES,
    base: "Valeur de marché simple d’un actif ou d’un indice à une date donnée.",
    technique:
      "C’est la mesure la plus directe, mais elle ne tient pas toujours compte des revenus versés, comme les dividendes ou les coupons.",
    retenir: "Le prix montre l’évolution visible du marché, mais pas toujours le rendement complet.",
    source: "glossaire",
  },
  "mesure-prix-coupons": {
    key: "mesure-prix-coupons",
    term: "Prix avec dividendes ou coupons réinvestis",
    group: G_MESURES,
    base: "Prix recalculé en supposant que les revenus versés sont réinvestis.",
    technique:
      "Pour une obligation, cela inclut les coupons. Pour un indice actions, l’équivalent serait le prix avec dividendes réinvestis, souvent appelé rendement total.",
    retenir: "C’est souvent la meilleure mesure pour comparer la performance réelle d’un placement.",
    source: "glossaire",
  },
  "mesure-per": {
    key: "mesure-per",
    term: "Ratio cours/bénéfices",
    group: G_MESURES,
    base: "Indicateur qui compare le prix d’un marché ou d’une action à ses bénéfices.",
    technique:
      "Il sert à savoir si un actif paraît cher ou bon marché par rapport aux profits qu’il génère.",
    formule: "Prix / bénéfices.",
    retenir: "Plus le ratio est élevé, plus le marché paie cher les bénéfices actuels.",
    source: "glossaire",
  },
  "mesure-taux": {
    key: "mesure-taux",
    term: "Taux",
    group: G_MESURES,
    base: "Rendement nominal affiché par un placement ou un marché obligataire.",
    technique: "Il indique combien un investisseur peut recevoir avant correction de l’inflation.",
    exemple: "Taux à 10 ans, taux court, taux directeur, rendement obligataire.",
    retenir: "Le taux nominal ne dit pas encore si l’investisseur gagne du pouvoir d’achat.",
    source: "glossaire",
  },
  "mesure-taux-reel": {
    key: "mesure-taux-reel",
    term: "Taux réel",
    group: G_MESURES,
    base: "Taux corrigé de l’inflation.",
    technique:
      "Il mesure le rendement après prise en compte de la perte de pouvoir d’achat de la monnaie.",
    formule: "Taux réel ≈ taux nominal − inflation.",
    retenir:
      "Un taux réel positif protège le pouvoir d’achat ; un taux réel négatif le détruit.",
    source: "glossaire",
  },

  // ─── Signaux macro — Lecture du régime ────────────────────────────────────
  "sig-signal-macro": {
    key: "sig-signal-macro",
    term: "Signal macroéconomique",
    group: G_SIG_REGIME,
    base: "Indicateur de marché utilisé pour lire l’état de l’économie.",
    technique:
      "Le modèle ne s’appuie pas directement sur les statistiques officielles. Il compare des prix de marché pour détecter si l’économie est plutôt en expansion, en contraction, en inflation ou en désinflation.",
    source: "méthode",
  },
  "sig-regime-probable": {
    key: "sig-regime-probable",
    term: "Régime probable",
    group: G_SIG_REGIME,
    base: "Lecture synthétique de l’environnement économique actuel.",
    technique:
      "Il combine plusieurs signaux : efficacité énergétique, qualité de la devise et performance des actions face à l’or. Le régime indique quels actifs sont naturellement favorisés ou fragilisés.",
    source: "méthode",
  },
  "sig-confiance": {
    key: "sig-confiance",
    term: "Confiance",
    group: G_SIG_REGIME,
    base: "Niveau de fiabilité du signal actuel.",
    technique:
      "Plus les ratios sont éloignés de leur moyenne longue, plus le signal est considéré comme robuste. Une confiance faible indique un régime proche d’une zone de bascule.",
    source: "méthode",
  },
  "sig-energie-efficace": {
    key: "sig-energie-efficace",
    term: "Énergie efficace",
    group: G_SIG_REGIME,
    base: "Situation où le marché actions progresse mieux que le prix de l’énergie.",
    technique:
      "Cela signifie que l’économie transforme l’énergie en valeur de manière productive. Le contexte est généralement plus favorable aux actions et aux actifs de croissance.",
    source: "méthode",
  },
  "sig-energie-inefficace": {
    key: "sig-energie-inefficace",
    term: "Énergie moins efficace",
    group: G_SIG_REGIME,
    base: "Situation où le prix de l’énergie progresse mieux que le marché actions.",
    technique:
      "L’énergie devient plus coûteuse pour l’économie. Les marges des entreprises peuvent être sous pression et le risque de contraction augmente.",
    source: "méthode",
  },
  "sig-devise-solide": {
    key: "sig-devise-solide",
    term: "Devise protectrice",
    group: G_SIG_REGIME,
    base: "Situation où les obligations protègent mieux que l’or.",
    technique:
      "Cela signifie que la monnaie conserve mieux son pouvoir d’achat. Les contrats financiers, comme les obligations ou le cash, restent relativement protecteurs.",
    source: "méthode",
  },
  "sig-devise-fragile": {
    key: "sig-devise-fragile",
    term: "Devise moins protectrice",
    group: G_SIG_REGIME,
    base: "Situation où l’or protège mieux que les obligations.",
    technique:
      "Cela indique que les contrats financiers protègent moins bien contre la perte de pouvoir d’achat. Les actifs réels, comme l’or ou les matières premières, deviennent plus attractifs.",
    source: "méthode",
  },

  // ─── Signaux macro — Ratios clés ──────────────────────────────────────────
  "sig-ratio-spx-wti": {
    key: "sig-ratio-spx-wti",
    term: "S&P 500 / WTI",
    group: G_SIG_RATIOS,
    base: "Ratio entre le marché actions américain et le prix du pétrole.",
    technique:
      "Il mesure l’efficacité énergétique de l’économie : si le ratio monte, les entreprises créent plus de valeur par rapport au coût de l’énergie. Si le ratio baisse, l’énergie devient plus lourde pour l’économie.",
    retenir: "Ratio en hausse = énergie plus productive pour l’économie.",
    source: "méthode",
  },
  "sig-ratio-bond-or": {
    key: "sig-ratio-bond-or",
    term: "Obligations 10 ans / Or",
    group: G_SIG_RATIOS,
    base: "Ratio entre les obligations longues et l’or.",
    technique:
      "Il mesure la qualité de la devise comme réserve de valeur. Si les obligations surperforment l’or, les contrats protègent bien. Si l’or surperforme, la devise devient plus fragile. C’est l’inverse de l’axe inflation (Or / Obligations) de la page Régimes : même information, lue dans l’autre sens.",
    retenir: "Ratio en baisse = l’or protège mieux que les obligations.",
    source: "méthode",
  },
  "sig-ratio-spx-or": {
    key: "sig-ratio-spx-or",
    term: "S&P 500 / Or",
    group: G_SIG_RATIOS,
    base: "Ratio entre les actions et l’or.",
    technique:
      "Il mesure si le marché actions monte réellement par rapport à une réserve de valeur. Si ce ratio progresse, les actions créent de la valeur réelle. S’il baisse, les gains boursiers peuvent être une illusion monétaire.",
    retenir: "Les actions doivent battre l’or pour confirmer un vrai marché haussier.",
    source: "méthode",
  },
  "sig-ratio-or-wti": {
    key: "sig-ratio-or-wti",
    term: "Or / WTI",
    group: G_SIG_RATIOS,
    base: "Ratio entre l’or et le pétrole.",
    technique:
      "Il mesure le prix relatif de l’énergie par rapport à l’or. Si le ratio est élevé, l’énergie est bon marché en termes d’or. Si le ratio baisse fortement, l’énergie devient chère et peut peser sur l’économie.",
    retenir: "Énergie chère = risque plus élevé pour la croissance.",
    source: "méthode",
  },

  // ─── Signaux macro — Signaux et tendances ─────────────────────────────────
  "sig-mm7": {
    key: "sig-mm7",
    term: "Moyenne mobile 7 ans",
    group: G_SIG_TENDANCES,
    base: "Tendance longue utilisée comme référence.",
    technique:
      "Le modèle compare chaque ratio à sa moyenne sur 7 ans pour éviter de réagir à un simple mouvement de court terme.",
    source: "méthode",
  },
  "sig-au-dessus-mm7": {
    key: "sig-au-dessus-mm7",
    term: "Au-dessus de la MM7",
    group: G_SIG_TENDANCES,
    base: "Le ratio est supérieur à sa tendance longue.",
    technique:
      "Cela indique généralement un signal positif pour l’axe observé : efficacité énergétique, qualité de devise ou confirmation du marché actions selon le ratio.",
    source: "méthode",
  },
  "sig-sous-mm7": {
    key: "sig-sous-mm7",
    term: "Sous la MM7",
    group: G_SIG_TENDANCES,
    base: "Le ratio est inférieur à sa tendance longue.",
    technique:
      "Cela indique généralement un signal de fragilité : énergie moins productive, devise moins protectrice ou actions en retrait face à l’or.",
    source: "méthode",
  },
  "sig-ratio-actuel": {
    key: "sig-ratio-actuel",
    term: "Ratio actuel",
    group: G_SIG_TENDANCES,
    base: "Dernière valeur calculée du ratio.",
    technique:
      "Il sert à savoir où se situe le signal aujourd’hui par rapport à son historique et à sa moyenne mobile.",
    source: "méthode",
  },
  "sig-var-1m": {
    key: "sig-var-1m",
    term: "Variation 1 mois",
    group: G_SIG_TENDANCES,
    base: "Évolution récente du ratio.",
    technique:
      "Elle montre le mouvement de court terme, mais ne suffit pas à définir le régime. Le régime se lit surtout avec la tendance longue.",
    source: "méthode",
  },
  "sig-var-1a": {
    key: "sig-var-1a",
    term: "Variation 1 an",
    group: G_SIG_TENDANCES,
    base: "Évolution intermédiaire du ratio.",
    technique:
      "Elle permet de voir si le signal récent confirme ou contredit la lecture de long terme.",
    source: "méthode",
  },
  "sig-var-3a5a": {
    key: "sig-var-3a5a",
    term: "Variation 3 ans / 5 ans",
    group: G_SIG_TENDANCES,
    base: "Évolution longue du ratio.",
    technique:
      "Elle aide à comprendre si le mouvement actuel est durable ou simplement temporaire.",
    source: "méthode",
  },

  // ─── Signaux macro — Actifs et interprétation ─────────────────────────────
  "sig-actifs-reels": {
    key: "sig-actifs-reels",
    term: "Actifs réels",
    group: G_SIG_ACTIFS,
    base: "Actifs qui possèdent une valeur économique directe.",
    technique:
      "Ils ne reposent pas uniquement sur une promesse de remboursement. Ils peuvent mieux résister lorsque la devise devient fragile.",
    exemple: "Actions, or, immobilier, énergie, matières premières.",
    source: "glossaire",
  },
  "sig-contrats": {
    key: "sig-contrats",
    term: "Contrats",
    group: G_SIG_ACTIFS,
    base: "Actifs financiers qui reposent sur une promesse.",
    technique:
      "Ils dépendent de la solidité de l’émetteur et de la monnaie utilisée. Ils sont plus protecteurs lorsque la devise est solide.",
    exemple: "Cash, obligations, dépôts bancaires.",
    source: "glossaire",
  },
  "sig-or": {
    key: "sig-or",
    term: "Or",
    group: G_SIG_ACTIFS,
    base: "Actif réel rare, sans risque de faillite.",
    technique:
      "Il ne verse pas de revenu, mais il peut protéger lorsque la monnaie perd de son pouvoir d’achat ou lorsque les obligations ne jouent plus leur rôle défensif.",
    source: "glossaire",
  },
  "sig-obligations-longues": {
    key: "sig-obligations-longues",
    term: "Obligations longues",
    group: G_SIG_ACTIFS,
    base: "Contrats financiers sensibles aux taux d’intérêt.",
    technique:
      "Elles peuvent bien se comporter quand l’inflation baisse et que les taux reculent. Elles souffrent souvent quand l’inflation ou les taux montent.",
    source: "glossaire",
  },
  "sig-energie": {
    key: "sig-energie",
    term: "Énergie",
    group: G_SIG_ACTIFS,
    base: "Intrant essentiel de l’économie.",
    technique:
      "Quand l’énergie devient chère, les coûts augmentent et les marges des entreprises peuvent baisser. Quand elle reste abordable, la croissance est plus facile à maintenir.",
    source: "glossaire",
  },
  "sig-marche-haussier-reel": {
    key: "sig-marche-haussier-reel",
    term: "Marché haussier réel",
    group: G_SIG_ACTIFS,
    base: "Marché actions qui progresse plus vite que l’or.",
    technique:
      "Il ne suffit pas que les actions montent en monnaie courante. Pour parler de vrai marché haussier, elles doivent aussi créer de la valeur par rapport à une réserve de valeur comme l’or.",
    source: "glossaire",
  },
  "sig-illusion-monetaire": {
    key: "sig-illusion-monetaire",
    term: "Illusion monétaire",
    group: G_SIG_ACTIFS,
    base: "Hausse apparente d’un actif due à la perte de valeur de la monnaie.",
    technique:
      "Un actif peut monter en euros ou en dollars sans réellement gagner de pouvoir d’achat. Comparer les actions à l’or permet de repérer cette illusion.",
    source: "glossaire",
  },

  // ─── Browne — Portefeuille & pilotage ───────────────────────────────────────
  "br-browne": {
    key: "br-browne",
    term: "Portefeuille permanent de Browne",
    group: G_BR_PILOTAGE,
    base: "Portefeuille réparti entre actions, obligations longues, cash et or.",
    technique:
      "Dans Quantsightly, il est construit localement pour chaque pays avec quatre poches de 25 % : actions locales, obligations 10 ans, cash local et or converti dans la devise du pays. Son objectif n’est pas de prédire le meilleur actif, mais de rester robuste dans plusieurs environnements économiques.",
    retenir:
      "Le portefeuille Browne cherche la robustesse et la préservation du pouvoir d’achat, pas la performance maximale à tout moment.",
    source: "méthode",
  },
  "br-reequilibrage": {
    key: "br-reequilibrage",
    term: "Rééquilibrage",
    group: G_BR_PILOTAGE,
    base: "Remise des quatre poches du portefeuille à leur poids cible.",
    technique:
      "Le rééquilibrage ramène les actions, obligations, cash et or vers 25 % chacun. Entre deux rééquilibrages, les poids peuvent s’éloigner de 25 % selon la performance de chaque actif.",
    retenir:
      "Rééquilibrer revient souvent à vendre une partie de ce qui a beaucoup monté et à renforcer ce qui a moins bien performé.",
    source: "méthode",
  },
  "br-mode-analyse": {
    key: "br-mode-analyse",
    term: "Mode d’analyse",
    group: G_BR_PILOTAGE,
    base: "Façon de lire les résultats : nominal, réel, ou nominal vs inflation.",
    technique:
      "Le mode nominal montre la performance dans la devise courante. Le mode réel corrige les résultats de l’inflation locale. Le mode nominal vs inflation compare directement la progression du portefeuille à celle du coût de la vie.",
    retenir:
      "Le mode réel est le plus utile pour mesurer la préservation du pouvoir d’achat.",
    source: "méthode",
  },
  "br-periode-backtest": {
    key: "br-periode-backtest",
    term: "Période de backtest",
    group: G_BR_PILOTAGE,
    base: "Période historique utilisée pour calculer les performances et les risques.",
    technique:
      "Une période longue permet de tester le portefeuille dans plusieurs environnements de marché. Une période courte peut être utile, mais elle donne une vision moins robuste.",
    retenir:
      "Plus l’historique est long, plus la lecture est riche ; mais le résultat dépend toujours de la période choisie.",
    source: "méthode",
  },
  "br-devise-analyse": {
    key: "br-devise-analyse",
    term: "Devise d’analyse",
    group: G_BR_PILOTAGE,
    base: "Devise dans laquelle les performances sont exprimées.",
    technique:
      "En devise locale, le portefeuille est analysé comme le verrait un investisseur du pays. En devise commune, les résultats peuvent être convertis dans une devise de référence pour comparer plusieurs pays du point de vue d’un investisseur international.",
    retenir:
      "La devise change fortement la lecture d’un portefeuille international.",
    source: "méthode",
  },

  // ─── Browne — Performance ───────────────────────────────────────────────────
  "br-perf-annualisee": {
    key: "br-perf-annualisee",
    term: "Performance annualisée (CAGR)",
    group: G_BR_PERF,
    base: "Rendement annuel moyen composé sur la période.",
    technique:
      "Elle transforme la performance totale en rythme annuel moyen, en tenant compte de la capitalisation. Elle permet de comparer des périodes de durées différentes.",
    formule: "(Valeur finale / Valeur initiale)^(12 / nombre de mois) − 1",
    retenir: "C’est le rythme moyen de croissance du capital sur la période.",
    source: "glossaire",
  },
  "br-perf-nominale": {
    key: "br-perf-nominale",
    term: "Performance nominale annualisée",
    group: G_BR_PERF,
    base: "Performance annuelle moyenne avant correction de l’inflation.",
    technique:
      "Elle mesure la croissance du capital dans la devise courante. Elle ne dit pas encore si le pouvoir d’achat a réellement augmenté.",
    retenir:
      "La performance nominale montre la progression visible du capital, mais pas son gain réel de pouvoir d’achat.",
    source: "glossaire",
  },
  "br-perf-reelle": {
    key: "br-perf-reelle",
    term: "Performance réelle annualisée",
    group: G_BR_PERF,
    base: "Performance annuelle moyenne après correction de l’inflation.",
    technique:
      "Elle mesure le rendement du portefeuille une fois retirée la hausse des prix. C’est l’indicateur clé pour savoir si le capital a réellement gagné du pouvoir d’achat.",
    formule: "(1 + performance nominale) / (1 + inflation) − 1",
    retenir: "La performance réelle répond à la question : ai-je gagné du pouvoir d’achat ?",
    source: "glossaire",
  },
  "br-perf-cumulee": {
    key: "br-perf-cumulee",
    term: "Performance cumulée (base 100)",
    group: G_BR_PERF,
    base: "Évolution d’un investissement ramené à 100 au début de la période.",
    technique:
      "Une valeur de 250 signifie que le capital a été multiplié par 2,5 depuis le début de la période, soit +150 %. La base 100 facilite la comparaison entre plusieurs séries.",
    retenir:
      "La base 100 permet de comparer visuellement plusieurs trajectoires depuis un même point de départ.",
    source: "glossaire",
  },
  "br-meilleure-annee": {
    key: "br-meilleure-annee",
    term: "Meilleure année",
    group: G_BR_PERF,
    base: "Plus forte performance annuelle observée sur la période.",
    technique:
      "Elle montre le meilleur scénario historique annuel du portefeuille. Elle complète la performance moyenne en montrant les phases très favorables.",
    source: "glossaire",
  },
  "br-pire-annee": {
    key: "br-pire-annee",
    term: "Pire année",
    group: G_BR_PERF,
    base: "Plus mauvaise performance annuelle observée sur la période.",
    technique:
      "Elle montre la plus forte perte ou la plus faible performance observée sur une année civile. C’est une mesure simple du stress historique subi par l’investisseur.",
    retenir:
      "La pire année donne une idée concrète de ce que l’investisseur aurait pu vivre sur douze mois.",
    source: "glossaire",
  },

  // ─── Browne — Risque ────────────────────────────────────────────────────────
  "br-volatilite": {
    key: "br-volatilite",
    term: "Volatilité annualisée",
    group: G_BR_RISQUE,
    base: "Amplitude habituelle des variations du portefeuille sur une base annuelle.",
    technique:
      "Elle est calculée à partir des rendements mensuels, puis annualisée. Plus elle est élevée, plus la valeur du portefeuille fluctue fortement.",
    formule: "Écart-type des rendements mensuels × √12",
    retenir: "La volatilité mesure l’ampleur des variations, pas seulement les pertes.",
    source: "glossaire",
  },
  "br-max-drawdown": {
    key: "br-max-drawdown",
    term: "Max drawdown",
    group: G_BR_RISQUE,
    base: "Pire perte observée entre un sommet historique et le point bas suivant.",
    technique:
      "Le max drawdown mesure la plus forte baisse subie avant de retrouver un nouveau sommet. C’est l’une des mesures les plus concrètes du risque vécu par l’investisseur.",
    formule: "Valeur / plus haut historique − 1",
    retenir: "Le max drawdown répond à la question : combien aurais-je pu perdre au pire ?",
    source: "glossaire",
  },
  "br-max-drawdown-nominal": {
    key: "br-max-drawdown-nominal",
    term: "Max drawdown nominal",
    group: G_BR_RISQUE,
    base: "Max drawdown calculé avant correction de l’inflation.",
    technique:
      "Il mesure la pire perte visible dans la devise courante. Il ne tient pas compte de la perte de pouvoir d’achat due à l’inflation.",
    source: "glossaire",
  },
  "br-drawdown-courant": {
    key: "br-drawdown-courant",
    term: "Drawdown courant",
    group: G_BR_RISQUE,
    base: "Perte actuelle depuis le dernier plus haut historique.",
    technique:
      "Il indique à quel point le portefeuille est aujourd’hui sous son précédent sommet. Un drawdown courant de -5 % signifie que le portefeuille doit encore remonter d’environ 5,3 % pour retrouver son ancien sommet.",
    retenir: "Le drawdown courant mesure la baisse en cours, pas la pire baisse historique.",
    source: "glossaire",
  },
  "br-duree-sous-eau": {
    key: "br-duree-sous-eau",
    term: "Durée max sous l’eau",
    group: G_BR_RISQUE,
    base: "Plus longue période passée sous un précédent sommet.",
    technique:
      "Cette mesure indique combien de temps le portefeuille a mis, au maximum, pour retrouver un plus haut historique après une baisse.",
    retenir:
      "Deux portefeuilles peuvent avoir le même drawdown, mais l’un peut récupérer beaucoup plus lentement.",
    source: "glossaire",
  },
  "br-reduction-drawdown": {
    key: "br-reduction-drawdown",
    term: "Réduction de drawdown",
    group: G_BR_VS_ACTIONS,
    base: "Baisse maximale évitée par Browne par rapport aux actions locales.",
    technique:
      "Elle compare la pire perte du portefeuille Browne à celle de l’indice actions local. Une valeur positive signifie que Browne a mieux protégé le capital.",
    formule: "|Max DD actions| − |Max DD Browne|",
    retenir: "Plus la réduction est élevée, plus Browne a protégé contre les pertes profondes.",
    source: "méthode",
  },

  // ─── Browne — Rendement-risque ──────────────────────────────────────────────
  "br-sharpe": {
    key: "br-sharpe",
    term: "Ratio de Sharpe",
    group: G_BR_RR,
    base: "Rendement obtenu au-dessus du cash, par unité de volatilité.",
    technique:
      "Le Sharpe ne se calcule pas en divisant simplement la performance par la volatilité. On retire d’abord le rendement du cash local, puis on divise ce rendement excédentaire par la volatilité.",
    formule: "(rendement annualisé − rendement du cash local) / volatilité annualisée",
    retenir: "Le Sharpe mesure la rémunération du risque par rapport au cash de la même devise.",
    source: "glossaire",
  },
  "br-robustesse": {
    key: "br-robustesse",
    term: "Robustesse Browne",
    group: G_BR_RR,
    base: "Score de 0 à 100 qui résume la qualité du portefeuille Browne dans un pays.",
    technique:
      "Le score est calculé sur la courbe réelle, corrigée de l’inflation. Il combine cinq sous-scores : rendement réel, max drawdown réel, volatilité réelle, durée sous l’eau et régularité. Chaque composante est d’abord ramenée sur 0–100, puis pondérée.",
    formule:
      "30 % rendement réel + 25 % drawdown réel + 15 % volatilité réelle + 15 % durée sous l’eau + 15 % régularité",
    retenir:
      "La robustesse mesure la qualité du parcours, pas seulement la performance finale. La qualité des données reste affichée séparément.",
    source: "méthode",
  },

  // ─── Browne — Inflation & pouvoir d’achat ───────────────────────────────────
  "br-inflation-annualisee": {
    key: "br-inflation-annualisee",
    term: "Inflation annualisée",
    group: G_BR_INFLATION,
    base: "Hausse annuelle moyenne des prix sur la période.",
    technique:
      "Elle mesure l’érosion moyenne du pouvoir d’achat de la monnaie. Elle est calculée à partir de l’indice des prix à la consommation local.",
    formule: "(CPI final / CPI initial)^(12 / nombre de mois) − 1",
    retenir: "L’inflation est le seuil minimum à battre pour préserver le pouvoir d’achat.",
    source: "glossaire",
  },
  "br-ecart-inflation": {
    key: "br-ecart-inflation",
    term: "Écart annuel vs inflation",
    group: G_BR_INFLATION,
    base: "Différence entre la performance nominale annualisée et l’inflation annualisée.",
    technique:
      "Il est affiché en points de pourcentage. Un écart positif signifie que le portefeuille progresse plus vite que le coût de la vie.",
    formule: "Performance nominale annualisée − inflation annualisée",
    retenir: "Un écart positif indique que le portefeuille bat l’inflation.",
    source: "méthode",
  },
  "br-pouvoir-achat": {
    key: "br-pouvoir-achat",
    term: "Pouvoir d’achat",
    group: G_BR_INFLATION,
    base: "Capacité du capital à acheter des biens et services après inflation.",
    technique:
      "Un portefeuille protège le pouvoir d’achat s’il progresse plus vite que l’inflation locale. C’est une lecture plus économique que la simple performance nominale.",
    retenir: "Gagner en nominal ne suffit pas : il faut aussi battre l’inflation.",
    source: "glossaire",
  },
  "br-multiple-portefeuille": {
    key: "br-multiple-portefeuille",
    term: "Multiple portefeuille",
    group: G_BR_INFLATION,
    base: "Facteur par lequel le capital nominal a été multiplié.",
    technique:
      "Un multiple de 10× signifie que le capital nominal est devenu dix fois plus élevé sur la période.",
    retenir: "C’est une mesure cumulée, pas annualisée.",
    source: "glossaire",
  },
  "br-multiple-inflation": {
    key: "br-multiple-inflation",
    term: "Multiple inflation",
    group: G_BR_INFLATION,
    base: "Facteur par lequel les prix ont été multipliés.",
    technique:
      "Un multiple de 4× signifie que le niveau général des prix a été multiplié par quatre sur la période.",
    retenir: "Il montre combien le coût de la vie a augmenté.",
    source: "glossaire",
  },
  "br-multiple-reel": {
    key: "br-multiple-reel",
    term: "Multiple réel",
    group: G_BR_INFLATION,
    base: "Facteur de multiplication du capital après correction de l’inflation.",
    technique:
      "Il indique combien le pouvoir d’achat du capital a réellement été multiplié sur la période.",
    retenir: "C’est le multiple le plus parlant pour mesurer l’enrichissement réel.",
    source: "glossaire",
  },

  // ─── Browne — Comparaison & sources ─────────────────────────────────────────
  "br-comparaison-actions": {
    key: "br-comparaison-actions",
    term: "Comparaison Browne vs Actions",
    group: G_BR_COMPARAISON,
    base: "Comparaison entre le portefeuille Browne et l’indice actions local.",
    technique:
      "Elle permet de voir si Browne offre plus de stabilité, moins de drawdown ou un meilleur rendement-risque que les actions locales.",
    retenir: "La question n’est pas seulement : qui gagne le plus ? Mais aussi : à quel risque ?",
    source: "méthode",
  },
  "br-contribution": {
    key: "br-contribution",
    term: "Sources de performance",
    group: G_BR_COMPARAISON,
    base: "Répartition des contributions des quatre poches à la performance du portefeuille.",
    technique:
      "Les contributions montrent quels actifs ont le plus porté le portefeuille : actions, obligations, cash ou or. Elles sont calculées à partir des rendements de chaque poche et de leurs poids dans le portefeuille.",
    retenir:
      "Cette mesure montre d’où vient la performance, sans représenter exactement la part du gain final capitalisé.",
    source: "méthode",
  },

  // ─── Browne vs Actions ──────────────────────────────────────────────────────
  "br-vs-actions": {
    key: "br-vs-actions",
    term: "Browne vs Actions",
    group: G_BR_VS_ACTIONS,
    base: "Analyse du compromis entre Browne et l’indice actions local.",
    technique:
      "Cette approche compare, pays par pays, le rendement réel, la volatilité, le drawdown et le Sharpe du portefeuille Browne avec ceux des actions locales.",
    retenir:
      "Elle répond à la question : Browne améliore-t-il l’expérience de l’investisseur par rapport aux actions ?",
    source: "méthode",
  },
  "br-ecart-rendement": {
    key: "br-ecart-rendement",
    term: "Écart de rendement",
    group: G_BR_VS_ACTIONS,
    base: "Différence de rendement entre Browne et les actions locales.",
    technique:
      "Un écart positif signifie que Browne a fait mieux que les actions en rendement annualisé. Un écart négatif signifie qu’il a moins rapporté.",
    formule: "CAGR Browne − CAGR actions",
    retenir: "C’est le gain ou le coût en rendement par rapport aux actions.",
    source: "méthode",
  },
  "br-ecart-volatilite": {
    key: "br-ecart-volatilite",
    term: "Écart de volatilité",
    group: G_BR_VS_ACTIONS,
    base: "Différence de volatilité entre Browne et les actions locales.",
    technique:
      "Un écart négatif signifie que Browne a été moins volatil que les actions. C’est généralement favorable, car le parcours a été moins agité.",
    formule: "Volatilité Browne − volatilité actions",
    retenir: "Un écart négatif indique un portefeuille plus stable que les actions.",
    source: "méthode",
  },
  "br-ecart-sharpe": {
    key: "br-ecart-sharpe",
    term: "Écart de Sharpe",
    group: G_BR_VS_ACTIONS,
    base: "Différence entre le Sharpe de Browne et celui des actions locales.",
    technique:
      "Un écart positif signifie que Browne a offert un meilleur rendement excédentaire par unité de volatilité.",
    formule: "Sharpe Browne − Sharpe actions",
    retenir: "Il mesure si Browne améliore le couple rendement-risque.",
    source: "méthode",
  },
  "br-verdict": {
    key: "br-verdict",
    term: "Profil Browne vs Actions",
    group: G_BR_VS_ACTIONS,
    base: "Catégorie qui qualifie le compromis entre Browne et les actions locales.",
    technique:
      "Le profil n’est pas un jugement absolu. Il décrit le type de compromis observé : supérieur aux actions, excellent compromis, protecteur, compromis modéré, protection limitée ou profil atypique.",
    retenir:
      "Un profil « Protecteur » peut être positif : il signifie que Browne rend moins que les actions, mais réduit fortement les pertes.",
    source: "méthode",
  },
  "br-regularite": {
    key: "br-regularite",
    term: "Régularité par horizon",
    group: G_BR_VS_ACTIONS,
    base: "Pourcentage de périodes où Browne atteint un objectif donné.",
    technique:
      "Deux mesures existent : « bat l’inflation », qui indique les périodes où Browne gagne du pouvoir d’achat, et « bat les actions », qui indique les périodes où Browne fait mieux que l’indice actions local. Les horizons peuvent être 1, 3, 5, 10 ou 20 ans.",
    formule: "Nombre de périodes réussies / nombre total de périodes observées",
    retenir:
      "Cette mesure montre si le résultat est régulier dans le temps, et pas seulement bon sur la période complète.",
    source: "méthode",
  },

  // ─── Browne — Données & graphes ─────────────────────────────────────────────
  "br-proxy-structurel": {
    key: "br-proxy-structurel",
    term: "Proxy structurel",
    group: G_BR_DONNEES,
    base: "Série reconstruite lorsqu’une série directement exploitable n’est pas disponible.",
    technique:
      "Un proxy structurel n’est pas une anomalie. C’est une méthode standard et documentée, notamment pour reconstruire certaines séries d’obligations 10 ans ou de cash.",
    retenir:
      "Proxy structurel signifie approximation méthodologique normale, pas donnée de mauvaise qualité.",
    source: "méthode",
  },
  "br-qualite-donnees": {
    key: "br-qualite-donnees",
    term: "Qualité des données",
    group: G_BR_DONNEES,
    base: "Indication sur la manière dont chaque série a été obtenue.",
    technique:
      "La qualité des données distingue les séries de référence, observées, converties, reconstruites par proxy structurel ou utilisées en repli. Elle permet de savoir à quel point les résultats reposent sur des données directement adaptées au modèle.",
    retenir: "La qualité des données est affichée séparément du score de robustesse.",
    source: "méthode",
  },
  "br-echelle-log": {
    key: "br-echelle-log",
    term: "Échelle logarithmique",
    group: G_BR_DONNEES,
    base: "Échelle qui compare mieux les variations en pourcentage sur longue période.",
    technique:
      "Sur une échelle logarithmique, une hausse de 100 à 200 occupe le même espace qu’une hausse de 1 000 à 2 000, car ce sont deux hausses de +100 %. Elle est souvent plus adaptée aux graphiques de performance longue durée.",
    retenir:
      "Logarithmique = meilleure lecture des rythmes de croissance ; linéaire = meilleure lecture des écarts de niveau.",
    source: "glossaire",
  },
};

/** Entrées demandées, dans l'ordre des clés (clés inconnues ignorées). */
export function getGlossaryEntries(keys: string[]): GlossaryEntry[] {
  return keys.map((k) => ENTRIES[k]).filter((e): e is GlossaryEntry => e !== undefined);
}

/**
 * Entrées demandées regroupées par thème. L'ordre des sections suit la 1ʳᵉ
 * apparition d'un thème dans `keys` (chaque page pilote quel thème mène via
 * l'ordre de sa liste). Ordre interne = ordre des clés.
 */
export function getGroupedGlossaryEntries(
  keys: string[],
): { group: string; entries: GlossaryEntry[] }[] {
  const groups: { group: string; entries: GlossaryEntry[] }[] = [];
  for (const e of getGlossaryEntries(keys)) {
    let g = groups.find((x) => x.group === e.group);
    if (!g) {
      g = { group: e.group, entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}
