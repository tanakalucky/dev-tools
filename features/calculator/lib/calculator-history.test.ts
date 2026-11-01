import { describe, expect, it } from "vitest";

import { getDisplay, type CalculatorKey } from "./calculator-state";
import {
  HISTORY_LIMIT,
  INITIAL_SESSION,
  parseHistory,
  reduceSession,
  serializeHistory,
  type CalculatorSession,
} from "./calculator-history";

function ready(): CalculatorSession {
  return reduceSession(INITIAL_SESSION, { type: "load", history: [] });
}

function enter(sequence: string, session = ready()): CalculatorSession {
  return [...sequence].reduce(
    (current, key, index) =>
      reduceSession(current, {
        type: "press",
        key: key as CalculatorKey,
        id: `${index}-${current.history.length}`,
      }),
    session,
  );
}

describe("calculator history transitions (AAA)", () => {
  it("ignores input until history is loaded and never replaces an already loaded history", () => {
    // Arrange
    const existing = enter("1+2=").history;
    // Act
    const beforeLoad = reduceSession(INITIAL_SESSION, { type: "press", key: "1", id: "early" });
    const loaded = reduceSession(beforeLoad, { type: "load", history: existing });
    const repeated = reduceSession(loaded, { type: "load", history: [] });
    // Assert
    expect(beforeLoad).toBe(INITIAL_SESSION);
    expect(repeated.history).toEqual(existing);
  });

  it("records each completed calculation once, ignores repeated/incomplete equals and keeps AC separate", () => {
    // Arrange
    const incomplete = enter("1=");
    // Act
    const completed = enter("+2===", incomplete);
    const cleared = reduceSession(completed, { type: "press", key: "clear", id: "clear" });
    // Assert
    expect(incomplete.history).toEqual([]);
    expect(completed.history).toHaveLength(1);
    expect(getDisplay(completed.history[0]!.calculation).result).toBe("3");
    expect(cleared.history).toEqual(completed.history);
    expect(getDisplay(cleared.calculator).result).toBe("0");
  });

  it("keeps the newest 50 calculations in newest-first order", () => {
    // Arrange
    let session = ready();
    // Act
    for (let number = 0; number < 53; number++) {
      session = enter(
        `${number}+1=`,
        reduceSession(session, { type: "press", key: "clear", id: "clear" }),
      );
    }
    // Assert
    expect(session.history).toHaveLength(HISTORY_LIMIT);
    expect(getDisplay(session.history[0]!.calculation).result).toBe("53");
    expect(getDisplay(session.history[49]!.calculation).result).toBe("4");
  });

  it("edits a snapshot and adds the recalculation without changing the source", () => {
    // Arrange
    const original = enter("1+2=");
    const source = original.history[0]!;
    // Act
    const restored = reduceSession(original, { type: "restore", id: source.id, mode: "edit" });
    const recalculated = enter("3=", restored);
    // Assert
    expect(getDisplay(restored.calculator).expression).toBe("1 ＋ 2");
    expect(getDisplay(recalculated.calculator).result).toBe("24");
    expect(recalculated.history).toHaveLength(2);
    expect(recalculated.history[1]!).toEqual(source);
  });

  it("continues from the raw result after serialization, including negative and exponential results", () => {
    for (const [expression, continuation, expected] of [
      ["1/3=", "*3=", "1"],
      ["0-2=", "*3=", "-6"],
      ["999999999999*9=", "/9=", "999999999999"],
    ] as const) {
      // Arrange
      const history = parseHistory(serializeHistory(enter(expression).history));
      const session = reduceSession(INITIAL_SESSION, { type: "load", history });
      // Act
      const restored = reduceSession(session, {
        type: "restore",
        id: history[0]!.id,
        mode: "continue",
      });
      const completed = enter(continuation, restored);
      // Assert
      expect(getDisplay(completed.calculator).result).toBe(expected);
      expect(completed.history).toHaveLength(2);
      expect(completed.history[1]!).toEqual(history[0]!);
    }
  });

  it("preserves a continued expression's raw operand and display through reload and edit", () => {
    // Arrange
    const calculated = enter("1/3=*3=");
    const history = parseHistory(serializeHistory(calculated.history));
    // Act
    const session = reduceSession(INITIAL_SESSION, { type: "load", history });
    const edited = reduceSession(session, { type: "restore", id: history[0]!.id, mode: "edit" });
    const completed = enter("=", edited);
    // Assert
    expect(getDisplay(edited.calculator).expression).toBe("0.333333333333 × 3");
    expect(getDisplay(completed.calculator).result).toBe("1");
  });

  it("allows error expressions to be fixed but cannot continue from an error", () => {
    // Arrange
    const original = enter("5/0=");
    const id = original.history[0]!.id;
    // Act
    const continued = reduceSession(original, { type: "restore", id, mode: "continue" });
    const edited = reduceSession(original, { type: "restore", id, mode: "edit" });
    const backspaced = reduceSession(edited, { type: "press", key: "backspace", id: "back" });
    const fixed = enter("2=", backspaced);
    // Assert
    expect(continued).toBe(original);
    expect(getDisplay(fixed.calculator).result).toBe("2.5");
    expect(parseHistory(serializeHistory(original.history))).toEqual(original.history);
  });

  it("deletes only the selected entry and clears all persistently without changing the current calculation", () => {
    // Arrange
    const original = enter("1+2=*3=");
    // Act
    const deleted = reduceSession(original, { type: "delete", id: original.history[1]!.id });
    const cleared = reduceSession(deleted, { type: "clear-history" });
    // Assert
    expect(deleted.history).toEqual([original.history[0]!]);
    expect(cleared.calculator).toEqual(original.calculator);
    expect(parseHistory(serializeHistory(cleared.history))).toEqual([]);
    expect(reduceSession(cleared, { type: "restore", id: "missing", mode: "edit" })).toBe(cleared);
  });
});

