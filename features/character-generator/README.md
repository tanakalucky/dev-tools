# character-generator

指定した長さのひらがな、または英数字をランダムに生成するツール。ルートは `/character-generator`(`app/character-generator/page.tsx`)。処理はブラウザ内だけで行い、送信・保存・追跡はしない。

## できること

- 生成: 文字数(初期値 10)と文字の種類を選び、「生成する」を押したときだけ実行する。押すたびに新しく生成し直す。
- コピー: 生成結果をクリップボードへコピーする。結果がないときは押せない。

履歴、永続化、ファイル出力、文字種や生成方式の追加設定は扱わない。

## 構成

- `lib/generate-characters.ts` - 純粋な処理 `parseLength(input)` と `generateCharacters(type, length, random?)`(React / DOM に依存しない)。テストは隣の `generate-characters.test.ts`。
- `components/character-generator.tsx` - 画面(Client Component)。shadcn の `Button` と `Textarea` を使う。数値入力と種類の選択は、`components/ui/` に該当部品がないためネイティブの `input` / `select` を同じトークンで整えている。

## 生成規則

- 文字の種類:
  - ひらがな: 清音 46 字(あ行〜わ行と `ん`。ゐ・ゑは含まない)。濁音・半濁音・小書き文字は含めない。
  - 英数字: ASCII の `a-z` `A-Z` `0-9`(62 字)。
- 1 文字ずつ独立に一様ランダムで選ぶ。重複は許す。乱数は `Math.random`(暗号用途ではない)。
- 文字数は 1〜10000 の整数。半角数字だけの文字列を受け付け、空欄・0・範囲外・小数・指数表記・符号付きなどは補正せずエラーを表示し、前回の結果は消す。
