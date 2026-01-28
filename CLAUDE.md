# CLAUDE.md - AI Assistant Guide for EEDC

## Project Overview

**EEDC (Electronic Energy Data Collection)** is a German-language web application for managing and analyzing photovoltaic (PV) installations, electric vehicles (E-Auto), heat pumps (Waermepumpe), battery storage (Speicher), and energy-related investments. The app tracks monthly energy data, calculates ROI, CO2 savings, and provides comprehensive analytics dashboards.

**Language**: All UI text, database fields, and user-facing content is in **German**.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15.1.0 (App Router) |
| React | 19.0.0 |
| Language | TypeScript 5.3.3 |
| Styling | Tailwind CSS 3.4.0 |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Auth | Supabase Auth with `@supabase/ssr` 0.8.0 |
| Charts | Recharts 2.10.0 |
| PDF Export | jsPDF 4.0.0 + jspdf-autotable |
| CSV Parsing | PapaParse 5.5.3 |

## Project Structure

```
eedc/
├── app/                          # Next.js App Router pages
│   ├── api/                      # REST API routes
│   │   ├── anlagen/              # Anlage management
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── community/            # Community features
│   │   ├── csv-template/         # CSV template generation
│   │   └── upload-monatsdaten/   # CSV data upload
│   ├── anlage/                   # PV installation pages (CRUD)
│   ├── auswertung/               # Analytics & reports dashboard
│   ├── community/                # Public shared installations
│   ├── daten-import/             # CSV data import
│   ├── eingabe/                  # Monthly data entry (tabbed: PV, E-Auto, etc.)
│   ├── investitionen/            # Investment management
│   ├── login/                    # Login page
│   ├── register/                 # Registration page
│   ├── stammdaten/               # Master data (electricity prices, assignments)
│   ├── uebersicht/               # Overview pages
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard (home)
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── AppLayout.tsx             # Main layout with sidebar
│   ├── ConditionalLayout.tsx     # Route-based layout switcher
│   ├── Sidebar.tsx               # Dynamic navigation sidebar
│   ├── *Form.tsx                 # Form components for data entry
│   ├── *Dashboard.tsx            # Analytics dashboard components
│   ├── ui/                       # Reusable UI primitives
│   └── investitionen/            # Investment-specific components
│
├── lib/                          # Core business logic & utilities
│   ├── supabase-server.ts        # Server-side Supabase client
│   ├── supabase-browser.ts       # Browser-side Supabase client + types
│   ├── auth.ts                   # Auth helpers (getCurrentUser, hasAnlageAccess)
│   ├── auth-actions.ts           # Server actions (signIn, signUp, signOut)
│   ├── investitionCalculations.ts # ROI & CO2 calculations
│   └── investitionTypes.ts       # Investment type definitions
│
├── hooks/                        # Custom React hooks
│   ├── useInvestitionForm.ts     # Investment form state management
│   └── useInvestitionsFilter.ts  # Investment filtering logic
│
├── scripts/                      # Database setup scripts
├── docs/                         # Documentation
├── schema.sql                    # Database schema
└── schema_ergaenzungen.sql       # Schema extensions
```

## Key Conventions

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `MonatsdatenForm.tsx`, `ROIDashboard.tsx` |
| Hooks | camelCase with `use` prefix | `useInvestitionForm.ts` |
| Server actions | camelCase, file ends with `-actions.ts` | `auth-actions.ts` |
| Database columns | snake_case (German) | `pv_erzeugung_kwh`, `mitglied_id` |
| TypeScript variables | camelCase | `jahresEinsparung`, `co2Einsparung` |
| Constants | SCREAMING_SNAKE_CASE | `CO2_FAKTOREN` |

### Code Style

- **Client components**: Mark with `'use client'` at top of file
- **Server components**: Default (no directive needed)
- **Server actions**: Mark with `'use server'` at top of file
- **Dynamic rendering**: Use `export const dynamic = 'force-dynamic'` when needed
- **Error handling**: Try-catch with descriptive German error messages

### German Terminology

Common terms used throughout the codebase:
- **Anlage** = PV installation/system
- **Monatsdaten** = Monthly data
- **Mitglied** = Member/user
- **Erzeugung** = Generation/production
- **Verbrauch** = Consumption
- **Einspeisung** = Grid feed-in
- **Netzbezug** = Grid consumption
- **Einsparung** = Savings
- **Waermepumpe** = Heat pump
- **Speicher** = Battery storage
- **Wechselrichter** = Inverter

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `mitglieder` | Users (id, email, vorname, nachname, plz, ort) |
| `anlagen` | PV installations (mitglied_id, leistung_kwp, etc.) |
| `monatsdaten` | Monthly energy data for PV |
| `alternative_investitionen` | E-auto, heat pump, storage investments |
| `investition_monatsdaten` | Monthly data for investments |
| `anlagen_freigaben` | Public sharing settings |
| `strompreise` | Electricity price management |
| `investitionstyp_config` | Investment type parameters |

### Row Level Security (RLS)

