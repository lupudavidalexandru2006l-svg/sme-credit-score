import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Credit Ready — evaluare IMM",
  description:
    "Profil Credit Readiness pentru IMM-uri din România: date e-Factura pe 12 luni, factor uman (quiz + portal.just.ro), scopul investiției și plan de acțiune 30–90 de zile.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${manrope.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
