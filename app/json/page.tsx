import { JsonTool } from "./json-tool";

export const metadata = {
  title: "JSON formatter - dev-tools",
  description: "Format, minify and validate JSON locally in the browser.",
};

export default function JsonPage() {
  return (
    <main className="page page-wide">
      <header>
        <p className="breadcrumb">
          <a href="/">dev-tools</a>
        </p>
        <h1>JSON formatter</h1>
        <p className="lede">Format, minify and validate JSON. Nothing leaves this browser tab.</p>
      </header>

      <JsonTool />
    </main>
  );
}
