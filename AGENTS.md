# Modbus2MQTT Engineering Guardrails

## Rule #1 — UTAMAKAN REUSABLE LOGIC DAN COMPONENTS

1. Never copy-paste form layouts, field groups, status pills, table shells, or async `try/catch/setLoading/setError` state handlers across pages or modals.
2. Any UI element used across more than one screen or modal **must** be extracted into:
   - `frontend/src/components/ui/` — headless/styled `shadcn/ui` primitives (`Button`, `Input`, `Select`, `Switch`, `Dialog`, `Tabs`, `Table`, `Card`, `Badge`, `Label`).
   - `frontend/src/components/shared/` — reusable domain components (`AppShell`, `PageHeader`, `FormField`, `StatusBadge`, `NoticeBanner`, `EmptyState`, `SlaveConnectionFields`, `ModbusTargetFields`, `InlineValueControl`, `PointEditorModal`, `RpcEditorModal`).
3. Any business logic, formatting, parsing, or state orchestration used by more than one screen **must** live in:
   - `frontend/src/lib/` — pure formatters, parsers, validators, and default factories (`cn`, `modbus.ts`).
   - `frontend/src/hooks/` — reusable React state/lifecycle hooks (`useBridgeState`, `useAsyncAction`, `useTheme`).

## Rule #2 — Design System Parity (Sensio Tokens + Linear Minimalist Craft)

1. Preserve Sensio's brand & surface tokens in `frontend/src/index.css`:
   - Font stack: `Plus Jakarta Sans` (`--font-sans`) + `JetBrains Mono` (`--font-mono`) with `tabular-nums` for numeric telemetry, addresses, function codes, and timestamps.
   - Brand accent: Sensio Teal (`#0d9488` light / `#14b8a6` dark), restrained strictly to primary actions, active nav/tabs, and focus rings.
   - Surface hierarchy: Near-neutral canvas (`#f8f9fa` / `#09090b`) and card surfaces (`#ffffff` / `#111113`) separated by crisp `1px` hairline borders (`--border`) rather than heavy shadows.
   - Compact Linear density: default control height `h-8` (`32px`), compact `h-7` (`28px`), crisp negative tracking on headings (`-0.02em`), high-signal muted secondary copy (`text-muted-foreground`).
2. Do **not** reintroduce DaisyUI or ad-hoc color hex literals inside feature pages; consume semantic Tailwind tokens (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-primary`).

## Rule #3 — Barrel Boundaries & File Cohesion

1. Every directory (`ui`, `shared`, `hooks`, `lib`, `pages`) exposes a wiring-only `index.ts` containing `export` statements only. Consumers import from directory barrels (`@/components/ui`, `@/components/shared`, `@/hooks`, `@/lib`).
2. Keep every frontend `.ts` / `.tsx` file focused and single-responsibility ($\le 260$ lines). Split large views or forms instead of building monolithic page files.
3. Run `pnpm run check:guardrails && pnpm run typecheck && pnpm test && pnpm run build` before committing.
