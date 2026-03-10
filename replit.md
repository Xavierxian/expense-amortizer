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
    fees.tsx        - Fee import & management
    accounts.tsx    - Account subject management
    rules.tsx       - Amortization rule configuration
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
- `fees` - Imported fee records
- `amortization_rules` - Amortization rules per fee
- `amortization_entries` - Monthly amortization schedule entries
- `vouchers` - Generated financial vouchers

## API Endpoints
- `POST /api/import-fee` - Import fees from Excel/CSV
- `POST /api/set-amort-rule` - Set amortization rule for a fee
- `GET /api/amort-table?month=YYYY-MM` - Get monthly amortization table
- `POST /api/generate-voucher` - Batch generate vouchers
- `GET /api/vouchers?month=YYYY-MM` - Get voucher list (JSON)
- CRUD endpoints for accounts and fees

## Key Features
- Excel/CSV import with duplicate detection by fee code
- Equal monthly amortization with tail difference adjustment
- Configurable debit/credit accounts per fee
- Auto-calculated cumulative and remaining amounts
- Voucher generation with standard debit/credit entries
- JSON API for financial system integration
