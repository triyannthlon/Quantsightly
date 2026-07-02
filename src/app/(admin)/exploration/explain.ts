// Bloc « Comprendre ce graphique » du Comparateur : explication pédagogique
// adaptée à la combinaison (opération × classes × types) choisie par l'utilisateur.
//
// Périmètre : opérations RATIO et DIFFÉRENCE (les seules qui comparent 2 séries
// de façon interprétable). Résolution « plus spécifique d'abord » :
//   combinaison classe×classe → paire même classe (entre deux pays) → par classe
//   → par type → générique.
// + avertissements automatiques selon la combinaison.

import type { ClassRef, TypeRef, OperationKind } from "@/lib/coredata";

type Op = "ratio" | "difference";

export interface GraphExplanation {
  definition: string;
  formule: string;
  phrase: string;
  warnings: string[];
}

// ─── 1. Intro d'opération (définition + formule + phrase générique) ──────────
const OP_INTRO: Record<Op, { definition: string; formule: string; generic: string }> = {
  ratio: {
    definition: "Le ratio divise la série A par la série B.",
    formule: "Ratio = Série A / Série B",
    generic:
      "Le ratio mesure une performance relative : la série A fait-elle mieux que la série B ? Quand il monte, A progresse plus vite que B ; quand il baisse, B prend l’avantage.",
  },
  difference: {
    definition: "La différence soustrait la série B à la série A.",
    formule: "Différence = Série A − Série B",
    generic:
      "La différence mesure un écart absolu : combien de points séparent la série A de la série B ? Quand elle monte, l’écart augmente en faveur de A ; quand elle baisse, l’avantage de A diminue.",
  },
};

// ─── 2. Par type (TypeRef 1-7) ───────────────────────────────────────────────
const BY_TYPE: Partial<Record<TypeRef, Partial<Record<Op, string>>>> = {
  1: {
    ratio:
      "Ce ratio compare deux niveaux de prix. Quand il monte, la série A surperforme la série B. Quand il baisse, la série B prend l’avantage.",
    difference:
      "La différence entre deux prix est souvent moins lisible qu’un ratio, surtout si les unités sont différentes. Elle n’a de sens que si les deux séries sont directement comparables.",
  },
  2: {
    ratio:
      "Ce ratio compare deux performances totales, revenus réinvestis. Quand il monte, la série A offre une meilleure performance complète que la série B.",
    difference:
      "La différence mesure l’écart de performance totale entre les deux séries. Elle est utile si elles sont exprimées sur la même base.",
  },
  3: {
    ratio:
      "Un ratio entre deux taux est possible, mais souvent difficile à interpréter, surtout si les taux sont faibles, proches de zéro ou négatifs. Une différence est généralement plus lisible.",
    difference:
      "La différence mesure l’écart de taux entre deux séries. Elle s’exprime en points de pourcentage et permet de comparer le coût de l’argent ou la rémunération du capital.",
  },
  4: {
    ratio:
      "Un ratio entre deux taux réels est peu intuitif. Comme les taux réels peuvent être négatifs, une différence est généralement plus pertinente.",
    difference:
      "La différence compare deux rendements après inflation. Elle indique quel pays ou quel actif rémunère le mieux le capital en termes réels.",
  },
  5: {
    ratio:
      "Ce ratio compare la valorisation relative de deux marchés. Quand il monte, le marché A devient plus cher que le marché B par rapport à ses bénéfices.",
    difference:
      "La différence mesure l’écart de valorisation entre deux marchés. Elle indique combien de points de PER séparent la série A de la série B.",
  },
  6: {
    ratio:
      "Ce ratio compare l’activité de marché entre deux séries. Quand il monte, le volume de la série A augmente relativement à celui de la série B.",
    difference:
      "La différence de volumes est moins robuste si les marchés n’ont pas la même taille. Un ratio est généralement plus pertinent pour comparer l’activité relative.",
  },
  7: {
    ratio:
      "Le spot est utilisé pour les devises. Le ratio mesure la valeur d’une devise exprimée dans une autre. Quand il monte, la devise au numérateur s’apprécie.",
    difference:
      "La différence entre deux taux de change spot est rarement pertinente. Pour les devises, le ratio ou le spot direct est la lecture naturelle.",
  },
};

// ─── 3. Par classe (ClassRef) — ratio / difference / entre deux pays ─────────
const BY_CLASS: Partial<
  Record<ClassRef, Partial<Record<Op, string>> & { entreDeuxPays?: string }>
