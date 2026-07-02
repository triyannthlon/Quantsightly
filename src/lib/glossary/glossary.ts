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
