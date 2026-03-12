# Fee Amortization Management System (费用摊销管理系统)

## Overview
A full-stack multi-entity expense amortization system. Supports importing fees from expense control platforms, assigning them to accounting entities, configuring amortization templates by category, auto-generating monthly amortization tables per entity, and providing JSON API for generating financial vouchers.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn/UI + TanStack Query + Wouter
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **File Parsing**: xlsx (for Excel/CSV import)
- **File Upload**: multer
- **AI**: OpenAI via Replit AI Integrations (for intelligent fee category matching during import)

## Architecture
```
client/src/
  App.tsx           - Main app with sidebar navigation
  pages/
    dashboard.tsx   - Overview page with stats
    entity.tsx      - Entity (主体) management
    fees.tsx        - Fee import & per-fee amortization config
    accounts.tsx    - Account subject management
    rules.tsx       - Rule template management (category-level defaults)
    amort-table.tsx - Monthly amortization table (entity-filterable)
    vouchers.tsx    - Voucher generation & history (per-entity)
  components/
    app-sidebar.tsx - Navigation sidebar

server/
  index.ts    - Express server entry
  routes.ts   - All API routes
  storage.ts  - Database storage layer
  db.ts       - Database connection
  seed.ts     - Seed data (3 entities, 5 accounts, 4 templates, 4 fees)

shared/
  schema.ts   - Drizzle schema + types
```

## Database Tables
- `entities` - Accounting entities (核算主体: 总公司, 分公司 etc.)
- `accounts` - Chart of accounts (debit/credit subjects)
- `rule_templates` - Category-level amortization rule templates (name, defaultMonths, default accounts)
- `fees` - Imported fee records with entityId and inline amortization config
- `amortization_entries` - Monthly amortization schedule entries (references feeId)
- `vouchers` - Generated financial vouchers with entityId

## Key Design
### Multi-Entity Support
Each fee belongs to a specific entity. Amortization tables and vouchers can be filtered/generated per entity. Voucher generation requires selecting a specific entity.

### Two-Level Amortization Config
1. **Rule Templates** (摊销规则): Category-level defaults (e.g., "房租"→12个月, "装修费"→36个月)
2. **Per-Fee Config** (费用摊销配置): Each fee has its own amortization config, auto-filled from template but individually overridable

## API Endpoints
- `GET/POST/PUT/DELETE /api/entities` - Entity CRUD
- `POST /api/import-fee` - Import fees (no entityId needed; entity auto-detected from 支付公司 column)
- `GET /api/fees?entityId=` - List fees, optional entity filter
- `POST /api/configure-fee-amort/:id` - Configure per-fee amortization
- `GET /api/amort-table?month=&entityId=` - Monthly amortization table
- `POST /api/generate-voucher` - Generate vouchers (requires entityId)
- `GET /api/vouchers?month=&entityId=` - Voucher list (JSON)
- CRUD: `/api/accounts`, `/api/rule-templates`
- `GET /api/dashboard` - Dashboard stats

## Key Features
- Multi-entity accounting support
- Excel/CSV import in standard format (单号, 标题, 支付公司, 支付日期, 费用类型名称, 金额, 消费事由)
- Auto-create entity from 支付公司 column; duplicate detection by 单号
- AI-powered (OpenAI) fee category matching: matches imported 费用类型名称 to existing rule templates; auto-creates new template if no match found
- Category-level rule templates with auto-matching on import
- Per-fee amortization config with template defaults + individual override
- Equal monthly amortization with tail difference adjustment
- Start month auto-derived from fee occurrence date
- Entity-filtered amortization tables and vouchers
- Voucher generation per entity with JSON API for financial system integration
- All UI in Chinese (简体中文)
