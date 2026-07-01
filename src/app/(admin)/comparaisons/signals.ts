// Signaux économiques canoniques (Gave / Darcet). Chaque signal = ratio de 2 séries
// coredata + MM 7 ans + bande de neutralité (zone de transition) + phrases.
//
// PRINCIPE PRODUIT : quand le ratio est collé à sa MM7, on ne force pas un
// signal positif/négatif. On affiche une « zone de transition », on conserve le
// dernier signal confirmé et on réduit la confiance du régime. Quantsightly ne
// donne pas de fausse précision.
//
// NOTE (DIRECTION PRODUIT) : les phrases sont aussi le canal vocal du futur
// agent IA. Elles expliquent, elles ne conseillent pas.

export type SignalEconomic = {
  label: string;
  tone: "positive" | "negative" | "neutral";
};

export interface MacroSignal {
  id: string;
  title: string;
  meaning: string;
  tooltip: string;
  valueNote?: string;
  numerator: string;
  denominator: string;
  maYears: number;
  /** Demi-largeur de la bande de neutralité (écart relatif à la MM7). 0.05 = ±5 %. */
  threshold: number;
  /** Libellés économiques directionnels (au-dessus / en-dessous de la bande). */
  economic: { positive: SignalEconomic; negative: SignalEconomic };
  /** Phrases d'interprétation selon l'état affiché. */
  interpretation: { positive: string; negative: string; transition: string };
}

/** Badge économique de la zone de transition (commun à tous les signaux). */
export const TRANSITION_ECONOMIC: SignalEconomic = { label: "Zone de transition", tone: "neutral" };

export const MACRO_SIGNALS: MacroSignal[] = [
  {
    id: "spx-wti",
    title: "S&P 500 / WTI",
    meaning: "Efficacité énergétique",
    tooltip:
      "Ce ratio mesure si le marché actions crée plus de valeur que le coût de l'énergie. Quand le ratio S&P 500 / WTI monte, les actions surperforment le pétrole : l'économie transforme l'énergie en valeur de manière plus efficace. Quand il baisse, le coût de l'énergie pèse davantage sur le marché actions.",
    numerator: "SPX Index-US-1-1",
    denominator: "CL1 comdty-XX-5-1",
    maYears: 7,
    threshold: 0.05,
    economic: {
      positive: { label: "Énergie efficace", tone: "positive" },
      negative: { label: "Énergie moins efficace", tone: "negative" },
    },
    interpretation: {
      positive:
        "L'efficacité énergétique reste favorable : le marché actions crée plus de valeur par baril de pétrole que sa tendance longue. Le régime reste porteur pour les actifs de croissance.",
      negative:
        "L'efficacité énergétique se dégrade : le coût de l'énergie pèse davantage sur le marché actions que sa tendance longue. Le modèle lit un risque de ralentissement.",
      transition:
        "Le ratio est proche de sa moyenne mobile 7 ans : l'efficacité énergétique n'envoie pas de signal net. Le modèle attend une confirmation avant de modifier la lecture du régime.",
    },
  },
  {
    id: "ust10-gold",
    title: "Obligations 10 ans US / Or",
    meaning: "Qualité de la devise",
    tooltip:
      "Ce ratio mesure si les obligations longues protègent mieux que l'or. Il permet de savoir si les contrats financiers jouent encore leur rôle de réserve de valeur. Quand le ratio monte, les obligations protègent mieux que l'or. Quand il baisse, l'or devient plus protecteur que les obligations.",
    valueNote:
      "Le signal utilise le rendement total des obligations longues, coupons réinvestis, et non le taux 10 ans seul.",
    numerator: "GT10 Govt-US-4-2",
    denominator: "XAU Comdty-XX-5-1",
    maYears: 7,
    threshold: 0.03,
    economic: {
      positive: { label: "Devise protectrice", tone: "positive" },
      negative: { label: "Devise moins protectrice", tone: "negative" },
    },
    interpretation: {
      positive:
        "Les obligations longues surperforment l'or : les contrats jouent encore leur rôle de réserve de valeur. La devise reste protectrice.",
      negative:
        "L'or surperforme les obligations longues : les contrats protègent moins bien que l'actif de rareté. La devise devient moins protectrice.",
      transition:
        "Le ratio obligations longues / or est proche de sa moyenne mobile 7 ans : la qualité de la devise est en zone de transition. Les contrats ne confirment ni une protection nette ni une détérioration franche.",
    },
  },
  {
    id: "spx-gold",
    title: "S&P 500 / Or",
    meaning: "Marché haussier réel",
    tooltip:
      "Ce ratio mesure si les actions progressent réellement par rapport à l'or. Il permet d'éviter l'illusion monétaire : un marché peut monter en dollars sans forcément gagner en pouvoir d'achat. Pour confirmer un vrai marché haussier, les actions doivent aussi progresser face à l'or.",
    numerator: "SPX Index-US-1-1",
    denominator: "XAU Comdty-XX-5-1",
    maYears: 7,
    threshold: 0.03,
    economic: {
      positive: { label: "Actions devant l'or", tone: "positive" },
      negative: { label: "Actions en retrait face à l'or", tone: "negative" },
    },
    interpretation: {
      positive:
        "Les actions progressent face à l'or : le marché haussier réel est confirmé, et pas seulement nominal.",
      negative:
        "Les actions perdent du terrain face à l'or : le marché haussier réel manque de confirmation.",
      transition:
        "Les actions sont proches de leur tendance longue face à l'or : le marché haussier réel n'est ni confirmé ni invalidé.",
    },
  },
  {
    id: "gold-wti",
    title: "Or / WTI",
    meaning: "Prix relatif de l'énergie",
    tooltip:
      "Ce ratio mesure combien de pétrole une once d'or permet d'acheter. Quand le ratio monte, l'énergie devient moins chère en termes d'or. Quand il baisse, l'énergie devient plus chère en termes d'or. Ce signal aide à détecter une tension énergétique relative.",
    numerator: "XAU Comdty-XX-5-1",
    denominator: "CL1 comdty-XX-5-1",
    maYears: 7,
    threshold: 0.05,
    economic: {
      positive: { label: "Énergie bon marché", tone: "positive" },
      negative: { label: "Énergie chère", tone: "negative" },
    },
    interpretation: {
      positive:
        "L'énergie reste bon marché en termes d'or : le modèle ne détecte pas encore de choc pétrolier relatif. Attention toutefois : la hausse du ratio peut aussi refléter une forte demande d'or.",
      negative:
        "L'énergie devient chère en termes d'or : le modèle détecte une tension pétrolière relative, souvent associée à des pressions inflationnistes.",
      transition:
        "Le prix relatif de l'énergie est proche de sa tendance longue : le signal ne confirme ni choc énergétique, ni énergie clairement bon marché.",
    },
  },
];