> = {
  1: {
    ratio:
      "Ce ratio compare un marché actions à une autre série. Quand il monte, l’indice boursier de la série A surperforme la série B.",
    difference:
      "La différence n’est pertinente que si les deux séries sont dans une unité comparable. Pour comparer deux marchés actions, le ratio est généralement plus clair.",
    entreDeuxPays:
      "Ce graphique compare le marché actions du pays A à celui du pays B. Si la courbe monte, le pays A surperforme le pays B ; si elle baisse, le pays B fait mieux.",
  },
  2: {
    ratio:
      "Ce ratio mesure la force relative d’une devise face à une autre. Quand il monte, la devise de la série A s’apprécie par rapport à celle de la série B.",
    difference:
      "La différence entre deux taux de change est rarement pertinente. Les devises s’interprètent surtout en spot ou en ratio.",
    entreDeuxPays:
      "Ce graphique compare la valeur relative de deux devises. Si la courbe monte, la devise du pays A se renforce face à celle du pays B ; si elle baisse, elle se déprécie.",
  },
  3: {
    ratio:
      "Ce ratio compare la liquidité à une autre série. Quand il monte, la liquidité fait mieux que la série comparée ; quand il baisse, l’autre série devient plus performante.",
    difference:
      "La différence est pertinente si la liquidité est exprimée en taux : elle mesure alors l’écart de rémunération entre la liquidité et une autre série.",
    entreDeuxPays:
      "Ce graphique compare la rémunération ou la valeur de la liquidité entre deux pays. Si la courbe monte, la liquidité du pays A devient relativement plus attractive.",
  },
  4: {
    ratio:
      "Ce ratio compare les obligations longues à une autre série. Quand il monte, les obligations de la série A protègent mieux que la série B.",
    difference:
      "La différence est très pertinente lorsque les obligations sont exprimées en taux : elle mesure l’écart de rendement entre deux obligations ou entre une obligation et l’inflation.",
    entreDeuxPays:
      "Ce graphique compare les obligations à 10 ans de deux pays. Si la différence monte, le taux du pays A devient plus élevé que celui du pays B ; si elle baisse, l’écart se réduit.",
  },
  7: {
    ratio:
      "Le ratio avec l’inflation indique si une série progresse plus vite que les prix. Quand il monte, la série A protège mieux contre l’inflation ; quand il baisse, l’inflation prend l’avantage.",
    difference:
      "La différence mesure un écart d’inflation ou un rendement corrigé de l’inflation. Elle indique si une série compense ou non la hausse des prix.",
    entreDeuxPays:
      "Ce graphique compare l’inflation du pays A à celle du pays B. Si la différence monte, l’inflation du pays A devient plus forte relativement à celle du pays B.",
  },
  8: {
    ratio:
      "Le ratio avec la croissance réelle compare une série à l’activité économique réelle. Quand il monte, la série A progresse plus vite que l’économie réelle comparée.",
    difference:
      "La différence compare deux dynamiques réelles. Elle mesure l’écart de croissance entre deux pays ou entre la croissance et une autre variable.",
    entreDeuxPays:
      "Ce graphique compare la croissance réelle du pays A à celle du pays B. Si la différence monte, le pays A croît plus vite que le pays B en termes réels.",
  },
};

