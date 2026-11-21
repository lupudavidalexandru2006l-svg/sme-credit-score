import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Politica de confidențialitate",
  description: "Ce date prelucrează Afghankingz Credit, din ce surse, unde sunt păstrate și ce drepturi ai conform GDPR.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Ce date prelucrăm",
    body: [
      "Datele firmei introduse de tine: denumire, CUI, cod CAEN, județ, numele administratorului, cheltuielile fixe și datoriile declarate.",
      "Facturile e-Factura (XML UBL 2.1) pe care le încarci: emitent, client, sume, date de emitere și scadență.",
      "Răspunsurile la quiz și la formularul de investiție.",
      "Pentru cererile B2B: nume, instituție, email, telefon și mesaj, doar cu acordul tău.",
    ],
  },
  {
    title: "Surse publice interogate",
    body: [
      "ANAF (serviciul public de verificare a plătitorilor de TVA și bilanțurile publicate), după CUI.",
      "VIES — Comisia Europeană, pentru validarea codului de TVA intracomunitar.",
      "portal.just.ro — dosarele în care firma este parte; administratorul este căutat după nume numai dacă și-a dat acordul.",
      "Nu interogăm Centrala Riscului de Credit, Centrala Incidentelor de Plăți sau Ghișeul.ro: acestea cer acordul titularului și le verifică banca.",
    ],
  },
  {
    title: "Scop și temei legal",
    body: [
      "Datele sunt folosite exclusiv pentru a calcula profilul Credit Ready al firmei și planul de acțiune (executarea serviciului cerut de tine, art. 6 alin. 1 lit. b GDPR).",
      "Căutarea administratorului în dosarele publice se face doar pe baza consimțământului (art. 6 alin. 1 lit. a GDPR), pe care îl poți retrage oricând debifând opțiunea din Pasul 1.",
      "Nu vindem date și nu le transmitem băncilor fără acțiunea ta explicită.",
    ],
  },
  {
    title: "Unde sunt păstrate",
    body: [
      "În modul local, totul rămâne în browserul tău (localStorage) și poate fi șters din setările browserului.",
      "Când este configurată baza de date Supabase, firmele, facturile încărcate și verificările se salvează acolo, legate de firma respectivă.",
    ],
  },
  {
    title: "Drepturile tale",
    body: [
      "Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a depune plângere la ANSPDCP (dataprotection.ro).",
      "Rezultatul este un ghid de pregătire, nu o decizie de creditare: nicio decizie cu efect juridic nu se ia automat pe baza lui.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-xs text-faint">Confidențialitate</p>
        <h1 className="mt-2 text-[28px] font-normal leading-tight tracking-tight text-ink">Politica de confidențialitate</h1>
      </div>
      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <h2 className="text-base font-medium text-ink">{s.title}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            {s.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
