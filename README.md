# Credit Ready — Challenge 2 (BCR)

Platformă de evaluare „Credit Readiness” pentru IMM-uri din România: transformă datele e-Factura (istoric sintetic pe 12 luni + XML-uri UBL 2.1 încărcate live) într-un profil de eligibilitate explicat pe piloni și un plan de acțiune pe 30–90 de zile.

> **Ghid de pregătire, nu aprobare bancară.** Toate datele sunt sintetice (firmă fictivă: *Nord Fresh Distribuție SRL*, CAEN 4639). Formula este publică (vezi mai jos și pagina „Profil → Cum calculăm”).

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Supabase (opțional) · fast-xml-parser · lucide-react.

## Rulare locală

```bash
npm install
npm run dev          # http://localhost:3000  → redirect la /onboarding
npm test             # 18 teste: formulă, quiz, parser UBL, upload demo, analiză juridică
npm run build        # verificare TypeScript + build de producție
```

Fără nicio configurare aplicația rulează în **mod local** (date sintetice generate determinist, stare în `localStorage`).

### Cu Supabase (persistență)

1. Creează un proiect Supabase → SQL Editor → rulează `supabase/schema.sql`, apoi `supabase/seed.sql`.
2. Copiază `.env.example` în `.env.local` și completează `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run dev` — bara laterală arată „Date: Supabase (live)”; facturile XML încărcate se salvează în `e_invoices`, butonul „Salvează evaluarea” scrie în `assessments` (scorul se recalculează pe server).

`supabase/seed.sql` se regenerează cu `npm run seed:sql` din același generator folosit de aplicație (`src/lib/data/synthetic.ts`), deci datele din DB și din modul local sunt identice.

## Demo pentru pitch (fișiere XML de test)

În `public/samples/` (și ca butoane cu un click în pasul 2):

| Fișier | Ce conține | Efect (după „Completează scenariul demo”) |
|---|---|---|
| `01_factura_normala.xml` | 380 · 18.450 RON către un client existent | +0,7 p · scorul trece pragul **Bank-Ready** (79,4 → 80,1 cu portal.just.ro neverificat) |
| `02_factura_storno_381.xml` | **381 storno** · 85.000 RON (retur marfă) | stornările din ultimele 3 luni urcă peste 5% → răspunsul „Nu” de la quiz devine greșit, DSCR scade |
| `03_factura_mare_concentrare.xml` | 380 · 750.000 RON către clientul #1 | clientul #1 trece de 30% (prag de quiz), CA pe 3 luni crește cu ~35% (quiz Q1 picat), volatilitate și sezonalitate cresc, apare acțiunea „Diversifică portofoliul” |

Fiecare upload arată o notificare „scor X → Y”, KPI-urile clipesc, iar porțiunea din XML apare cu verde în graficul lunar.

## Flow (4 pași)

1. **Onboarding & factor uman** — firmă/CUI/CAEN/CEO, verificare automată `portal.just.ro` (SOAP live cu fallback și mod simulat), quiz de 5 întrebări validat pe e-Factura, conectare cu platforma externă de quiz-uri.
2. **Analiză business & e-Factura** — KPI-uri, grafic pe 12 luni, cele 5 sub-scoruri cu formula afișată, top clienți/furnizori, upload XML.
3. **Investiție & sector** — formular în 3 întrebări (destinație, avans, sumă vs. CA anualizată + rată și DSCR estimate) și benchmark vizual față de sectorul CAEN.
4. **Profil Credit Ready & plan** — scor final cu formula completată, factorii care trag scorul în jos, plan 30/60/90 de zile, print/PDF, salvare în Supabase.

## Formula

```
ScorFinal   = 0,70·S_Business + 0,15·S_Uman + 0,15·S_Investiție
S_Uman      = 0,50·Quiz + 0,50·PortalJust
S_Investiție= 0,50·Formular + 0,50·Benchmark sector
Kill-switch : Quiz 0–34 p → −10 p din ScorFinal (minim 0)
```

