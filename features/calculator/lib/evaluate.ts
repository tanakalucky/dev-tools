import { Decimal } from "decimal.js";

export type Operator = "+" | "-" | "*" | "/";

export type Evaluation =
  | { kind: "value"; text: string; raw: string; approximate: boolean }
  | { kind: "divide-by-zero" };

export const INTERNAL_PRECISION = 40;
export const DISPLAY_DIGITS = 12;

// グローバルの Decimal 設定を変えないよう専用の clone を使う。
const CalculatorDecimal = Decimal.clone({ precision: INTERNAL_PRECISION });

type AdditiveOperator = "+" | "-";
type AdditiveTerms = { terms: Decimal[]; operators: AdditiveOperator[]; hasDivision: boolean };

// operands は数字の文字列。Number を経由しないので桁落ちしない。
export function evaluate(
  operands: string[],
  operators: Operator[],
  approximateInput = false,
): Evaluation {
  const additive = multiplyAndDivide(operands, operators);

  if (additive === null) {
    return { kind: "divide-by-zero" };
  }

  const approximate = approximateInput || additive.hasDivision;
  const value = suppressDivisionResidue(addAndSubtract(additive), additive.terms, approximate);

  return { kind: "value", text: formatResult(value), raw: value.toString(), approximate };
}

function multiplyAndDivide(operands: string[], operators: Operator[]): AdditiveTerms | null {
  const [first = "0", ...rest] = operands;
  const terms: Decimal[] = [];
  const additiveOperators: AdditiveOperator[] = [];
  let hasDivision = false;
  let term = new CalculatorDecimal(first);

  for (const [index, operand] of rest.entries()) {
    const operator = operators[index];
    const value = new CalculatorDecimal(operand);

    if (operator === "*") {
      term = term.times(value);
    } else if (operator === "/") {
      if (value.isZero()) {
        return null;
      }

      term = term.div(value);
      hasDivision = true;
    } else if (operator === "+" || operator === "-") {
      terms.push(term);
      additiveOperators.push(operator);
      term = value;
    }
  }

  terms.push(term);

  return { terms, operators: additiveOperators, hasDivision };
}

function addAndSubtract({ terms, operators }: AdditiveTerms): Decimal {
  const [first = new CalculatorDecimal("0"), ...rest] = terms;

  return rest.reduce(
    (sum, term, index) => (operators[index] === "-" ? sum.minus(term) : sum.plus(term)),
    first,
  );
}

// 循環小数を40桁で計算した後の打ち消し誤差だけを0に寄せる。
// 単独の小さな値や、除算を含まない正確な十進差分は保持する。
function suppressDivisionResidue(value: Decimal, terms: Decimal[], approximate: boolean): Decimal {
  if (!approximate || terms.length < 2 || value.isZero()) {
    return value;
  }

  const magnitude = terms.reduce(
    (largest, term) => (term.abs().gt(largest) ? term.abs() : largest),
    new CalculatorDecimal("0"),
  );
  const tolerance = magnitude.times(`1e-${INTERNAL_PRECISION - 1}`);

  return value.abs().lte(tolerance) ? new CalculatorDecimal("0") : value;
}

// 有効数字 12 桁に丸め、桁が大きすぎる・小さすぎる値は指数表記にする。
function formatResult(value: Decimal): string {
  const rounded = value.toSignificantDigits(DISPLAY_DIGITS);

  if (rounded.isZero()) {
    return "0";
  }

  const needsExponent = rounded.e >= DISPLAY_DIGITS || rounded.e < -6;

  return needsExponent ? rounded.toExponential() : rounded.toFixed();
}
