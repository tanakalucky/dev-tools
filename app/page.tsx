export default function HomePage() {
  return (
    <main className="page">
      <header>
        <h1>dev-tools</h1>
        <p className="lede">Browser-only developer utilities.</p>
      </header>

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading">Tools</h2>
        <ul className="tool-list">
          <li className="tool-card">
            <a href="/json">JSON formatter</a>
            <p className="tool-summary">
              Format with 2 spaces, minify and validate JSON, with duplicate-key warnings.
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
