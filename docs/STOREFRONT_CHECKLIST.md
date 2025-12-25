# ✅ Checklist: Đẩy Bundles Lên Storefront

## Chuẩn Bị (One-time Setup)

- [ ] **1. Chạy app development**: `npm run dev`
- [ ] **2. Truy cập app trong Shopify Admin**
- [ ] **3. Vào "Setup Storefront" page** (menu navigation)
- [ ] **4. Click "Create Metafield Definitions"**
- [ ] **5. Xác nhận thành công** (banner màu xanh)

## Tạo Bundles

- [ ] **6. Tạo bundle mới** hoặc edit bundle có sẵn
- [ ] **7. Set bundle status = Active**
- [ ] **8. Save bundle**
- [ ] **9. Kiểm tra trong database**: field `bundleProductGid` có giá trị
- [ ] **10. Kiểm tra trong Shopify Admin > Products**: có product type "Bundle"

## Deploy Theme Extension

- [ ] **11. Deploy extension**: `npm run deploy`
- [ ] **12. Vào Online Store > Themes > Customize**
- [ ] **13. Thêm section/block mới**
- [ ] **14. Tìm "Product Bundle" trong App blocks**
- [ ] **15. Add block vào page**
- [ ] **16. Chọn bundle product** trong block settings
- [ ] **17. Save theme**

## Test Storefront

- [ ] **18. Mở storefront page** có bundle block
- [ ] **19. Kiểm tra hiển thị**: tên, mô tả, giá, discount
- [ ] **20. Kiểm tra products list** trong bundle
- [ ] **21. Click "Add Bundle to Cart"**
- [ ] **22. Verify bundle đã vào cart**
- [ ] **23. Test checkout** (optional)

## Troubleshooting (nếu có lỗi)

- [ ] Mở Browser Console → check JavaScript errors
- [ ] Kiểm tra Network tab → xem API calls
- [ ] Verify metafield data: Products > Select bundle product > Metafields
- [ ] Re-deploy extension nếu cần
- [ ] Clear browser cache và test lại

## Done! 🎉

Bundles của bạn giờ đã live trên storefront!