**S_Business** (din facturi): stabilitate încasări 25% (CV lunar ≤10% → 100, ≥45% → 0) · comportament de plată 25% (60% DSO ≤30 → 100, ≥75 → 0; 40% valoare încasată cu >5 zile întârziere ≤5% → 100, ≥40% → 0) · sezonalitate 10% (max/min ≤1,25× → 100, ≥2,5× → 0) · concentrare 15% (client #1 ≤15% → 100, ≥60% → 0) · capacitate de rambursare 25% (DSCR = cash-flow operațional / (rate existente + rată nouă la 9,5%/an, 60 luni): 0,9 → 0 · 1,0 → 30 · 1,2 → 60 · 1,5 → 90 · 2,0 → 100).

**Quiz** (100 p): Q1 CA 3 luni 35 p (≤10% / 20% / 35% abatere) · Q2 termen de plată 25 p · Q3 pondere client #1 20 p · Q4 furnizor principal 12 p · Q5 stornări >5% (cod 381) 8 p. Se re-validează la fiecare XML încărcat.

**portal.just.ro** (100 p): penalizare progresivă pe gravitate și rol (nivel 1 −3 p plafonat la 9, nivel 2 −8, nivel 3 −20, nivel 4 → 0). Dosarele unde firma e creditor/reclamant/victimă nu se penalizează; omonimele parțiale sunt excluse. Timeout → punctaj neutru 80 marcat „Fallback”.

**Benchmark**: DSO, concentrare, stornări, sezonalitate, marjă brută vs. p25/mediană/p75 pentru CAEN (cuartila bună = 100, mediana = 60, cuartila slabă = 25).

## Conectarea cu site-ul existent de quiz-uri

Linkul către platforma de quiz-uri nu a fost furnizat, așa că integrarea e făcută prin contract API, fără să depindă de codul ei:

- **Redirect**: site-ul extern trimite utilizatorul la `/onboarding?q1=2000000&q2=30&q3=15-30&q4=<furnizor>&q5=nu` (sau `?quiz=<base64 JSON QuizAnswers>`). Răspunsurile se importă automat.
- **Webhook**: `POST /api/quiz` cu `{ "cui": "RO45127893", "answers": { ... } }` și header `x-quiz-secret` (dacă `QUIZ_WEBHOOK_SECRET` e setat). Se salvează în `assessments` (`quiz_source = 'external'`); butonul „Importă ultimul rezultat” îl aduce în platformă.
- `NEXT_PUBLIC_EXTERNAL_QUIZ_URL` activează butonul „Deschide quiz-ul extern” (adaugă `cui` și `return`).

```bash
curl -X POST http://localhost:3000/api/quiz -H "Content-Type: application/json" \
  -d '{"cui":"RO45127893","answers":{"revenueEstimate":2100000,"paymentTerm":"30","topClientShare":"15-30","mainSupplier":"Agroalim Distribuție SA","hasSignificantCreditNotes":false}}'
```

## Structură

| Zonă | Fișiere |
|---|---|
| Tipuri | `src/types/scoring.ts` |
| Date sintetice + benchmark | `src/lib/data/synthetic.ts`, `src/lib/data/benchmarks.ts` |
| Parser e-Factura UBL 2.1 / RO_CIUS | `src/lib/efactura/parser.ts` (Invoice + CreditNote, wrapper SPV) |
| Metrici din facturi | `src/lib/metrics.ts` |
| Motor de scor (pur) | `src/lib/scoringEngine.ts` (quiz, investiție, S_Business, benchmark, analiză juridică, formula finală) |
| Profil complet + plan 30–90 zile | `src/lib/assessment.ts` |
| portal.just.ro | `src/app/actions/checkPortalJust.ts` (Server Action SOAP + simulare) |
| API | `src/app/api/{dataset,invoices,assessments,quiz}/route.ts` |
| Supabase | `src/lib/supabase/server.ts`, `supabase/schema.sql`, `supabase/seed.sql`, `scripts/generate-seed.mts` |
| UI | `src/app/(flow)/*`, `src/components/*` |

`legacy-mvp/` conține componentele MVP-ului anterior (UI neumorfic întunecat), păstrate pentru referință și excluse din build.