describe("stored history validation (AAA)", () => {
  it.each([
    null,
    "",
    "{",
    "null",
    "[]",
    "{}",
    '{"version":0,"entries":[]}',
    '{"version":1,"entries":{}}',
  ])("recovers from missing, corrupt or unsupported data: %s", (input) => {
    // Arrange / Act
    const history = parseHistory(input);
    // Assert
    expect(history).toEqual([]);
  });

  it("recomputes results, skips malformed entries and duplicate ids while keeping valid entries", () => {
    // Arrange
    const entry = enter("1+2=").history[0]!;
    const changed = {
      ...entry,
      calculation: { ...entry.calculation, outcome: { kind: "result", raw: "999", text: "999" } },
    };
    const bad = [
      null,
      {},
      { id: "bad", calculation: { operands: ["NaN", "2"], operators: ["+"], carryDisplay: null } },
      { id: "incomplete", calculation: { operands: ["1"], operators: ["+"], carryDisplay: null } },
      { id: "bad-carry", calculation: { ...entry.calculation, carryDisplay: "999" } },
      { id: "bad-op", calculation: { ...entry.calculation, operators: ["eval"] } },
      {
        id: "bad-exp",
        calculation: {
          operands: ["1e9999999999999999999999999", "1"],
          operators: ["+"],
          carryDisplay: null,
        },
      },
    ];
    // Act
    const history = parseHistory(JSON.stringify({ version: 1, entries: [...bad, changed, entry] }));
    // Assert
    expect(history).toEqual([entry]);
  });

  it("caps oversized stored lists at the newest 50 valid entries", () => {
    // Arrange
    const entry = enter("1+2=").history[0]!;
    const entries = Array.from({ length: 55 }, (_, index) => ({ ...entry, id: `${index}` }));
    // Act
    const history = parseHistory(JSON.stringify({ version: 1, entries }));
    // Assert
    expect(history).toHaveLength(50);
    expect(history[0]!.id).toBe("0");
    expect(history.at(-1)?.id).toBe("49");
  });
});
