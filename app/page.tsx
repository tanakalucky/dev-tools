export default function HomePage() {
  return (
    <main className="page">
      <header>
        <h1>dev-tools</h1>
        <p className="lede">ブラウザだけで動く開発者向けユーティリティ。</p>
      </header>

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading">ツール</h2>
        <ul className="tool-list">
          <li className="tool-card">
            <a href="/json">JSON フォーマッター</a>
            <p className="tool-summary">
              JSON を 2 スペースで整形、最小化、検証します。重複キーは警告します。
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
