# Vistora · Supabase Database & Role-Based Access Control (RBAC)

This guide documents the database schema, user roles, and security policies for the Vistora operations workspace connected to Supabase PostgreSQL at `https://ralbhldjygvdwjfrgufx.supabase.co`.

---

## 1. Role-Based Access Control (RBAC) Architecture

Vistora enforces three distinct operational tiers:

| Role | Persona | Permissions |
| :--- | :--- | :--- |
| **`admin`** | General Manager / Executive | Full governance: view all hotel properties, modify status of all feedback, assign staff, inject test records, export CSV reports, and manage settings. |
| **`staff`** | Department Operations Lead | Operational triage: view assigned property feedback, update status (`Under Review`, `Resolved`), submit internal resolution notes, and track SLAs. |
| **`visitor`** | Guest Auditor / Preview | Read-only observation: inspect live feedback, view rating distribution bars and volume charts. Mutation actions (e.g. resolving complaints or changing status) are locked with an informative prompt. |

---

## 2. Supabase Tables Overview

The workspace connects directly to the following tables in the `public` schema:

1. **`feedback`** (Live — 8 records)
   - Stores guest ratings (1 to 5), department (`Housekeeping`, `Front Desk`, `Food & Beverage`, `Concierge`, `Facilities & Room`, `Spa & Wellness`, `Valet & Transfers`), comments, tone, SLA deadline, status (`needs_attention`, `under_review`, `resolved`, `escalated`), and resolution notes.
2. **`properties`** (Live — 3 luxury resorts)
   - Anantara Chiang Mai Resort (`ACM`), Anantara Riverside Bangkok (`ARB`), Anantara Siam Bangkok (`ASB`).
3. **`stays`** (Live — 4 records)
   - Guest stays linking `guest_id`, `room_number`, `check_in_date`, `check_out_date`, and `public_token`.
4. **`guests`** (Live — 4 records)
   - Guest profiles with VIP tier and contact details.
5. **`auth.users`** (Supabase Auth)
   - Authenticated user accounts managed by Supabase.
6. **`profiles`** (`user_role` enum)
   - Profile extension linked to `auth.users(id)` storing `role`, `full_name`, and assigned `property_id`.

---

## 3. Creating the `profiles` Table in Supabase

The application automatically synchronizes user roles in `auth.users.user_metadata`. To create the dedicated `public.profiles` table visible in your Supabase Table Editor:

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/ralbhldjygvdwjfrgufx/sql/new).
2. Copy and paste the contents of [`supabase/create_profiles_table.sql`](file:///Users/MAC/Repository/Vistora/supabase/create_profiles_table.sql).
3. Click **Run**.
4. The `public.profiles` table will be created with Row Level Security (RLS) policies and an automated trigger that synchronizes future auth signups into profiles.

---

## 4. 1-Click Role Testing in the Application

- **On Home Page (`/`)**: Overview of the platform with live statistics pulled from Supabase.
- **On Sign In Page (`/login`)**: Use the 1-click test buttons for **Admin**, **Staff**, and **Visitor** to sign in immediately.
- **On Operations Dashboard (`/dashboard`)**: Use the interactive Quick Role Switcher widget in the topbar (`👑 Admin`, `🛎️ Staff`, `👁️ Visitor`) to test role permissions on the fly without logging out.
