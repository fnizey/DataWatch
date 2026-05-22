# AI Datawrapper – Journalistverktøy

Et AI-drevet newsroom-tool som lar journalister laste opp datasett og lage Datawrapper-grafer via en chatbot-grensesnitt.

**Flyt:** Upload CSV/Excel → Beskriv graf i chat → AI lager chart-plan → Datawrapper API publiserer → Embed-kode klar

---

## Skjermbilde

```
┌─────────────────────────┬──────────────────────────────────────┐
│  LAST OPP DATASETT      │  AI-ASSISTENT                        │
│  ─────────────────────  │  ──────────────────────────────────  │
│  [Dra hit eller velg]   │  Du: Lag stolpediagram over banker   │
│                         │  AI: Lager NIM per bank (d3-bars)…   │
│  DATASETT               │                                      │
│  📅 År   # NIM   T Bank │  ┌────────────────────────────────┐  │
│  2024    1.8%    DNB    │  │ ✅ Publisert! Chart-ID: xK3jP  │  │
│  2024    2.1%    SR     │  │ 🔗 Åpne i Datawrapper          │  │
│  ...                    │  │ </> Embed-kode: <iframe...     │  │
└─────────────────────────┴──────────────────────────────────────┘
```

---

## Forutsetninger

- **Node.js** 18.17 eller nyere
- **npm** 9+
- **OpenAI API-nøkkel** – hent på [platform.openai.com](https://platform.openai.com/api-keys)
- **Datawrapper API-nøkkel** – hent på [app.datawrapper.de/account/api-tokens](https://app.datawrapper.de/account/api-tokens)

---

## Installasjon og kjøring

### 1. Opprett og klon repo

```bash
# På GitHub: New repository → "ai-datawrapper-chatbot"
git clone https://github.com/DITTBRUKERNAVN/ai-datawrapper-chatbot.git
cd ai-datawrapper-chatbot
```

### 2. Installer avhengigheter

```bash
npm install
```

### 3. Lag `.env.local`

```bash
cp .env.example .env.local
```

Åpne `.env.local` og fyll inn nøklene:

```env
DATAWRAPPER_API_KEY="kYnztyWseNYIlupSiIimdpjtYvRluSHgVw5KnZwMxCxCmjUcpmmEl6a7d4yYmcYc"
OPENAI_API_KEY="sk-proj-..."
```

> ⚠️ `.env.local` er i `.gitignore` og vil aldri pushe API-nøkler til GitHub.

### 4. Start utviklingsserver

```bash
npm run dev
```

### 5. Åpne appen

```
http://localhost:3000
```

---

## GitHub Quick Start (copy-paste-oppskrift)

```bash
# 1. Klon
git clone https://github.com/DITTBRUKERNAVN/ai-datawrapper-chatbot.git
cd ai-datawrapper-chatbot

# 2. Installer
npm install

# 3. Miljøvariabler
cp .env.example .env.local
# Rediger .env.local med dine nøkler

# 4. Kjør
npm run dev

# 5. Test med en liten CSV – eksempel:
# bank,nim_prosent,år
# DNB,1.82,2024
# SpareBank 1 SR-Bank,2.14,2024
# Nordea,1.67,2024
# Sbanken,1.95,2024

# 6. Skriv i chat:
# "Lag et stolpediagram over NIM per bank, sorter høyeste først"
```

---

## Filstruktur

```
ai-datawrapper-chatbot/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Hovedside (state management)
│   ├── globals.css             # Global CSS + Tailwind
│   └── api/
│       ├── upload/route.ts     # POST – parser CSV/Excel
│       ├── plan-chart/route.ts # POST – AI lager chart-plan
│       └── create-chart/route.ts # POST – Datawrapper API-kjede
├── components/
│   ├── FileUpload.tsx          # Drag-and-drop filopplasting
│   ├── DataPreview.tsx         # Kolonne- og rad-preview
│   ├── ChatPanel.tsx           # Chat-grensesnitt med loading-states
│   └── ResultCard.tsx          # Datawrapper-lenke + embed-kode
├── lib/
│   ├── parseData.ts            # CSV/Excel parsing + kolonnetyper
│   ├── chartPlanner.ts         # OpenAI GPT-4o chart-planlegger
│   └── datawrapper.ts          # Datawrapper API-klient
├── .env.example                # Mal for miljøvariabler
├── .env.local                  # ← Lag denne selv (ikke commit!)
└── README.md
```

---

## API-ruter

| Rute | Metode | Beskrivelse |
|------|--------|-------------|
| `/api/upload` | POST | Parser CSV/Excel, returnerer kolonner + forhåndsvisning |
| `/api/plan-chart` | POST | Sender data til OpenAI, returnerer chart-plan JSON |
| `/api/create-chart` | POST | Oppretter, laster opp, oppdaterer og publiserer Datawrapper-chart |

### `/api/upload`
```
Body: FormData med felt "file" (.csv, .xls, .xlsx, maks 10MB)
Response: { columns, rows, preview, totalRows, fileName }
```

### `/api/plan-chart`
```json
{
  "userPrompt": "Lag stolpediagram over NIM per bank",
  "columns": [...],
  "preview": [...],
  "totalRows": 42
}
```

### `/api/create-chart`
```json
{
  "plan": { "datawrapperType": "d3-bars", "title": "...", ... },
  "rows": [...]
}
```

---

## Datawrapper chart-typer

| Kode | Type |
|------|------|
| `d3-bars` | Horisontal stolpediagram |
| `d3-bars-stacked` | Stablet stolpediagram |
| `d3-lines` | Linjediagram |
| `d3-area` | Arealdiagram |
| `d3-scatter-plot` | Spredningsdiagram |
| `tables` | Datatabell |
| `d3-maps-choropleth` | Koroplettkart |

---

## Eksempel: Test-CSV

Lagre som `banker.csv` og last opp:

```csv
bank,nim_prosent,utlånsvekst_prosent,egenkapitalavkastning
DNB Bank,1.82,4.2,13.4
SpareBank 1 SR-Bank,2.14,6.8,14.2
Sparebanken Vest,2.31,5.1,12.9
Nordea Norge,1.67,2.3,11.8
Sbanken,1.95,7.4,15.1
Bien Sparebank,2.44,3.9,10.7
```

Eksempel-prompts:
- `"Lag stolpediagram over NIM per bank, sorter høyest til lavest"`
- `"Vis utlånsvekst per bank som horisontal graf"`
- `"Lag tabell med alle bankene"`

---

## Feilsøking

**`DATAWRAPPER_API_KEY er ikke satt`**
→ Sjekk at `.env.local` eksisterer og inneholder nøkkelen. Restart `npm run dev`.

**`OPENAI_API_KEY er ikke satt`**
→ Legg til `OPENAI_API_KEY=sk-...` i `.env.local`.

**`Publiser chart feilet (HTTP 403)`**
→ Datawrapper-nøkkelen har ikke publiseringstillatelse. Gå til Datawrapper → Account → API Tokens og sjekk tillatelsene.

**Filen leses ikke**
→ Sjekk at CSV bruker komma (`,`) eller semikolon (`;`) som separator. Excel-filer må være `.xls` eller `.xlsx`, ikke `.xlsb`.

---

## Teknologi

- **Next.js 14** – App Router, TypeScript
- **Tailwind CSS** – Styling
- **OpenAI GPT-4o** – Chart-planlegging
- **Datawrapper API v3** – Oppretting og publisering
- **papaparse** – CSV-parsing
- **xlsx** – Excel-parsing

---

## Lisens

MIT
