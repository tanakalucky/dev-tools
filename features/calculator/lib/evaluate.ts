import { Decimal } from "decimal.js";

export type Operator = "+" | "-" | "*" | "/";

export type Evaluation = { kind: "value"; text: string; raw: string } | { kind: "divide-by-zero" };

export const INTERNAL_PRECISION = 40;
export const DISPLAY_DIGITS = 12;

// グローバルの Decimal 設定を変えないよう専用の clone を使う。
const CalculatorDecimal = Decimal.clone({ precision: INTERNAL_PRECISION });

type AdditiveOperator = "+" | "-";
type AdditiveTerms = { terms: Decimal[]; operators: AdditiveOperator[] };

// operands は数字の文字列。Number を経由しないので桁落ちしない。
export function evaluate(operands: string[], operators: Operator[]): Evaluation {
  const additive = multiplyAndDivide(operands, operators);

  if (additive === null) {
    return { kind: "divide-by-zero" };
  }

  const value = addAndSubtract(additive);

  return { kind: "value", text: formatResult(value), raw: value.toString() };
}

function multiplyAndDivide(operands: string[], operators: Operator[]): AdditiveTerms | null {
  const [first = "0", ...rest] = operands;
  const terms: Decimal[] = [];
  const additiveOperators: AdditiveOperator[] = [];
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
    } else if (operator === "+" || operator === "-") {
      terms.push(term);
      additiveOperators.push(operator);
      term = value;
    }
  }

  terms.push(term);

  return { terms, operators: additiveOperators };
}

function addAndSubtract({ terms, operators }: AdditiveTerms): Decimal {
  const [first = new CalculatorDecimal("0"), ...rest] = terms;

  return rest.reduce(
    (sum, term, index) => (operators[index] === "-" ? sum.minus(term) : sum.plus(term)),
    first,
  );
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
