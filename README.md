# Frühstück Bestellen (Clean Rebuild)

German-only breakfast module built with:
- Next.js (App Router)
- JavaScript
- Tailwind CSS
- Supabase (Postgres + Storage)

## Core Routes

- `app/order` customer order page
- `app/staff` staff dashboard
- `app/admin` admin dashboard
- `app/api/orders` create order endpoint
- `app/api/staff/orders` staff list endpoint
- `app/api/staff/orders/[id]/deliver` deliver endpoint
- `app/api/admin/summary` analytics endpoint
- `app/api/admin/products` product edit endpoint
- `app/api/admin/menus` menu CRUD endpoint
- `app/api/admin/upload` image upload endpoint

## Database Reset

Run:

- `supabase/migrations/20260601090000_breakfast_reset.sql`

This script drops old breakfast tables/functions and creates one consistent schema plus `create_order`.
- `lib` i18n, supabase, business helpers
- `supabase/schema.sql` database schema + atomic function
- `supabase/seed.sql` initial products + menu

## API Routes

- `POST /api/orders`
- `GET /api/staff/orders`
- `PATCH /api/staff/orders/[id]/deliver`
- `GET /api/admin/summary`
- `GET|POST|PATCH /api/admin/products`
- `GET|POST|PATCH|DELETE /api/admin/menus`

## Business Rules Included

- Orders allowed only between 16:00 and 21:00 (Berlin time)
- Pickup date always tomorrow
- Customer name required
- At least one item required
- Max quantity per product enforced
- Daily order number generated atomically via Postgres function `create_order`
- Orders are never deleted in workflow, only status updates

## Test Cases

1. Valid order:
   - Add customer name + at least one product/menu item
   - Place order during 16:00–21:00
   - Expect order number in success response

2. Empty order:
   - Submit without quantities
   - Expect validation error

3. Outside time:
   - Submit before 16:00 or after 21:00
   - Expect "orders only allowed" error

4. Simultaneous orders:
   - Create multiple parallel `POST /api/orders`
   - Expect unique order numbers for same `pickup_date`

## Setup

1. Install dependencies:
   - `npm install`

2. Create env file:
   - Copy `.env.example` to `.env.local`

3. In Supabase SQL editor:
   - Run `supabase/schema.sql`
   - Run `supabase/seed.sql`

4. Start app:
   - `npm run dev`

Default local URL:
- `http://localhost:3000/de/order`
