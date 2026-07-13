"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ROBUSTNESS_TONE,
  VERDICT_ORDER,
  VERDICT_TONE,
  VERDICT_DESC,
  type BrowneVerdict,
} from "./helpers";

// Ordre d'ÉVALUATION des règles de profil (première remplie l'emporte).
const RULE_ORDER: BrowneVerdict[] = [
  "Supérieur aux actions",
  "Excellent compromis",
  "Protecteur",
  "Profil atypique",
  "Protection limitée",
  "Compromis modéré",
];
const PROFILE_RULES: Record<BrowneVerdict, string> = {
  "Supérieur aux actions": "écart rendement ≥ 0 · réduction drawdown ≥ 5 pts · écart volatilité ≤ 0",
  "Excellent compromis": "écart rendement ≥ −1,5 pt · réduction drawdown ≥ 20 pts · écart volatilité ≤ −3 pts",
  Protecteur: "écart rendement < −1,5 pt · réduction drawdown ≥ 20 pts",
  "Profil atypique": "écart rendement > 0 ET (réduction drawdown < 0 OU écart volatilité > 0)",
  "Protection limitée": "écart rendement < 0 · réduction drawdown < 10 pts",
  "Compromis modéré": "tous les autres cas",
};

// ─── Petits blocs réutilisables ──────────────────────────────────────────────

/** Bloc formule (monospace, scrollable, retours à la ligne préservés). */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre text-foreground/90">
      {children}
    </div>
  );
}

/** Sous-carte d'une formule : intitulé + phrase d'intuition + contenu (formule, détail). */
function Sub({
  title,
  intuition,
  children,
}: {
  title: string;
  intuition?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/[0.12] p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {intuition && <p className="mt-0.5 text-xs text-muted-foreground italic">{intuition}</p>}
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 gap-0 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </Card>
  );
}

/** Tableau simple (entêtes + lignes). Cellules = texte ou nœud. */
function DocTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={cn("px-3 py-2 align-top", j === 0 && "font-medium text-foreground")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualityBadge({
  children,
  className,
  w = "min-w-[6.5rem]",
}: {
  children: React.ReactNode;
  className?: string;
  w?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border px-2 py-0.5 text-center text-[11px] font-medium whitespace-nowrap",
        w,
        className,
      )}
    >
      {children}
    </span>
  );
}