All tables use RLS for data isolation. Users can only access their own data via `mitglied_id = auth.uid()`.

## Authentication Patterns

### Server-Side Auth Check

```typescript
// lib/auth.ts pattern
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  // ... fetch user-specific data
}
```

### Client-Side Supabase Access

```typescript
// In 'use client' components
import { createBrowserClient } from '@/lib/supabase-browser'

const supabase = createBrowserClient()
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('mitglied_id', userId)
```

### Auth Helpers (lib/auth.ts)

- `getCurrentUser()` - Returns `Mitglied | null` with full profile
- `getAuthUser()` - Returns `AuthUser | null` (just id & email)
- `hasAnlageAccess(userId, anlageId)` - Checks ownership
- `getUserAnlagen(userId)` - Gets user's installations

## Investment Types

Valid investment types (`InvestitionsTyp`):
- `e-auto` - Electric vehicles
- `waermepumpe` - Heat pumps
- `speicher` - Battery storage
- `wechselrichter` - Inverters
- `pv-module` - Solar modules
- `balkonkraftwerk` - Balcony power plants
- `wallbox` - EV charging stations
- `sonstiges` - Other

## CO2 Calculation Factors

From `lib/investitionCalculations.ts`:
```typescript
const CO2_FAKTOREN = {
  benzin_pro_liter: 2.37,      // kg CO2/liter
  strom_netz_pro_kwh: 0.38,    // kg CO2/kWh (grid electricity)
  gas_pro_kwh: 0.201,          // kg CO2/kWh
  oel_pro_kwh: 0.266           // kg CO2/kWh
}
```

## Key Formulas

- **Eigenverbrauchsquote** = (Eigenverbrauch / PV-Erzeugung) * 100
- **Autarkiegrad** = (Eigenverbrauch / Gesamtverbrauch) * 100
- **Netto-Ertrag** = Einspeisung-Erloese - Netzbezug-Kosten - Betriebsausgaben

## Common Development Tasks

### Adding a New Page

1. Create folder in `app/` with `page.tsx`
2. Add server-side auth check with `getCurrentUser()`
3. Use `export const dynamic = 'force-dynamic'` if fetching user data
4. Add route to `Sidebar.tsx` if needed

### Adding a New Form Component

1. Create component in `components/` with `'use client'`
2. Use `createBrowserClient()` for mutations
3. Follow existing form patterns (e.g., `MonatsdatenForm.tsx`)
4. Handle errors with German messages

### Adding an API Route

1. Create `route.ts` in `app/api/[endpoint]/`
2. Import `createClient` from `@/lib/supabase-server`
3. Check auth: `const user = await getCurrentUser()`
4. Return JSON responses: `NextResponse.json({ success, data, message })`

### Working with Types

Types are defined in `lib/supabase-browser.ts`:
- `Anlage` - PV installation
- `Monatsdaten` - Monthly energy data
- `AlternativeInvestition` - Investment record
- `InvestitionMonatsdaten` - Investment monthly data

## Important Files

| File | Purpose |
|------|---------|
| `lib/supabase-server.ts` | Server-side Supabase client (SSR) |
| `lib/supabase-browser.ts` | Browser client + TypeScript types |
| `lib/auth.ts` | Authentication helpers |
| `lib/auth-actions.ts` | Sign in/up/out server actions |
| `lib/investitionCalculations.ts` | CO2 & savings calculations |
| `components/Sidebar.tsx` | Dynamic navigation (reads user investments) |
| `components/ConditionalLayout.tsx` | Excludes layout from login/register |

## Do's and Don'ts

### DO

- Always check authentication in server components with `getCurrentUser()`
- Use RLS-compliant queries (filter by `mitglied_id`)
- Follow German naming conventions for user-facing text
- Use `createBrowserClient()` in client components
- Use `createClient()` from `supabase-server` in server code
- Handle errors with try-catch and German error messages
- Use existing form patterns as templates

### DON'T

- Don't skip auth checks - all data is user-specific
- Don't use `createClient` from wrong file (browser vs server)
- Don't create new types - use existing ones in `supabase-browser.ts`
- Don't add English text in UI - keep everything German
- Don't bypass RLS with service role keys
- Don't store sensitive data in localStorage

## Testing

No automated testing framework is configured. Testing is manual via:
- Test checklists in `docs/guides/`
- Manual verification of forms and calculations

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

## Build & Run

```bash
npm install          # Install dependencies
npm run dev          # Development server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
```

## Recent Architecture Decisions

1. **Server-Client Hybrid**: Server components for data fetching, client components for interactivity
2. **Browser Client Migration**: Components migrated from server client to `supabase-browser.ts`
3. **RLS-First Security**: All data access controlled by PostgreSQL RLS policies
4. **Cookie-based Auth**: Using `@supabase/ssr` for proper session handling

## Documentation Reference

- `docs/setup/` - Installation and setup guides
- `docs/guides/` - Feature guides and test plans
- `docs/troubleshooting/` - Debugging and RLS fixes
- `docs/release-notes/` - Version history
- `docs/DATENSTRUKTUR.md` - Database schema documentation
