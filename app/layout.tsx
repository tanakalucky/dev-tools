import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "dev-tools",
  description: "ブラウザだけで動く開発者向けユーティリティ。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