const NAV = [
  { id: "meth-overview", label: "Vue d’ensemble" },
  { id: "meth-formules", label: "Formules" },
  { id: "meth-hypotheses", label: "Hypothèses" },
  { id: "meth-donnees", label: "Données" },
  { id: "meth-limites", label: "Limites" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export function BrowneMethodology() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-4">
      {/* Résumé + navigation */}
      <Card className="gap-0 border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent p-5">
        <p className="text-sm leading-relaxed">
          La méthodologie Browne de Quantsightly vise à comparer, pays par pays, la robustesse
          historique d’un portefeuille permanent local 25/25/25/25. Elle met l’accent sur le
          rendement réel, la stabilité, la protection contre les pertes et la régularité dans le
          temps.
        </p>
        <div className="mt-4 rounded-lg border border-primary/20 bg-background/40 p-3">
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">À retenir</div>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            Le portefeuille Browne ne cherche pas à battre les actions dans toutes les périodes. Il
            cherche à produire un rendement réel régulier, avec des pertes plus limitées et une
            meilleure résistance aux régimes économiques difficiles.
          </p>
        </div>
        <nav className="mt-4 flex flex-wrap gap-1.5">
          {NAV.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className="cursor-pointer rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </nav>
      </Card>

      {/* 1 — Méthodologie */}
      <Section id="meth-overview" n={1} title="Méthodologie">
        <p>
          Le module Browne construit, pour chaque pays, un portefeuille permanent local inspiré de
          Harry Browne. Chaque portefeuille est composé de quatre poches équipondérées :
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>25 % actions locales</li>
          <li>25 % obligations souveraines 10 ans</li>
          <li>25 % cash local — c’est-à-dire liquidités ou placement monétaire court terme dans la devise du pays</li>
          <li>25 % or converti dans la devise locale</li>
        </ul>
        <p>
          L’objectif n’est pas de battre systématiquement les actions, mais de mesurer la capacité
          d’un portefeuille diversifié à produire du rendement réel, à réduire les pertes maximales
          et à préserver le pouvoir d’achat dans différents environnements économiques.
        </p>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Lecture rapide</h3>
          <DocTable
            head={["Poche", "Rôle économique"]}
            rows={[
              ["Actions", "Captent la croissance économique et les marchés haussiers."],
              ["Obligations 10 ans", "Protègent surtout dans les phases de désinflation ou de baisse des taux."],
              ["Cash / liquidités", "Stabilise le portefeuille et réduit la volatilité."],
              ["Or", "Protège contre la perte de pouvoir d’achat, les crises monétaires et certains chocs inflationnistes."],
            ]}
          />
        </div>
      </Section>

      {/* 2 — Formules */}
      <Section id="meth-formules" n={2} title="Formules">
        <Sub title="Rendement mensuel" intuition="Le point de départ : de combien la série a bougé d’un mois à l’autre.">
          <Formula>{`rₜ = Pₜ / Pₜ₋₁ − 1`}</Formula>
          <p>
            Pour les séries de prix (ou de prix coupons réinvestis), le rendement mensuel est la
            variation entre deux observations mensuelles consécutives.
          </p>
        </Sub>

        <Sub title="Rendement du portefeuille Browne" intuition="Le portefeuille avance comme la moyenne pondérée de ses quatre poches.">
          <Formula>{`r_Browne,ₜ = w_Actions,ₜ·r_Actions,ₜ + w_Obligations,ₜ·r_Obligations,ₜ + w_Cash,ₜ·r_Cash,ₜ + w_Or,ₜ·r_Or,ₜ`}</Formula>
          <p>
            Au rééquilibrage, chaque poids wₖ est remis à 25 % ; entre deux rééquilibrages, les poids
            dérivent selon la performance des actifs. En rééquilibrage mensuel, cela revient à :
          </p>
          <Formula>{`r_Browne,ₜ = 0,25·r_Actions,ₜ + 0,25·r_Obligations,ₜ + 0,25·r_Cash,ₜ + 0,25·r_Or,ₜ`}</Formula>
        </Sub>

        <Sub title="Performance cumulée (base 100)" intuition="Une façon de lire toutes les courbes sur la même échelle, en partant de 100.">
          <Formula>{`Indexₜ = 100 × ∏ (1 + rₜ)`}</Formula>
          <p>
            Les courbes sont affichées en base 100. Une valeur de 250 signifie que le capital a été
            multiplié par 2,5 depuis le début de la période.
          </p>
        </Sub>

        <Sub title="Performance annualisée (CAGR)" intuition="Cette formule transforme une performance totale en rythme annuel moyen.">
          <Formula>{`CAGR = (Valeur finale / Valeur initiale)^(12 / nb de mois) − 1`}</Formula>
          <p>Le rythme moyen de croissance du portefeuille, en tenant compte de la capitalisation.</p>
        </Sub>

        <Sub title="Performance réelle" intuition="On retire l’effet de l’inflation pour ne garder que le vrai gain de pouvoir d’achat.">
          <Formula>{`Indice réelₜ = Indice nominalₜ / Indice CPIₜ
r_réel,ₜ     = (1 + r_nominal,ₜ) / (1 + inflationₜ) − 1`}</Formula>
          <p>
            La performance réelle corrige la performance nominale de l’inflation locale : elle mesure
            l’évolution du pouvoir d’achat du portefeuille.
          </p>
        </Sub>

        <Sub title="Inflation annualisée" intuition="Le rythme moyen de hausse des prix sur la période.">
          <Formula>{`Inflation annualisée = (CPI_final / CPI_initial)^(12 / nb de mois) − 1`}</Formula>
        </Sub>

        <Sub title="Écart annuel vs inflation" intuition="De combien le portefeuille bat (ou non) l’inflation, chaque année.">
          <Formula>{`Écart annuel vs inflation = Perf. nominale annualisée − Inflation annualisée   (en points)
Perf. réelle annualisée   = (1 + perf. nom. ann.) / (1 + inflation ann.) − 1   (calcul exact)`}</Formula>
          <p>
            L’<em>écart annuel vs inflation</em> est affiché en points de pourcentage ; la
            <em> performance réelle</em> utilise le calcul composé exact.
          </p>
        </Sub>

        <Sub title="Drawdown" intuition="Cette formule mesure la perte depuis le dernier sommet atteint par le portefeuille.">
          <Formula>{`Drawdownₜ = Valeurₜ / Plus haut historiqueₜ − 1`}</Formula>
          <p>
            Perte depuis le dernier sommet historique. Le <strong>max drawdown</strong> est la plus
            forte perte observée sur la période.
          </p>
        </Sub>

        <Sub title="Durée max sous l’eau" intuition="Combien de temps il faut pour effacer une baisse et retrouver un sommet.">
          <p>
            La plus longue période pendant laquelle le portefeuille reste sous son précédent sommet —
            le temps maximal nécessaire pour retrouver un plus haut historique après une baisse.
          </p>
        </Sub>

        <Sub title="Volatilité annualisée" intuition="L’amplitude des variations mensuelles, ramenée à l’année.">
          <Formula>{`Volatilité annualisée = écart-type des rendements mensuels × √12`}</Formula>
        </Sub>

        <Sub title="Régularité" intuition="À quelle fréquence Browne atteint son objectif sur les périodes glissantes.">
          <Formula>{`Régularité = nb de périodes positives en réel / nb total de périodes observées`}</Formula>
          <p>
            Pour la mesure « bat les actions », on compte les périodes où Browne <strong>surperforme
            l’indice actions local</strong> (au lieu des périodes à rendement réel positif).
          </p>
        </Sub>

        <Sub title="Ratio de Sharpe (excédent sur le cash local)" intuition="Cette formule mesure ce que le portefeuille rapporte au-dessus du cash, par unité de risque.">
          <p>
            Le ratio de Sharpe mesure le rendement obtenu <strong>au-dessus du cash</strong>, par
            unité de volatilité. Il ne s’agit pas de diviser simplement la performance par la
            volatilité : le rendement du cash local est d’abord retiré.
          </p>
          <Formula>{`Sharpe = (rendement annualisé − rendement annualisé du cash local) / volatilité annualisée

Sharpe Browne  = (CAGR Browne  − CAGR cash local) / volatilité annualisée du Browne
Sharpe actions = (CAGR actions − CAGR cash local) / volatilité annualisée des actions`}</Formula>
          <p>
            Le taux sans risque est le <strong>rendement de la poche cash dans la devise du pays</strong>,
            sur la même période que le backtest. <strong>En mode nominal</strong>, le Sharpe utilise le
            cash nominal local ; <strong>en mode réel</strong>, le cash réel local (corrigé de
            l’inflation). Cette convention permet la comparaison internationale : un pays au cash très
            rémunérateur n’est pas évalué comme un pays au cash quasi nul.
          </p>
        </Sub>

        <Sub title="Score de robustesse Browne" intuition="Une note de qualité globale : pas seulement la performance, mais aussi la stabilité du chemin.">
          <p>
            Le score (0–100) est calculé <strong>entièrement sur la courbe réelle</strong>. Il ne
            récompense pas seulement la performance : il pénalise aussi la volatilité, les pertes
            profondes, les longues périodes sous l’eau et le manque de régularité.
          </p>
          <p>
            Un pays peut donc afficher un rendement réel élevé mais un score plus faible si le chemin
            est trop volatil, si les pertes sont profondes ou si le temps de récupération est long.
          </p>
          <Formula>{`Score = 30 %·score_rendement_réel + 25 %·score_drawdown_réel
      + 15 %·score_volatilité_réelle + 15 %·score_durée_sous_l’eau + 15 %·score_régularité`}</Formula>
          <p>
            Chaque <code className="font-mono">score_…</code> est la composante correspondante d’abord
            transformée en <strong>sous-score de 0 à 100</strong> (interpolation linéaire bornée entre
            les deux seuils ci-dessous), puis pondérée.
          </p>
          <DocTable
            head={["Composante", "Poids", "Ce que cela mesure"]}
            rows={[
              ["Rendement réel", "30 %", "Gain de pouvoir d’achat"],
              ["Max drawdown réel", "25 %", "Protection contre les pertes profondes"],
              ["Volatilité réelle", "15 %", "Amplitude des variations après inflation"],
              ["Durée sous l’eau", "15 %", "Temps de récupération"],
              ["Régularité", "15 %", "Fréquence des périodes positives en réel"],
            ]}
          />
          <p className="text-xs text-muted-foreground">Seuils utilisés pour chaque sous-score :</p>
          <DocTable
            head={["Composante", "Score 100", "Score 0"]}
            rows={[
              ["Rendement réel", "≥ +6 %", "≤ −2 %"],
              ["Max drawdown réel", "≥ −10 %", "≤ −40 %"],
              ["Volatilité réelle", "≤ 5 %", "≥ 15 %"],
              ["Durée sous l’eau", "≤ 12 mois", "≥ 120 mois"],
              ["Régularité", "100 %", "0 %"],
            ]}
          />
          <DocTable
            head={["Score", "Badge"]}
            rows={[
              ["80 – 100", <QualityBadge key="a" className={ROBUSTNESS_TONE["Très robuste"]}>Très robuste</QualityBadge>],
              ["65 – 79", <QualityBadge key="b" className={ROBUSTNESS_TONE["Robuste"]}>Robuste</QualityBadge>],
              ["50 – 64", <QualityBadge key="c" className={ROBUSTNESS_TONE["Moyen"]}>Moyen</QualityBadge>],
              ["35 – 49", <QualityBadge key="d" className={ROBUSTNESS_TONE["Fragile"]}>Fragile</QualityBadge>],
              ["0 – 34", <QualityBadge key="e" className={ROBUSTNESS_TONE["Très fragile"]}>Très fragile</QualityBadge>],
            ]}
          />
        </Sub>

        <Sub title="Écarts Browne vs Actions" intuition="Les mesures relatives qui alimentent le profil : on compare Browne à l’indice actions local.">
          <Formula>{`Écart rendement    = CAGR Browne − CAGR actions
Écart volatilité   = Volatilité Browne − Volatilité actions
Réduction drawdown = |Max DD actions| − |Max DD Browne|
Écart Sharpe       = Sharpe Browne − Sharpe actions`}</Formula>
        </Sub>

        <Sub
          title="Profil Browne vs Actions"
          intuition="Le profil qualifie le type de compromis Browne vs actions — ce n’est pas un jugement absolu."
        >
          <p>
            Le profil ne compare pas seulement les rendements : il qualifie le <strong>compromis</strong>{" "}
            entre rendement, volatilité et drawdown par rapport à l’indice actions local. Un
            portefeuille Browne peut être <strong>intéressant même s’il rend moins</strong> que les
            actions, dès lors qu’il réduit fortement les pertes.
          </p>
          <DocTable
            head={["Profil", "Signification"]}
            rows={VERDICT_ORDER.map((v) => [
              <QualityBadge key={v} w="min-w-[10rem]" className={VERDICT_TONE[v]}>
                {v}
              </QualityBadge>,
              VERDICT_DESC[v],
            ])}
          />
          <p className="text-xs text-muted-foreground">
            Règles de classement — la <strong>première règle remplie</strong> (dans l’ordre) l’emporte :
          </p>
          <DocTable
            head={["Profil", "Règle"]}
            rows={RULE_ORDER.map((v) => [
              <QualityBadge key={v} w="min-w-[10rem]" className={VERDICT_TONE[v]}>
                {v}
              </QualityBadge>,
              <span key={`${v}-r`} className="font-mono text-[11px] text-foreground/85">
                {PROFILE_RULES[v]}
              </span>,
            ])}
          />
        </Sub>
      </Section>

      {/* 3 — Hypothèses */}
      <Section id="meth-hypotheses" n={3} title="Hypothèses">
        <ul className="ml-4 list-disc space-y-1">
          <li>Les calculs sont effectués sur données mensuelles.</li>
          <li>Le portefeuille est construit localement pour chaque pays.</li>
          <li>Les actions sont représentées par un indice actions local (prix coupons réinvestis en priorité).</li>
          <li>Les obligations sont représentées par une obligation souveraine 10 ans ou un proxy total-return.</li>
          <li>Le cash est représenté par un taux court ou un indice monétaire capitalisé.</li>
          <li>L’or est coté en USD puis converti dans la devise locale du pays.</li>
          <li>Les performances réelles sont calculées avec le CPI local.</li>
          <li>Frais, taxes, spreads, frais de change et coûts de transaction ne sont pas inclus.</li>
        </ul>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Rééquilibrage</h3>
          <p className="mt-1">
            Le rééquilibrage remet les quatre poches à leur poids cible de 25 % selon la fréquence
            choisie (mensuelle, trimestrielle, annuelle ou aucune). Le <strong>rééquilibrage annuel
            est le réglage par défaut</strong> : plus réaliste qu’un rééquilibrage mensuel
            systématique et cohérent avec l’esprit du portefeuille permanent.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Devise d’analyse</h3>
          <p className="mt-1">
            En <strong>devise locale</strong>, chaque portefeuille est analysé du point de vue d’un
            investisseur domestique. En <strong>devise commune</strong>, les portefeuilles peuvent
            être convertis dans une devise de référence pour comparer les résultats du point de vue
            d’un investisseur international.
          </p>
        </div>
      </Section>

      {/* 4 — Qualité des données */}
      <Section id="meth-donnees" n={4} title="Qualité des données">
        <p>
          Chaque poche est construite à partir d’une série de données. La qualité indique comment
          cette série a été obtenue et à quel point elle correspond à une série directement
          exploitable.
        </p>
        <DocTable
          head={["Badge (poche)", "Signification"]}
          rows={[
            ["Référence", "Série directement adaptée au modèle (ex. indice actions total return)."],
            ["Observé", "Série directement observée (ex. CPI local)."],
            ["Converti", "Série transformée dans la devise locale (ex. or USD converti en EUR)."],
            ["Proxy structurel", "Série reconstruite par une méthode standard lorsqu’une série directement exploitable n’est pas disponible."],
            ["Repli", "Série moins complète utilisée faute de meilleure donnée disponible."],
          ]}
        />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Exemple — France</h3>
          <DocTable
            head={["Poche", "Série", "Qualité"]}
            rows={[
              ["Actions", "CAC 40 GR", "Référence"],
              ["Obligations", "Proxy total-return 10 ans", "Proxy structurel"],
              ["Cash", "Indice capitalisé à partir du taux court", "Proxy structurel"],
              ["Or", "XAU USD converti en EUR", "Converti"],
              ["Inflation", "CPI France", "Observé"],
            ]}
          />
        </div>
        <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-foreground/90">
          <strong>Un proxy structurel n’est pas une anomalie.</strong> C’est une méthode standard
          utilisée lorsqu’une série directement exploitable n’est pas disponible, notamment pour les
          obligations 10 ans et le cash.
        </p>
        <DocTable
          head={["Badge global", "Signification"]}
          rows={[
            ["Complet", "Les séries nécessaires sont disponibles avec une qualité suffisante."],
            ["Complet avec proxy", "Séries principales disponibles, avec des proxys structurels normaux."],
            ["Historique court", "La période disponible est plus courte que celle des autres pays."],
            ["Partiel", "Certaines données importantes sont absentes ou remplacées par des séries de moindre qualité."],
          ]}
        />
      </Section>

      {/* 5 — Limites */}
      <Section id="meth-limites" n={5} title="Limites">
        <p className="text-foreground/90">
          Les résultats doivent être interprétés comme une <strong>simulation historique</strong>,
          non comme une promesse de performance future.
        </p>
        <ol className="ml-4 list-decimal space-y-1">
          <li>Les performances passées ne garantissent pas les performances futures.</li>
          <li>Les données mensuelles peuvent masquer certains mouvements intra-mensuels.</li>
          <li>Frais, taxes, spreads, coûts de transaction et contraintes de liquidité ne sont pas pris en compte.</li>
          <li>Les indices utilisés ne sont pas toujours directement investissables.</li>
          <li>Certains actifs peuvent être représentés par des proxys.</li>
          <li>Les obligations 10 ans peuvent être reconstruites à partir de taux lorsque l’indice total-return n’est pas disponible.</li>
          <li>Le cash peut être capitalisé à partir d’un taux court.</li>
          <li>L’or est converti dans la devise locale avec les taux de change disponibles.</li>
          <li>Les comparaisons internationales dépendent fortement de la devise, de l’inflation locale et de la période disponible.</li>
          <li>Le score de robustesse est un indicateur synthétique : il aide à comparer les pays mais ne remplace pas l’analyse détaillée des courbes, des drawdowns et des données.</li>
        </ol>
        <div className="rounded-lg border border-primary/20 bg-background/40 p-3">
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">
            Ce que le modèle ne dit pas
          </div>
          <ul className="mt-1.5 ml-4 list-disc space-y-1">
            <li>Il ne prédit pas l’avenir : il ne dit pas quel pays sera le meilleur demain.</li>
            <li>Il ne donne pas de recommandation personnalisée.</li>
            <li>Il compare des comportements historiques selon une méthodologie homogène.</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}
