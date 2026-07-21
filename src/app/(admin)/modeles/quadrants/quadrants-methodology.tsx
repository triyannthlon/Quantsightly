"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VERDICT_ORDER, VERDICT_TONE, VERDICT_DESC, type QuadrantsVerdict } from "./helpers";
import { IS_MODEL_V2 } from "./model-version-active";

// Ordre d'ÉVALUATION des règles de profil (première remplie l'emporte) — identique à Browne.
const RULE_ORDER: QuadrantsVerdict[] = [
  "Supérieur aux actions",
  "Excellent compromis",
  "Protecteur",
  "Profil atypique",
  "Protection limitée",
  "Compromis modéré",
];
const PROFILE_RULES: Record<QuadrantsVerdict, string> = {
  "Supérieur aux actions":
    "écart rendement ≥ 0 · réduction drawdown ≥ 5 pts · écart volatilité ≤ 0",
  "Excellent compromis":
    "écart rendement ≥ −1,5 pt · réduction drawdown ≥ 20 pts · écart volatilité ≤ −3 pts",
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

/** Sous-carte : intitulé + phrase d'intuition + contenu. */
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
    <Card id={id} className="scroll-mt-[var(--model-header-offset,96px)] gap-0 p-5">
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

/** Tableau simple (entêtes + lignes). */
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
                <td
                  key={j}
                  className={cn("px-3 py-2 align-top", j === 0 && "font-medium text-foreground")}
                >
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

function QualityBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block min-w-[10rem] rounded-md border px-2 py-0.5 text-center text-[11px] font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Sections de la doc — exposées à la navigation interne sticky de la page.
export const METHODOLOGY_SECTIONS = [
  { id: "meth-overview", label: "Vue d’ensemble" },
  { id: "meth-formules", label: "Formules" },
  { id: "meth-hypotheses", label: "Hypothèses" },
  { id: "meth-donnees", label: "Données" },
  { id: "meth-limites", label: "Limites" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export function QuadrantsMethodology() {
  return (
    <div className="space-y-4">
      {/* Résumé (la navigation par ancres vit dans la barre sticky de la page) */}
      <Card className="gap-0 border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent p-5">
        <p className="text-sm leading-relaxed">
          Le module 4 Quadrants construit, pour chaque pays, un portefeuille de référence dont
          l’allocation est pilotée par le régime macroéconomique observé. Deux axes de marché —
          l’activité et l’inflation — situent le pays dans un plan, et cette position détermine la
          part de chaque poche (actions, obligations, or, liquidités).
        </p>
        <div className="mt-4 rounded-lg border border-primary/20 bg-background/40 p-3">
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">
            À retenir
          </div>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            Le 4 Quadrants n’est pas une prévision : c’est une allocation de référence qui{" "}
            <span className="font-medium">suit</span> le régime macro tel qu’il apparaît dans les
            prix, pour lisser le rendement réel et réduire les pertes. Le régime courant se lit sur
            l’historique complet ; les performances se mesurent sur la fenêtre choisie.
          </p>
        </div>
      </Card>

      {/* 1 — Vue d'ensemble */}
      <Section id="meth-overview" n={1} title="Vue d’ensemble">
        <p>
          Deux axes indépendants décrivent l’environnement macroéconomique d’un pays, chacun à
          partir d’un simple rapport de prix de marché :
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="font-medium text-foreground">Axe activité</span> — actions locales
            rapportées au pétrole. Il monte quand l’économie accélère.
          </li>
          <li>
            <span className="font-medium text-foreground">Axe inflation</span> — or rapporté aux
            obligations 10 ans. Il monte quand les pressions inflationnistes dominent.
          </li>
        </ul>
        <p>
          Chaque axe est comparé à sa propre tendance de long terme (moyenne mobile 7 ans) : ce
          n’est pas le niveau brut qui compte, mais l’écart à la tendance. Les deux écarts,
          normalisés, donnent deux coordonnées comprises entre −100 et +100. Leur signe définit l’un
          des quatre régimes ; leur intensité indique la netteté du signal.
        </p>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Les quatre régimes et les poches privilégiées
          </h3>
          <DocTable
            head={["Régime (activité, inflation)", "Poches privilégiées"]}
            rows={[
              ["Boom inflationniste (+, +)", "Actions et or"],
              ["Boom déflationniste (+, −)", "Actions et obligations"],
              ["Contraction inflationniste (−, +)", "Or et liquidités"],
              ["Contraction déflationniste (−, −)", "Obligations et liquidités"],
            ]}
          />
          <p className="mt-2 text-xs">
            L’axe activité arbitre entre <span className="font-medium">actions</span> (expansion) et{" "}
            <span className="font-medium">liquidités</span> (contraction) ; l’axe inflation arbitre
            entre <span className="font-medium">or</span> (inflation) et{" "}
            <span className="font-medium">obligations</span> (désinflation).
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Deux stratégies d’allocation
          </h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <span className="font-medium text-foreground">Binaire</span> — quand un axe envoie un
              signal net, la poche dominante prend toute la part de son bloc ; sinon le bloc est
              réparti à parts égales.
            </li>
            <li>
              <span className="font-medium text-foreground">Dynamique (DQAE)</span> — les poids
              varient de façon continue avec la position dans le plan, d’une répartition équilibrée
              jusqu’à une forte concentration sur la poche dominante.
            </li>
          </ul>
          <p className="mt-2 text-xs">
            Une <span className="font-medium">zone neutre</span> autour des tendances évite de
            surréagir à un signal faible : dans cette bande, le bloc concerné reste équilibré.
          </p>
        </div>
      </Section>

      {/* 2 — Formules */}
      <Section id="meth-formules" n={2} title="Formules">
        <Sub
          title="Coordonnées brutes"
          intuition="Deux rapports de prix, en logarithme, résument l’activité et l’inflation."
        >
          <Formula>{`activitéₜ  = ln( Actions_prixₜ / Pétroleₜ )
inflationₜ = ln( Orₜ / Obligations 10 ansₜ )`}</Formula>
          <p>
            Le signal d’activité utilise les actions en <span className="font-medium">prix</span>{" "}
            (hors dividendes) ; l’or et le pétrole sont convertis dans la devise du pays. Les
            obligations sont prises en rendement total.
          </p>
        </Sub>

        <Sub
          title="Écart normalisé robuste à la MM7"
          intuition="On mesure la distance à la tendance 7 ans, en unités robustes aux valeurs extrêmes."
        >
          <Formula>{`MM84ₜ = (1/84) · Σ_{i=0..83} rₜ₋ᵢ        (moyenne mobile 84 mois, mois courant inclus)
dₜ    = rₜ − MM84ₜ                       (écart à la tendance)
MADₜ  = médiane( | dₜ₋ᵢ − médiane(d) | )  (dispersion robuste, même fenêtre)
zₜ    = dₜ / max( 1,4826 · MADₜ , s_min )
coordₜ = 100 · tanh( zₜ / κ )            (κ = 2, borné dans [−100, +100])`}</Formula>
          <p>
            Le zéro est calé sur la moyenne mobile, pas sur la médiane : on mesure l’écart à la{" "}
            <span className="font-medium">tendance</span>. La transformation{" "}
            <span className="font-mono">tanh</span> borne le résultat et écrase les valeurs
            extrêmes. Il faut au moins 167 mois d’historique pour produire une coordonnée.
          </p>
        </Sub>

        <Sub
          title="Régime et intensité"
          intuition="Le signe des deux coordonnées donne le quadrant ; leur norme, la netteté."
        >
          <Formula>{`quadrant   = signe(activité) × signe(inflation)
intensitéₜ = hypot( xₜ , yₜ ) / √2        (∈ [0, 100])`}</Formula>
        </Sub>

        <Sub
          title="Zone neutre"
          intuition="Une bande autour des tendances où l’on refuse de trancher."
        >
          <Formula>{`axe en zone neutre  ⇔  | coord | ≤ T        (T réglable, 0–50, défaut 20)`}</Formula>
          <p>
            Un axe dont la coordonnée reste dans la bande neutre est jugé sans signal net : son bloc
            reste équilibré. La largeur T est un réglage partagé avec la page Régimes.
          </p>
        </Sub>

        <Sub
          title="Allocation cible"
          intuition="Chaque axe pilote un bloc de 50 % : actions/liquidités d’un côté, or/obligations de l’autre."
        >
          <Formula>{`— Binaire —
si l'axe est net (hors zone neutre) : 50 % sur la poche dominante, 0 % sur l'autre
sinon                               : 25 % / 25 % dans le bloc

— Dynamique (DQAE) —
uₓ = zone_morte( x , T )            (0 dans [−T, T], rampe linéaire jusqu'à ±100)
Actions      = 25 % · (1 + uₓ/100)   Liquidités   = 25 % · (1 − uₓ/100)
Or           = 25 % · (1 + u_y/100)  Obligations  = 25 % · (1 − u_y/100)`}</Formula>
          <p>
            Dans les deux cas les quatre poches somment à 100 %. Une poche Énergie optionnelle
            pourra être ajoutée par-dessus (financée au prorata) ; elle est désactivée dans cette
            version.
          </p>
        </Sub>

        <Sub
          title={IS_MODEL_V2 ? "Réallocation sans anticipation" : "Réallocation mensuelle sans anticipation"}
          intuition={
            IS_MODEL_V2
              ? "On ne réalloue que lorsque l’écart aux cibles est significatif ; les nouveaux poids ne produisent de rendement qu’au mois suivant."
              : "On réalloue à la clôture d’un mois, mais les nouveaux poids ne produisent de rendement qu’au mois suivant."
          }
        >
          <p>
            À la fin de chaque mois <span className="font-mono">t</span>, les coordonnées d’activité
            et d’inflation déterminent une nouvelle allocation cible{" "}
            <span className="font-mono">w*ₖ,ₜ</span>.
          </p>
          <p>
            Avant la réallocation, les poids réellement détenus ont dérivé avec la performance des
            actifs pendant le mois :
          </p>
          <Formula>{`poids détenuₖ,ₜ = [ poids cibleₖ,ₜ₋₁ × (1 + rendementₖ,ₜ) ] / Σⱼ [ poids cibleⱼ,ₜ₋₁ × (1 + rendementⱼ,ₜ) ]`}</Formula>
          {IS_MODEL_V2 ? (
            <p>
              Le modèle calcule régulièrement une allocation cible. Afin d’éviter des ajustements
              mineurs et des coûts de transaction inutiles, le portefeuille n’est réalloué que
              lorsque l’écart entre l’allocation détenue et l’allocation cible devient suffisamment
              significatif. Les poids effectivement détenus sont ensuite appliqués à la période
              suivante.
            </p>
          ) : (
            <p>
              Le portefeuille est ensuite réalloué des poids détenus vers les nouveaux poids cibles.
              Les actifs surpondérés sont partiellement vendus et le produit de ces ventes sert à
              acheter les actifs sous-pondérés.
            </p>
          )}
          <p>Les nouveaux poids sont appliqués uniquement aux rendements du mois suivant :</p>
          <Formula>{`r₄Q,ₜ₊₁ = Σₖ w*ₖ,ₜ × rₖ,ₜ₊₁`}</Formula>
          <p>
            Ainsi, les informations disponibles à la clôture du mois{" "}
            <span className="font-mono">t</span> ne produisent aucun rendement avant le mois{" "}
            <span className="font-mono">t+1</span>.
          </p>
        </Sub>

        <Sub
          title="Performance nominale et réelle"
          intuition="Base 100, rythme annuel, et correction de l’inflation locale."
        >
          <Formula>{`Indexₜ      = 100 × ∏ (1 + rₜ)
CAGR        = (Valeur finale / Valeur initiale)^(12 / nombre d'intervalles mensuels) − 1
Indice réelₜ = Indice nominalₜ / Indice CPIₜ`}</Formula>
          <p>
            Pour <span className="font-mono">n</span> observations mensuelles, il existe{" "}
            <span className="font-mono">n − 1</span> intervalles de performance : c’est ce nombre
            d’intervalles qui annualise le CAGR. La performance réelle corrige la performance
            nominale de l’inflation locale.
          </p>
        </Sub>

        <Sub
          title="Rotation à chaque réallocation"
          intuition="La part réellement échangée pour passer des poids détenus aux nouveaux poids cibles."
        >
          <p>
            La rotation mesure la part du portefeuille effectivement vendue puis réinvestie pour
            passer des poids détenus aux nouveaux poids cibles :
          </p>
          <Formula>{`Rotationₜ = ½ × Σₖ | poids cibleₖ,ₜ − poids détenuₖ,ₜ |`}</Formula>
          <p>
            Le facteur <span className="font-mono">½</span> évite de compter deux fois les mêmes
            capitaux : le montant vendu dans les poches surpondérées finance le montant acheté dans
            les poches sous-pondérées.
          </p>
          <p>La rotation comprend deux sources :</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>la dérive des poids provoquée par les performances différentes des actifs ;</li>
            <li>le changement d’allocation cible provoqué par l’évolution du régime.</li>
          </ul>
          <p>
            La constitution initiale au début de l’historique complet est exclue. Lorsqu’une période
            plus courte est sélectionnée au sein d’un historique déjà existant, la transaction
            nécessaire à l’entrée de cette fenêtre est incluse dans la rotation, car elle correspond à
            une réallocation effectivement requise à cette date.
          </p>
        </Sub>

        <Sub
          title="Rotation annualisée"
          intuition="La part moyenne du portefeuille réallouée chaque année."
        >
          <p>
            La rotation annualisée représente la part moyenne du portefeuille réallouée chaque année
            :
          </p>
          {IS_MODEL_V2 && (
            <p>
              La rotation mesure uniquement les réallocations <span className="font-medium text-foreground">effectivement exécutées</span>. Un
              changement d’allocation cible qui ne déclenche pas de transaction n’augmente pas la
              rotation du portefeuille.
            </p>
          )}
          <Formula>{`Rotation annualisée = moyenne des rotations mensuelles observées × 12
                    = ( Σ rotations / nombre de mois disposant d'une rotation ) × 12`}</Formula>
          <p>
            Une rotation annualisée de{" "}
            <span className="font-medium text-foreground">37 % / an</span> signifie qu’en moyenne,
            l’équivalent de 37 % du portefeuille est vendu puis réinvesti chaque année pour suivre
            les allocations produites par le modèle.
          </p>
          <p>
            La rotation est une mesure d’activité du portefeuille. Les coûts, taxes, spreads et
            éventuels impacts de marché associés ne sont pas déduits des performances.
          </p>
        </Sub>

        <Sub
          title="Écarts 4 Quadrants vs Actions"
          intuition="Les mesures relatives qui alimentent le profil : on compare le 4 Quadrants à l’indice actions local, en réel."
        >
          <Formula>{`Écart rendement    = CAGR 4 Quadrants − CAGR actions   (réel)
Écart volatilité   = Volatilité 4 Quadrants − Volatilité actions
Réduction drawdown = |Max DD actions| − |Max DD 4 Quadrants|
Écart Sharpe       = Sharpe 4 Quadrants − Sharpe actions`}</Formula>
        </Sub>

        <Sub
          title="Profil 4 Quadrants vs Actions"
          intuition="Le profil qualifie le type de compromis 4 Quadrants vs actions — ce n’est pas un jugement absolu."
        >
          <p>
            Le profil ne compare pas seulement les rendements : il qualifie le{" "}
            <strong>compromis</strong> entre rendement, volatilité et drawdown par rapport à
            l’indice actions local. Un portefeuille 4 Quadrants peut être{" "}
            <strong>intéressant même s’il rend moins</strong> que les actions, dès lors qu’il réduit
            fortement les pertes.
          </p>
          <DocTable
            head={["Profil", "Signification"]}
            rows={VERDICT_ORDER.map((v) => [
              <QualityBadge key={v} className={VERDICT_TONE[v]}>
                {v}
              </QualityBadge>,
              VERDICT_DESC[v],
            ])}
          />
          <p className="text-xs text-muted-foreground">
            Règles de classement — la <strong>première règle remplie</strong> (dans l’ordre)
            l’emporte :
          </p>
          <DocTable
            head={["Profil", "Règle"]}
            rows={RULE_ORDER.map((v) => [
              <QualityBadge key={v} className={VERDICT_TONE[v]}>
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
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <span className="font-medium text-foreground">Signal ≠ performance</span> : le signal
            d’activité utilise les actions en prix (ty1) ; la performance de la poche actions
            utilise le rendement total (ty2, coupons/dividendes réinvestis), avec repli sur le prix
            si le total-return manque.
          </li>
          <li>
            <span className="font-medium text-foreground">Devise locale</span> : or et pétrole sont
            des séries globales converties dans la devise du pays ; tout est calculé en monnaie
            locale.
          </li>
          <li>
            <span className="font-medium text-foreground">Aucune anticipation</span> : les poids
            sont figés à la clôture du mois et appliqués au mois suivant.
          </li>
          {IS_MODEL_V2 ? (
            <li>
              <span className="font-medium text-foreground">Réallocation conditionnelle</span> :
              l’allocation cible est recalculée à chaque clôture mensuelle, mais le portefeuille
              n’est réalloué que lorsque l’écart entre l’allocation détenue et l’allocation cible
              devient suffisamment significatif — afin d’éviter des ajustements mineurs et des coûts
              inutiles. La zone neutre <span className="font-mono">T</span> agit sur la construction
              du signal, pas sur l’exécution. La rotation est mesurée sur les transactions
              réellement exécutées, mais les coûts de transaction ne sont pas facturés.
            </li>
          ) : (
            <li>
              <span className="font-medium text-foreground">Réallocation mensuelle</span> :
              l’allocation cible est recalculée à chaque clôture mensuelle et appliquée au mois
              suivant. Le portefeuille est intégralement ramené vers cette cible chaque mois. Il
              n’existe pas de seuil de non-intervention supplémentaire : la zone neutre{" "}
              <span className="font-mono">T</span> agit sur la construction du signal, pas sur
              l’exécution des transactions. La rotation est mesurée, mais les coûts de transaction ne
              sont pas facturés.
            </li>
          )}
          <li>
            <span className="font-medium text-foreground">Régime sur historique complet</span> : le
            régime, les coordonnées et l’allocation courants sont calculés sur tout l’historique
            disponible ; ils ne changent pas selon la fenêtre choisie. Seules les performances,
            risques et rotation suivent la fenêtre.
          </li>
        </ul>
      </Section>

      {/* 4 — Données */}
      <Section id="meth-donnees" n={4} title="Qualité des données">
        <p>Chaque pays s’appuie sur les séries suivantes :</p>
        <DocTable
          head={["Usage", "Série"]}
          rows={[
            ["Signal activité", "Actions (prix) / Pétrole (WTI global)"],
            ["Signal inflation", "Or (global, converti) / Obligations 10 ans (rendement total)"],
            ["Performance", "Actions total-return · Obligations 10 ans · Liquidités · Or converti"],
            ["Inflation", "Indice des prix à la consommation (CPI) local"],
          ]}
        />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Badge de disponibilité</h3>
          <div className="flex flex-wrap items-center gap-2">
            <QualityBadge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Complet
            </QualityBadge>
            <QualityBadge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Historique court
            </QualityBadge>
            <QualityBadge className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              Données en repli
            </QualityBadge>
            <QualityBadge className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              Partiel
            </QualityBadge>
          </div>
          <p className="mt-2 text-xs">
            <strong>Complet</strong> = les séries nécessaires sont disponibles avec une qualité
            suffisante ; <strong>Historique court</strong> = moins de 120 mois de coordonnées (la
            profondeur est bornée par l’or, disponible depuis 1971) ;{" "}
            <strong>Données en repli</strong> = la performance des actions retombe sur le prix nu
            (dividendes perdus) ; <strong>Partiel</strong> = données importantes absentes (ex.
            inflation locale) ou plusieurs limites cumulées. Sur une fenêtre trop courte, les
            métriques sont marquées « historique insuffisant » — jamais ramenées à zéro.
          </p>
        </div>
      </Section>

      {/* 5 — Limites */}
      <Section id="meth-limites" n={5} title="Limites">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Un backtest décrit le passé sous des règles figées ; il ne prédit pas l’avenir.</li>
          <li>
            Les réallocations mensuelles sont simulées sans frais, taxes, spreads, impact de marché
            ni seuil minimal de transaction. Dans la réalité, ces coûts pourraient réduire la
            performance, particulièrement lorsque la rotation est élevée.
          </li>
          <li>La poche Énergie et son score sont prévus mais désactivés pour l’instant.</li>
          <li>
            Le régime est un signal de <span className="font-medium">marché</span> (rapports de prix
            comparés à leur tendance), pas une prévision macroéconomique.
          </li>
          <li>
            Les historiques diffèrent d’un pays à l’autre : une comparaison sur « Max » peut
            recouvrir des périodes de longueurs différentes.
          </li>
        </ul>
        <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">
            Ce que le modèle ne dit pas
          </div>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            Le 4 Quadrants n’est pas un conseil d’investissement. C’est un cadre de référence,
            transparent et reproductible, pour comparer des allocations pilotées par le régime —
            pays par pays, et face à l’indice actions local.
          </p>
        </div>
      </Section>
    </div>
  );
}
