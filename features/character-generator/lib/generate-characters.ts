export const MIN_LENGTH = 1;
export const MAX_LENGTH = 10000;

export type CharacterType = "hiragana" | "alphanumeric";

// ひらがなは清音の 46 字だけ。濁音・半濁音・小書き文字・ゐゑは含めない。
export const CHARACTER_SETS: Record<CharacterType, string> = {
  hiragana:
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
  alphanumeric: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
};

// 空欄・小数・指数表記・符号付きなどは補正せず null を返し、呼び出し側でエラー表示にする。
export function parseLength(input: string): number | null {
  if (!/^[0-9]+$/.test(input)) {
    return null;
  }

  const length = Number(input);

  return length >= MIN_LENGTH && length <= MAX_LENGTH ? length : null;
}

export function generateCharacters(
  type: CharacterType,
  length: number,
  random: () => number = Math.random,
): string {
  const characters = CHARACTER_SETS[type];
  let generated = "";

  for (let index = 0; index < length; index += 1) {
    generated += characters.charAt(Math.floor(random() * characters.length));
  }

  return generated;
}
