# SME Credit Readiness Score — MVP

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · lucide-react. Neumorphic dark UI.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests pentru motorul de scor (node --test)
npm run build
```

## Arhitectură (layere)

| Layer | Fișier | De înlocuit cu |
|---|---|---|
| Tipuri | `src/types/scoring.ts` | — |
| Date (repository) | `src/data/mockCompanyData.ts` → `getCompanyGroundTruth()` | query Supabase PostgreSQL (`// TODO`) |
| Server Actions | `src/app/actions/loadCompany.ts`, `checkPortalJust.ts` | — (UI-ul apelează doar aceste acțiuni) |
| Ingestie e-Factura | `src/services/eFacturaService.ts` → `applyInvoice()` | parser XML UBL 2.1 |
| Motor S_Business | `src/services/businessScoreService.ts` | metrici reale + benchmark CAEN |
| Motor de scor (pur) | `src/lib/scoringEngine.ts` | — |
| UI | `src/components/wizard/*`, `src/components/dashboard/*` | — |

## Note

- `portal.just.ro`: apel SOAP real `CautareDosare` (după firmă și după administrator), timeout 5s.
  La eroare → `isFallback: true`, punctaj neutru `FALLBACK_LEGAL_SCORE = 80` (constantă în `scoringEngine.ts`).
  „Mod Simulare Portal Just” are 4 scenarii (0 dosare / 1-2 / 3+ / critic).
- Un dosar în care firma căutată apare doar ca **Creditor** nu este marcat critic
  (ex. creditor în insolvența altei firme).
- Scorul Quiz 1 se îngheață la trimitere; upload-ul simulat de facturi recalculează doar S_Business și raportul sumă/CA.
