import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Termeni și condiții — Credit Ready",
  description: "Condițiile de utilizare ale platformei Credit Ready.",
};

const TERMS: { title: string; body: string }[] = [
  {
    title: "Ce este Credit Ready",
    body: "Un instrument de pregătire pentru finanțare: calculează un profil Credit Ready din datele reale ale firmei (facturi e-Factura, surse publice oficiale, date declarate) și propune un plan de acțiune. Nu este o ofertă de credit, o aprobare sau o consultanță financiară autorizată.",
  },
  {
    title: "Datele pe care le introduci",
    body: "Ești responsabil ca facturile încărcate și datele declarate (cheltuieli fixe, datorii) să fie corecte și să aparțină firmei pe care o reprezinți. Scorul este doar atât de corect cât sunt datele de intrare.",
  },
  {
    title: "Surse externe",
    body: "Informațiile din ANAF, VIES și portal.just.ro sunt preluate așa cum sunt publicate. Când o sursă nu răspunde, nu îi atribuim un rezultat: este marcată „indisponibilă” și nu intră în scor. portal.just.ro nu publică CNP-ul, deci dosarele administratorului pot aparține unui omonim până le confirmi.",
  },
  {
    title: "Recomandările bancare",
    body: "Potrivirea cu produsele băncilor se bazează pe criterii publice și este orientativă. Decizia finală, dobânda și condițiile aparțin exclusiv băncii, după propria analiză.",
  },
  {
    title: "Abonamente",
    body: "Planurile și prețurile sunt cele afișate pe pagina Prețuri, cu TVA 21% inclusă în totalul de plată. În versiunea demo, upgrade-ul este simulat și nu se face nicio plată.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-xs text-faint">Termeni</p>
        <h1 className="mt-2 text-[28px] font-normal leading-tight tracking-tight text-ink">Termeni și condiții</h1>
      </div>
      {TERMS.map((t) => (
        <Card key={t.title}>
          <h2 className="text-base font-medium text-ink">{t.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.body}</p>
        </Card>
      ))}
    </div>
  );
}
