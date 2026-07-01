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
  source: "glossaire" | "méthode";
}

const G_REGIME = "Régime macro";
const G_ACTIFS = "Nature des actifs";
const G_SIGNAUX = "Calcul des signaux";

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
      "Proxy utilisé : or / obligations 10 ans. Si l’or surperforme les obligations, le marché signale une perte de pouvoir d’achat de la monnaie ou une hausse du risque inflationniste. Ce n’est pas l’inflation officielle.",
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
