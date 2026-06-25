// Signaux macro canoniques (Gave / Darcet). Chaque signal = ratio de 2 séries
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
      "Ce ratio mesure si le marché actions crée plus de valeur que le coût de l'énergie. Quand le ratio S&P 500 / WTI monte, les actions surperforment le pétrole.",
    numerator: "SPX Index-US-1-1",
    denominator: "CL1 comdty-XX-5-1",
    maYears: 7,
    threshold: 0.05,
    economic: {
      positive: { label: "Efficacité +", tone: "positive" },
      negative: { label: "Efficacité −", tone: "negative" },
    },
    interpretation: {
      positive:
        "L'efficacité énergétique reste favorable : le marché crée plus de valeur par baril de pétrole que sa tendance longue. Le régime reste porteur pour les actifs de croissance.",
      negative:
        "L'efficacité énergétique se dégrade : il faut plus d'énergie pour soutenir le marché que sur sa tendance longue. Le modèle lit un ralentissement.",
      transition:
        "Le ratio est proche de sa moyenne mobile 7 ans : l'efficacité énergétique n'envoie pas de signal net. Le modèle attend une confirmation avant de modifier la lecture du régime.",
    },
  },
  {
    id: "ust10-gold",
    title: "Obligations 10 ans US / Or",
    meaning: "Qualité de la devise",
    tooltip:
      "Ce ratio compare les obligations longues à l'or. Si l'or surperforme les obligations, les contrats jouent moins bien leur rôle de réserve de valeur.",
    valueNote: "Le signal utilise le rendement total des obligations longues, pas le taux 10 ans seul.",
    numerator: "GT10 Govt-US-4-2",
    denominator: "XAU Comdty-XX-5-1",
    maYears: 7,
    threshold: 0.03,
    economic: {
      positive: { label: "Devise +", tone: "positive" },
      negative: { label: "Devise −", tone: "negative" },
    },
    interpretation: {
      positive:
        "Les obligations battent l'or sur la tendance longue : les contrats jouent encore leur rôle de réserve de valeur. La qualité de la devise tient.",
      negative:
        "L'or surperforme les obligations : les contrats protègent moins bien que l'actif de rareté. La qualité de la devise se dégrade.",
      transition:
        "Le ratio obligations / or est proche de sa moyenne 7 ans : la qualité de la devise est en zone de transition. Les contrats ne confirment ni une protection nette ni une détérioration franche.",
    },
  },
  {
    id: "spx-gold",
    title: "S&P 500 / Or",
    meaning: "Marché haussier réel",
    tooltip:
      "Ce ratio mesure les actions en termes d'or. Un vrai marché haussier suppose que les actions progressent aussi face à l'or, pas seulement en monnaie nominale.",
    numerator: "SPX Index-US-1-1",
    denominator: "XAU Comdty-XX-5-1",
    maYears: 7,
    threshold: 0.03,
    economic: {
      positive: { label: "Actions / Or +", tone: "positive" },
      negative: { label: "Actions / Or −", tone: "negative" },
    },
    interpretation: {
      positive:
        "Les actions progressent aussi face à l'or : le marché haussier réel est confirmé, pas seulement nominal.",
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
      "Ce ratio mesure combien de pétrole une once d'or permet d'acheter. Il indique si l'énergie est chère ou bon marché par rapport à l'or.",
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
        "L'énergie devient chère en termes d'or : le modèle détecte une tension pétrolière relative, souvent associée aux pressions inflationnistes.",
      transition:
        "Le prix relatif de l'énergie est proche de sa tendance longue : le signal ne confirme pas encore de choc énergétique ni d'énergie clairement bon marché.",
    },
  },
];