// ─── 4. Combinaisons classe×classe (clé = refs triées « a-b ») ───────────────
const CLASS_PAIR: Record<string, Partial<Record<Op, string>>> = {
  "1-1": {
    ratio:
      "Ce ratio compare deux marchés actions. Quand il monte, le marché du pays A surperforme celui du pays B ; quand il baisse, le pays B fait mieux.",
    difference:
      "La différence entre deux indices est moins pertinente si les bases de départ ou les devises diffèrent. Pour comparer deux marchés actions, le ratio est préférable.",
  },
  "1-3": {
    ratio:
      "Ce ratio compare la prise de risque actions à la liquidité. Quand il monte, les actions rémunèrent mieux le risque que le cash ; quand il baisse, la liquidité devient plus protectrice.",
    difference:
      "La différence n’est pertinente que si les deux séries sont exprimées en rendement comparable. Sinon, le ratio est plus lisible.",
  },
  "1-4": {
    ratio:
      "Ce ratio compare les actions aux obligations longues. Quand il monte, les actions surperforment les obligations ; quand il baisse, les obligations jouent mieux leur rôle défensif.",
    difference:
      "La différence est pertinente si les deux séries sont exprimées en rendement ou en taux comparable. Sinon, le ratio est préférable.",
  },
  "1-7": {
    ratio:
      "Ce ratio compare le marché actions à la hausse des prix. Quand il monte, les actions progressent plus vite que l’inflation ; quand il baisse, l’inflation érode leur performance réelle.",
    difference:
      "La différence mesure l’écart entre performance actions et inflation, uniquement si les deux séries sont exprimées en variation comparable.",
  },
  "1-8": {
    ratio:
      "Ce ratio compare le marché actions à l’économie réelle. Quand il monte, les actions progressent plus vite que la croissance réelle ; quand il baisse, elles progressent moins vite que l’activité.",
    difference:
      "La différence n’est pertinente que si les deux séries sont exprimées en variation comparable. Elle mesure alors l’écart entre performance de marché et croissance réelle.",
  },
  "3-7": {
    ratio:
      "Ce ratio compare la liquidité à l’inflation. Quand il monte, la liquidité protège mieux contre la hausse des prix ; quand il baisse, l’inflation réduit le pouvoir d’achat du cash.",
    difference:
      "Cette différence mesure un rendement réel approximatif du cash. Positive, la liquidité compense l’inflation ; négative, le cash perd du pouvoir d’achat.",
  },
  "4-7": {
    ratio:
      "Le ratio entre obligation et inflation est peu intuitif. Pour lire la protection contre l’inflation, la différence est généralement plus pertinente.",
    difference:
      "Cette différence mesure un taux réel approximatif. Positive, le rendement obligataire compense l’inflation ; négative, l’inflation dépasse le rendement nominal.",
  },
  "4-4": {
    ratio:
      "Le ratio compare la performance relative de deux marchés obligataires. Il est pertinent si les deux séries sont en prix ou en rendement total.",
    difference:
      "La différence mesure l’écart de taux entre deux pays. Elle permet de comparer le coût de l’argent à long terme ou la prime de risque obligataire.",
  },
  "3-4": {
    ratio:
      "Ce ratio compare les obligations longues à la liquidité. Quand il monte, les obligations longues font mieux que le cash ; quand il baisse, la liquidité devient plus protectrice.",
    difference:
      "Cette différence mesure la prime de durée : combien les obligations longues rapportent en plus, ou en moins, que la liquidité.",
  },
  "7-7": {
    ratio:
      "Le ratio compare deux niveaux d’inflation, mais il est souvent moins lisible qu’une différence. Il indique si l’inflation du pays A progresse relativement à celle du pays B.",
    difference:
      "Cette différence mesure l’écart d’inflation entre deux pays. Si elle monte, le pays A subit une pression inflationniste plus forte que le pays B.",
  },
  "8-8": {
    ratio:
      "Le ratio compare deux niveaux de croissance réelle. Utile pour voir si le pays A progresse relativement plus vite que le pays B.",
    difference:
      "Cette différence mesure l’écart de croissance réelle entre deux pays. Si elle monte, le pays A croît plus vite que le pays B après correction de l’inflation.",
  },
  "7-8": {
    ratio:
      "Le ratio compare la croissance réelle à l’inflation. Moins intuitif qu’une différence, il indique si l’activité réelle progresse relativement plus vite que les prix.",
    difference:
      "Cette différence mesure la qualité du cycle économique. Positive, la croissance réelle domine l’inflation ; négative, l’inflation pèse davantage que la croissance.",
  },
};

export interface ExplainInput {
  operation: OperationKind;
  classA: ClassRef;
  typeA: TypeRef;
  countryA: string;
  classB: ClassRef;
  typeB: TypeRef;
  countryB: string;
}

function warningsFor(op: Op, i: ExplainInput): string[] {
  const w: string[] = [];
  if (op === "ratio" && i.typeA === 3 && i.typeB === 3)
    w.push(
      "Un ratio entre deux taux peut être difficile à interpréter si les taux sont faibles, proches de zéro ou négatifs. Une différence est généralement plus lisible.",
    );
  if (op === "difference" && i.typeA === 1 && i.typeB === 1)
    w.push(
      "La différence entre deux prix ou deux indices est rarement pertinente si les unités diffèrent. Un ratio est généralement plus adapté.",
    );
  if ((i.typeA === 1 && i.typeB === 2) || (i.typeA === 2 && i.typeB === 1))
    w.push(
      "Les deux séries ne mesurent pas exactement la même chose : le rendement total inclut les revenus réinvestis, contrairement au prix simple.",
    );
  if (op === "ratio" && (i.classA === 2 || i.classB === 2 || i.typeA === 7 || i.typeB === 7))
    w.push(
      "Pour les devises, l’ordre des séries compte : A / B mesure la valeur de la devise A exprimée dans la devise B.",
    );
  return w;
}

/** Explication contextuelle (null hors ratio/différence). */
export function explainGraph(input: ExplainInput): GraphExplanation | null {
  if (input.operation !== "ratio" && input.operation !== "difference") return null;
  const op: Op = input.operation;
  const intro = OP_INTRO[op];

  const pairKey = [input.classA, input.classB].sort((a, b) => a - b).join("-");
  const samePair =
    input.classA === input.classB && input.countryA !== input.countryB
      ? BY_CLASS[input.classA]?.entreDeuxPays
      : undefined;

  const phrase =
    CLASS_PAIR[pairKey]?.[op] ??
    samePair ??
    BY_CLASS[input.classA]?.[op] ??
    BY_TYPE[input.typeA]?.[op] ??
    intro.generic;

  return {
    definition: intro.definition,
    formule: intro.formule,
    phrase,
    warnings: warningsFor(op, input),
  };
}
