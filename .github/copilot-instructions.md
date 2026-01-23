# EEDC - Electronic Energy Data Collection

## Architecture Overview
Next.js 15 app with App Router for energy data management. Supabase backend handles PV plant data, monthly consumption/generation metrics, and investment tracking for sustainable alternatives (EVs, heat pumps, storage).

**Key Data Flows:**
- Server components fetch from Supabase tables (`anlagen`, `monatsdaten`, `alternative_investitionen`)
- Client forms submit data with error handling and router navigation
- Charts (Recharts) visualize aggregated metrics from monthly data

## Core Patterns
- **Forms**: Client components with `useState` for form data, async `handleSubmit` inserting to Supabase, `router.refresh()` or `router.push()` on success
- **Data Fetching**: Server functions use `supabase.from().select()` with ordering, e.g., `order('jahr').order('monat')`
- **Flexible Data**: Investment parameters stored as JSONB objects, parsed in components like `InvestitionFormSimple.tsx`
- **German Naming**: Variables/components use German terms (e.g., `pv_erzeugung_kwh`, `gesamtverbrauch_kwh`)

## Developer Workflows
- **Setup**: Copy `.env.local.example` to `.env.local`, add Supabase URL/key, run `sql/investition-monatsdaten.sql` in Supabase SQL Editor
- **Development**: `npm run dev` starts dev server, `npm run build` for production
- **Data Types**: Defined in `lib/supabase.ts`, extend interfaces for new fields

## Component Examples
- **Dashboard**: Aggregates totals from `monatsdaten` in `app/page.tsx`
- **Monthly Input**: `MonatsdatenForm.tsx` handles PV generation, consumption, feed-in data
- **Investments**: `InvestitionFormSimple.tsx` manages different investment types with type-specific parameters

## Conventions
- Use `toNum()` helper for safe number conversion from DB values
- Handle loading/error states in forms with `setLoading`/`setError`
- Fetch `mitglied_id` from `mitglieder` table for data association