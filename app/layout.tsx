import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "dev-tools",
  description: "Browser-only developer utilities.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
