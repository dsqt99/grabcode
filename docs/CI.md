# CI — chạy y hệt GitHub Actions ở local

Workflow: `.github/workflows/ci.yml`, chạy trên mọi `pull_request` và `push` vào `main`. Hai job chạy song song:

| Job | Bước |
|---|---|
| `check` | install → contract drift → lint → typecheck → test |
| `build` | install → `pnpm build` (Next.js `web`, `coder`, `admin` + `contracts`), có cache `apps/*/.next/cache` |

Môi trường: Ubuntu, Node 22, pnpm theo `packageManager` trong `package.json` (hiện `10.15.1`). Không cần `.env`, Postgres hay NATS — test hiện tại là unit test (`tsx --test`).

## Chạy local

Cần Node 22 và `corepack enable` (để có đúng pnpm 10.15.1).

```bash
pnpm install --frozen-lockfile
pnpm generate && git diff --exit-code packages/contracts   # contract drift
pnpm lint        # eslint . (eslint.config.mjs)
pnpm typecheck   # tsc --noEmit ở từng package
pnpm test        # script "test" của từng package (--if-present)
pnpm build       # pnpm -r run build
```

## Lỗi hay gặp

- **Contract drift đỏ**: đã sửa zod trong `packages/contracts/src` nhưng chưa commit file sinh ra. Chạy `pnpm generate` rồi commit `packages/contracts/openapi/` và `packages/contracts/events/`.
- **`--frozen-lockfile` lỗi**: đổi `package.json` mà chưa cập nhật lockfile. Chạy `pnpm install` rồi commit `pnpm-lock.yaml`.

## Thêm test mới

Thêm script `test` vào `package.json` của package đó (Vitest, Playwright…). `pnpm test` ở gốc tự gọi, CI không cần sửa. Test cần trình duyệt/DB thì thêm bước cài đặt hoặc service vào job `check`.

## Cập nhật phụ thuộc

`.github/dependabot.yml` mở PR hằng tuần cho npm và GitHub Actions; bản minor/patch gom thành một PR mỗi loại.
