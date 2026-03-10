# Fee Amortization Management System (费用摊销管理系统)

## Overview
A full-stack expense amortization system that supports importing fees from expense control platforms, setting amortization periods and accounts, auto-generating monthly amortization tables, and providing API interfaces for generating financial vouchers.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn/UI + TanStack Query + Wouter
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **File Parsing**: xlsx (for Excel/CSV import)
- **File Upload**: multer

## Architecture
```
client/src/
  App.tsx           - Main app with sidebar navigation
  pages/
    dashboard.tsx   - Overview page with stats
    fees.tsx        - Fee import & per-fee amortization config
    accounts.tsx    - Account subject management
    rules.tsx       - Rule template management (category-level defaults)
    amort-table.tsx - Monthly amortization table
    vouchers.tsx    - Voucher generation & history
  components/
    app-sidebar.tsx - Navigation sidebar

server/
  index.ts    - Express server entry
  routes.ts   - All API routes
  storage.ts  - Database storage layer
  db.ts       - Database connection
  seed.ts     - Seed data

shared/
  schema.ts   - Drizzle schema + types
```

## Database Tables
- `accounts` - Chart of accounts (debit/credit subjects)
- `rule_templates` - Category-level amortization rule templates (name, defaultMonths, default accounts)
- `fees` - Imported fee records with inline amortization config (amortMonths, startMonth, endMonth, debitAccountId, creditAccountId, amortConfigured)
- `amortization_entries` - Monthly amortization schedule entries (references feeId only)
- `vouchers` - Generated financial vouchers

## Key Design: Two-Level Amortization Config
1. **Rule Templates** (摊销规则): Category-level defaults. E.g., "房租" defaults to 12 months, "装修费" defaults to 36 months. Templates define default months and default debit/credit accounts.
2. **Per-Fee Config** (费用摊销配置): Each individual fee carries its own amortization config. On import, fees auto-match a template by name keyword (longest match) to pre-fill defaults, but users can override months per fee (e.g., rent might be 12 or 3 months). Start month is auto-derived from fee date.

## API Endpoints
- `POST /api/import-fee` - Import fees from Excel/CSV (auto-matches rule templates)
- `POST /api/configure-fee-amort/:id` - Configure/confirm per-fee amortization (months, accounts)
- `GET /api/amort-table?month=YYYY-MM` - Get monthly amortization table
- `POST /api/generate-voucher` - Batch generate vouchers for a month
- `GET /api/vouchers?month=YYYY-MM` - Get voucher list (JSON)
- CRUD: `/api/accounts`, `/api/rule-templates`, `/api/fees`
- `GET /api/dashboard` - Dashboard stats

## Key Features
- Excel/CSV import with duplicate detection by fee code
- Category-level rule templates with auto-matching on import
- Per-fee amortization config with template defaults + individual override
- Equal monthly amortization with tail difference adjustment
- Start month auto-derived from fee occurrence date
- Configurable debit/credit accounts per fee
- Auto-calculated cumulative and remaining amounts
- Voucher generation with standard debit/credit entries
- JSON API for financial system integration
- All UI in Chinese (简体中文)
