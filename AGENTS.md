# AGENTS.md
This file provides guidance to Verdent when working with code in this repository.

## Table of Contents
1. Commonly Used Commands
2. High-Level Architecture & Structure
3. Key Rules & Constraints
4. Development Hints

## Commands
- `npm run dev` - Start the Vite development server
- `npm run build` - Build the application for production
- `npm run test` - Run unit tests with Vitest
- `npm run preview` - Preview the production build locally
- `git commit -m "type(scope): description"` - Commit format (Conventional Commits)

## Architecture
- **Major Subsystems:**
  - **Frontend:** React 19, TypeScript, Vite.
  - **Backend:** Supabase (Auth, PostgreSQL, Realtime).
  - **Routing:** Handled in `App.tsx` with role-based permission checks.
  - **Access Control:** Hierarchical RBAC (Owner, Manager, Agent, etc.).
- **Directory Structure:**
  - `components/` - React components (Root level, NOT in `src/`).
  - `services/` - Business logic and API calls.
  - `hooks/` - Custom React hooks.
  - `utils/` - Utility functions.
  - `conductor/` - Project guidelines and tracks.
- **Data Flow:**
  - Direct Supabase queries from components/services.
  - Real-time updates via Supabase Subscriptions.
  - No global state library (Redux/Zustand); relies on React Context and local state.

## Key Rules & Constraints
- **Code Style:**
  - Components: PascalCase (e.g., `SalesOrderView.tsx`).
  - Utilities: camelCase.
  - One component per file.
  - **Strict TypeScript:** No `any` types unless absolutely necessary.
- **Testing:**
  - **Framework:** Vitest + React Testing Library.
  - **Location:** Co-located `__tests__` directories or `*.test.tsx` next to source.
  - **Principle:** Test-Driven Development (TDD) preferred.
- **File Placement:**
  - **Do NOT** put new components in `src/` unless specifically directed (use root `components/`).
  - **Do NOT** use `src/` for main application logic; follow the root-level pattern.
- **Workflow:**
  - Atomic commits with descriptive messages.
  - Verify tests pass before completing tasks.

## Development Hints
- **Adding a New Module:**
  1. Create component in `components/`.
  2. Add route/permission check in `App.tsx`.
  3. Register module ID in RBAC system if restricted.
- **State Management:**
  - Prefer optimistic updates for better UX (see `utils/optimisticUpdates.ts`).
  - Use `subscriptionManager.ts` for real-time features.
- **Styling:**
  - Check `index.css` for design tokens/variables.
  - Use `lucide-react` for icons.
- **Supabase Integration:**
  - Ensure RLS policies on the backend match frontend permission logic.
  - Use `services/` for all database interactions to keep components clean.
