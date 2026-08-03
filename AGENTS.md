# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3001, matches NEXTAUTH_URL)
npm run build        # production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run test         # Vitest watch mode
npm run test:cov     # Vitest with coverage report
```

Run a single test file:
```bash
npx vitest run src/features/auth/service/auth.service.spec.ts
```

Pre-commit hook (Husky) runs `lint → build → test` in sequence and blocks the commit on failure.

Required env vars (see `.env.example`):
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — NextAuth
- `MONGO_URI` — MongoDB connection string
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth

## Request Flow

Understanding how a mutation flows through the stack (requires reading multiple files):

1. **Client** calls `http.post('/auth/register', body)` — `http` is a singleton `HttpClient` from `src/shared/lib/http.ts` with `baseUrl='/api'`
2. **API route** (`src/app/api/...`) calls `validateBody(req, ZodSchema)` from `src/shared/middleware/validate-body.ts`; returns 400 on invalid input
3. **Service** (`src/features/<feature>/service/`) receives validated data, returns `ServiceResult<T>` — never throws
4. **Repository** (`src/features/<feature>/repository/`) calls `await mongo.connect()`, runs raw Mongoose query, returns typed document

Route groups: `(public)` for unauthenticated pages, `(protected)` for authenticated pages. `src/proxy.ts` is the Next.js middleware — it inspects `authjs.session-token` cookie only (no DB/Node imports).

Password hashing uses SHA-256 via Node.js `crypto` (not bcrypt). Auth config lives in `src/shared/lib/auth.ts`; session properties (`id`, `role`, `avatar`) are cast inline — no `next-auth.d.ts`.

## 0. CRITICAL — Architecture Discipline and Coding Rules

**NEVER USE INLINE STYLES.** All visual styling must use Tailwind CSS utility classes. Never use the `style` prop or `style={{ }}` on any element under any circumstances.

**NEVER USE ARBITRARY TAILWIND VALUES.** Never write classes like `text-[10px]`, `px-[28px]`, `min-h-[400px]`, `tracking-[0.18em]`, or any `[...]` bracket syntax. Always use Tailwind's standard scale: `text-xs`, `text-sm`, `text-base`, `text-lg`, etc. for font sizes; `p-1`, `p-2`, `px-4`, `py-2`, etc. for spacing; `min-h-96`, `min-h-screen`, etc. for sizing.

**NEVER USE PRIMITIVE HTML ELEMENTS IN PAGE FILES.** In any `page.tsx`, use components for all structural and layout concerns. Header, footer, cards, and any reusable layout must be extracted into components and imported. Do not write raw `<header>`, `<footer>`, `<article>`, or equivalent structural HTML directly in a page file.

**FOOTER ALWAYS LIVES IN `src/shared/components/layout/footer.tsx`.** Never write footer markup inline in a page or layout.

**IT IS CRITICAL TO USE EXACT SAME CODEBASE PATTERNS. NEVER CREATE A FILE OR FOLDER THAT IS OUT OF CONTEXT. EVERY FILE HAS ITS OWN DESIGNATED FOLDER — USE IT ON EVERY PROMPT, NO EXCEPTIONS.**

Rules that must never be broken:
- This is a **feature-based architecture**. Every domain file lives inside `src/features/<feature>/` in its designated subfolder (`schema/`, `repository/`, `service/`, `store/`, `hooks/`, `components/`, `validations/`, `types/`).
- Shared, cross-feature code goes in `src/shared/` under its designated subfolder (`components/`, `hooks/`, `lib/`, `middleware/`, `providers/`, `types/`, `utils/`, `const/`).
- Static constants and arrays go in `src/shared/const/<name>.const.ts`. Never inline constants in page files.
- Never create `_data/`, `_components/`, or any underscore-prefixed folders anywhere.
- Never create one-off utility files, helper files, or random folders outside the structure above.
- Before creating any file, identify which existing folder it belongs to and place it there.

## 1. Project Overview

A production-ready Next.js 16 starter using the App Router with TypeScript, Tailwind CSS, shadcn/ui, NextAuth v5, Mongoose, Zustand, and Zod.

Tech stack:
- Framework: Next.js 16 (App Router)
- Auth: NextAuth v5 (Google OAuth + Credentials, JWT sessions)
- Styling: Tailwind CSS + shadcn/ui
- Database: Mongoose (MongoDB ODM)
- Validation: Zod + react-hook-form + @hookform/resolvers
- State: Zustand (vanilla store + context pattern)
- Testing: Vitest
- Language: TypeScript (strict mode)

## 2. Folder Conventions

Features own all their domain code under `src/features/<feature>/`:
- `schema/` - Mongoose schema, model, inferred type
- `repository/` - DB access layer (only layer that imports Mongoose models)
- `service/` - business logic, always returns `{ data, status }`
- `store/` - Zustand vanilla store factory
- `hooks/` - store hook (e.g., `useAuthStore.ts`) + action hooks (e.g., `use-login.ts`)
- `components/` - feature-specific React components
- `validations/` - Zod schemas and inferred types
- `types/` - TypeScript types for this feature

Shared code lives in `src/shared/`. Global type augmentations live in `src/types/`.

Static constants and arrays live in `src/shared/const/<name>.const.ts`. Never co-locate data files with pages. Never create `_data/`, `_components/`, or any underscore-prefixed folders anywhere in the project.

## 3. Type Rule

Never use `interface`. Always use `type`.

```ts
// correct
type User = { id: string; name: string };

