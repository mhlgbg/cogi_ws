# Tenant Storage Upload: đăng ký `moduleKey -> allowed featureKeys`

Tài liệu ngắn này mô tả cách mở rộng mapping phân quyền upload tenant-scoped.

## Vị trí cấu hình

- Backend policy: `cogi-admin/src/policies/tenant-storage-upload-access.ts`
- Hằng số: `MODULE_FEATURE_RULES`

## Khi thêm module upload mới

1. Xác định `moduleKey` mà client gửi lên API upload.
2. Xác định danh sách `feature.key` hợp lệ của module đó (tenant feature + tenant role permission).
3. Thêm rule vào `MODULE_FEATURE_RULES`:
   - `test(moduleKey)` phải match đúng namespace module.
   - `featureKeys` chỉ chứa feature của module đó.
4. Không tái sử dụng feature của module khác để tránh privilege escalation.

## Mapping hiện có

- `sports-club` -> `sports-club.manage`
- `sports-profile` -> `sports-profile.manage`
- `sports-achievement` -> `sports-achievement.manage`
- `sports-achievement-submission` -> `sports-achievement-submission.manage`
- `community` / `community/*` -> `community-post.manage`, `community-group.manage`, `community-config.manage`

## Nguyên tắc bảo mật bắt buộc

- Không dùng `storage.manage` để mở quyền upload module thường.
- Nếu `moduleKey` không có rule: API phải từ chối (`module_feature_mapping_invalid`).
- Nếu client gửi `featureKey/featureKeys[]` không thuộc rule của `moduleKey`: phải từ chối.
- Chỉ chấp nhận upload khi đồng thời thỏa:
  - tenant hợp lệ + active membership
  - tenant đã bật feature tương ứng
  - user có tenant-scoped permission tương ứng

## Checklist khi merge module mới

- [ ] Đã thêm rule `moduleKey -> featureKeys` ở policy
- [ ] Đã truyền `moduleKey` + `featureKey` đúng từ frontend caller
- [ ] Đã có test API upload success/forbidden cho module mới
- [ ] Đã kiểm tra không thể giả mạo `featureKey` từ module khác

