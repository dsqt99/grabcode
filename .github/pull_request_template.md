## Thay đổi gì, vì sao

<!-- Task (HON-xx) + tóm tắt ngắn. -->

## Cách kiểm thử

<!-- Lệnh đã chạy, màn hình đã xem, dữ liệu đã thử. -->

## Checklist

- [ ] Chạy như CI ở local (`docs/CI.md`): `pnpm generate` không đổi file, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` đều xanh
- [ ] Đổi schema thì sửa ở `packages/contracts` trước và commit kết quả `pnpm generate`
- [ ] Có test cho phần sửa (hoặc ghi rõ vì sao chưa)
- [ ] Không commit secret / `.env`; không thêm số liệu marketing giả
- [ ] Cập nhật `CHECKLIST.md` nếu xong một hạng mục
