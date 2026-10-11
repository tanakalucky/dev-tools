import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import { evaluate, type Operator } from "./evaluate";

describe("evaluate: operator precedence", () => {
  it.each([
    ["2+3×4 multiplies first", ["2", "3", "4"], ["+", "*"], "14"],
    ["2×3+4", ["2", "3", "4"], ["*", "+"], "10"],
    ["2+8÷4", ["2", "8", "4"], ["+", "/"], "4"],
    ["10−2×3−1", ["10", "2", "3", "1"], ["-", "*", "-"], "3"],
    ["10−4−3 is left associative", ["10", "4", "3"], ["-", "-"], "3"],
    ["8÷4÷2 is left associative", ["8", "4", "2"], ["/", "/"], "1"],
    ["1+2×3÷6+4", ["1", "2", "3", "6", "4"], ["+", "*", "/", "+"], "6"],
  ] as [string, string[], Operator[], string][])("%s", (_name, operands, operators, expected) => {
    expect(evaluate(operands, operators)).toMatchObject({ kind: "value", text: expected });
  });
});

describe("evaluate: decimal arithmetic", () => {
  it.each([
    ["0.1+0.2", ["0.1", "0.2"], ["+"], "0.3"],
    ["0.3−0.1", ["0.3", "0.1"], ["-"], "0.2"],
    ["0.1×3", ["0.1", "3"], ["*"], "0.3"],
    ["1.5÷0.5", ["1.5", "0.5"], ["/"], "3"],
    ["5−8 is negative", ["5", "8"], ["-"], "-3"],
    ["a negative operand", ["-3", "2"], ["*"], "-6"],
    ["a zero that would be negative", ["0", "-5"], ["/"], "0"],
  ] as [string, string[], Operator[], string][])("%s", (_name, operands, operators, expected) => {
    expect(evaluate(operands, operators)).toMatchObject({ kind: "value", text: expected });
  });

  it("keeps intermediate values at full precision so 1÷3×3 is exactly 1", () => {
    expect(evaluate(["1", "3", "3"], ["/", "*"])).toMatchObject({ kind: "value", text: "1" });
  });

  it("keeps the internal result separate from the 12-digit display", () => {
    const result = evaluate(["1", "3"], ["/"]);

    expect(result).toMatchObject({ kind: "value", text: "0.333333333333" });
    if (result.kind === "value") {
      expect(result.raw).toHaveLength(42);
      expect(result.raw.startsWith("0.333333333333")).toBe(true);
    }
  });

  it("does not cap operands at 12 digits", () => {
    expect(evaluate(["1234567890123", "1234567890122"], ["-"])).toMatchObject({
      kind: "value",
      text: "1",
    });
  });

  it("keeps a 40-digit operand exact through intermediate steps", () => {
    const fortyDigits = "1".repeat(40);

    expect(evaluate([fortyDigits, "1", fortyDigits], ["+", "-"])).toMatchObject({
      kind: "value",
      text: "1",
    });
  });
});

describe("evaluate: formatting to 12 significant digits", () => {
  it.each([
    ["1÷3", ["1", "3"], ["/"], "0.333333333333"],
    ["2÷3 rounds the last digit up", ["2", "3"], ["/"], "0.666666666667"],
    ["12 digits stay plain", ["999999999999", "1"], ["*"], "999999999999"],
    ["1.23456789012345", ["1.23456789012345", "1"], ["*"], "1.23456789012"],
    ["13 digits round and use an exponent", ["1234567890123", "1"], ["*"], "1.23456789012e+12"],
    ["a large product", ["1000000", "1000000000"], ["*"], "1e+15"],
    ["0.000001 stays plain", ["1", "1000000"], ["/"], "0.000001"],
    ["1e-7 uses an exponent", ["1", "10000000"], ["/"], "1e-7"],
  ] as [string, string[], Operator[], string][])("%s", (_name, operands, operators, expected) => {
    expect(evaluate(operands, operators)).toMatchObject({ kind: "value", text: expected });
  });
});

describe("evaluate: division by zero", () => {
  it.each([
    ["5÷0", ["5", "0"], ["/"]],
    ["5÷0.000", ["5", "0.000"], ["/"]],
    ["0÷0", ["0", "0"], ["/"]],
    ["1+2÷0", ["1", "2", "0"], ["+", "/"]],
    ["4÷2−3÷0", ["4", "2", "3", "0"], ["/", "-", "/"]],
  ] as [string, string[], Operator[]][])("reports %s", (_name, operands, operators) => {
    expect(evaluate(operands, operators)).toEqual({ kind: "divide-by-zero" });
  });

  it("does not treat a tiny divisor as zero", () => {
    expect(evaluate(["1", "0.0000000001"], ["/"])).toMatchObject({
      kind: "value",
      text: "10000000000",
    });
  });
});

describe("evaluate: Decimal configuration", () => {
  it("leaves the global Decimal precision untouched", () => {
    evaluate(["1", "3"], ["/"]);

    expect(Decimal.precision).toBe(20);
  });
});