// wrong
interface User { id: string; name: string }
```

Never use `unknown` casts. Use proper schema types throughout the system.

Mongoose schema types use `InferSchemaType` extended with `_id`:
```ts
export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};
```

## 4. Schema Rule

Each feature defines its Mongoose schema, model, and inferred type in `features/<feature>/schema/<name>.schema.ts`. Always extend `InferSchemaType` with `_id` so downstream code never needs `unknown` casts.

```ts
import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserSchema = new Schema({ name: { type: String, required: true } }, { timestamps: true });
export type UserDocument = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };
export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
```

## 5. Route Protection

Route protection uses `src/proxy.ts` (not `middleware.ts`). It runs in the Edge Runtime and must NOT import any Node.js modules (`crypto`, `mongoose`, etc.) or the auth config. It only inspects the session cookie (`authjs.session-token` / `__Secure-authjs.session-token`) and redirects unauthenticated requests to `/`.

## 6. API Route Rules

API routes are thin controllers only. Rules:
- Always use `validateBody` from `@/shared/middleware/validate-body`
- Call the service, return JSON
- Always catch errors to 500

```ts
export async function POST(req: NextRequest) {
  try {
    const validated = await validateBody(req, SomeSchema);
    if (validated instanceof NextResponse) return validated;
    const result = await someService(validated.data);
    return NextResponse.json(result.data, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

## 7. Service Rules

- Always return `{ data, status }` (type: `ServiceResult<T>` from `@/shared/types/common`)
- Never throw for handled cases, return error objects
- Call repository only. Never import Mongoose models directly in services.

```ts
export async function myService(input: InputType): Promise<ServiceResult<OutputType>> {
  const item = await repository.findById(input.id);
  if (!item) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: item, status: 200 };
}
```

## 8. Repository Rules

- Only layer that imports Mongoose models.
- Call `await mongo.connect()` at the start of every method.
- Use `.lean()` for read operations.
- Never use `unknown` casts — use the feature's `Document` type directly.
- **Repositories only execute raw DB queries** (`findOne`, `findById`, `find`, `create`, `updateOne`, `findByIdAndUpdate`, `findByIdAndDelete`, etc.). No conditionals, no business decisions, no if/else logic based on data. That belongs in the service layer.

```ts
import { mongo } from '@/shared/lib/mongo';
import { UserDocument, UserModel } from '@/features/auth/schema/user.schema';

export const userRepository = {
  async findById(id: string): Promise<UserDocument | null> {
    await mongo.connect();
    return UserModel.findById(id).lean() as Promise<UserDocument | null>;
  },
  async create(data: Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await UserModel.create(data);
    return doc._id.toString();
  },
};
```

## 9. Validation Rules

Zod schemas live in `features/<feature>/validations/<feature>.validation.ts`. Export the schema and inferred type.

```ts
import { z } from 'zod';
export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
export type LoginType = z.infer<typeof LoginSchema>;
```

## 10. Zustand Pattern

Three files per feature store:
1. `features/<feature>/store/<feature>-store.ts` - vanilla store factory using `createStore` from `zustand/vanilla`
2. `features/<feature>/hooks/use<Feature>Store.ts` - context + `useStore` hook
3. `shared/providers/store-provider.tsx` - combines all store contexts

All three files are required for each feature store.

## 11. Hook Rules

Store hooks and action hooks are separate files:
- `useAuthStore.ts` - reads/writes to store via context
- `use-login.ts` - action hook: handles async logic, updates store state

Never put async action logic in the store hook file.

## 12. Form Rule

Use `react-hook-form` with `zodResolver`. Never use manual state for forms.

```ts
const form = useForm<LoginType>({
  resolver: zodResolver(LoginSchema),
  defaultValues: { email: '', password: '' },
});
```

## 13. OOP Lib Rule

All classes in `shared/lib/` must use class syntax and export a singleton instance. Every file in `shared/lib/` must have a co-located `.spec.ts` test file.

```ts
class MongoClientManager { ... }
export const mongo = new MongoClientManager();
```

## 14. Test Conventions

- Test files use `.spec.ts` extension and are co-located with the source file.
- Every file in `shared/lib/` must have a `.spec.ts` — these are critical shared utilities.
- In service tests, mock at the repository boundary. Never mock Mongoose models directly.
- Use `vi.mock('@/features/auth/repository/user.repository')` (always `@/` alias, never relative `../`).

## 15. Naming Conventions

- Files: kebab-case (`use-login.ts`, `auth-store.ts`)
- Components: PascalCase (`LoginForm`, `Header`)
- Functions: camelCase (`loginService`, `fetchSessions`)
- Store hook files: PascalCase prefix (`useAuthStore.ts`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)

## 16. Import Rules

- Always use `@/` alias. Never use `../` for cross-directory imports.
- Only `./` (same directory) is allowed for relative imports.

## 17. Zod ObjectId Constraint

For MongoDB ObjectId fields in Zod schemas, use `.min(24).max(24)`:

```ts
userId: z.string().min(24).max(24)
```

## 18. Auth Pattern

NextAuth uses JWT strategy with Google OAuth + Credentials providers. The `jwt` callback always fetches the user from DB to keep role/avatar fresh on every token refresh.

Never create `next-auth.d.ts` or any global NextAuth type augmentation files. Use inline local `type SessionUser = { ... }` casts wherever session user properties like `id` or `role` are needed.

OAuth users are persisted via `userRepository.upsertOAuthUser()`. `passwordHash` is optional (empty string for OAuth users).
