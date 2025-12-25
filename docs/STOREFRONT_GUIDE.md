# 📦 Hướng Dẫn Đẩy Bundles Lên Storefront

## 🎯 Tổng Quan

Tài liệu này hướng dẫn chi tiết cách đẩy danh sách bundles từ Admin App lên Storefront để khách hàng có thể xem và mua.

## ✅ Đã Có Gì?

### Backend (Hoàn chỉnh ✓)

- ✅ Database schema với Bundle và BundleItem models
- ✅ CRUD operations cho bundles
- ✅ Admin UI để quản lý bundles (tạo/sửa/xóa)
- ✅ Tính toán giá và discount logic
- ✅ Upload hình ảnh cho bundles

### Storefront Integration (Mới thêm ✓)

- ✅ Helper functions để sync bundles với Shopify Products
- ✅ Metafields để lưu bundle data
- ✅ Theme Extension blocks để hiển thị
- ✅ JavaScript để handle Add to Cart
- ✅ Auto-sync khi tạo/sửa/xóa bundles

## 🚀 Cách Sử Dụng

### Bước 1: Setup Metafield Definitions

1. Chạy app development server:

   ```bash
   npm run dev
   ```

2. Truy cập app trong Shopify Admin

3. Vào menu **"Setup Storefront"** (link mới được thêm vào navigation)

4. Click nút **"Create Metafield Definitions"**
   - Tạo metafield `custom.bundle_data` cho products
   - Metafield này sẽ visible trên Storefront API

5. Kiểm tra kết quả - nếu thành công sẽ thấy thông báo xanh

### Bước 2: Tạo hoặc Cập Nhật Bundles

Khi bạn **tạo mới** hoặc **chỉnh sửa** bundle trong Admin:

- App sẽ tự động tạo/cập nhật một Shopify Product tương ứng
- Bundle data sẽ được lưu vào metafield `custom.bundle_data`
- Product này sẽ có:
  - Title: `[Bundle] Tên Bundle`
  - Product Type: `Bundle`
  - Price: Giá sau discount
  - Compare At Price: Giá gốc
  - Status: ACTIVE nếu bundle active, DRAFT nếu không

### Bước 3: Deploy Theme Extension

1. Deploy extension lên Shopify:

   ```bash
   npm run deploy
   ```

2. Trong Shopify Admin, vào **Online Store > Themes**

3. Click **Customize** trên theme đang active

4. Thêm **"Product Bundle" block** vào bất kỳ section nào:
   - Product pages
   - Collection pages
   - Home page
   - Custom landing pages

5. Trong settings của block:
   - Chọn product có type = "Bundle"
   - Block sẽ tự động hiển thị bundle info từ metafield

### Bước 4: Test Trên Storefront

1. Vào storefront và navigate đến page có bundle block

2. Kiểm tra hiển thị:
   - ✅ Tên bundle và mô tả
   - ✅ Discount badge (Save X%)
   - ✅ Giá gốc và giá sau discount
   - ✅ Danh sách products trong bundle
   - ✅ Nút "Add Bundle to Cart"

3. Test add to cart:
   - Click nút "Add Bundle to Cart"
   - Bundle product sẽ được thêm vào cart
   - Cart badge sẽ update (nếu theme support)

## 📁 Files Đã Tạo/Cập Nhật

### Backend Files

- `app/utils/bundleMetafields.ts` - Helper functions để sync với Shopify
- `app/routes/app.bundles.setup-metafields.tsx` - UI setup metafields
- `app/routes/app.bundles.new.tsx` - Updated để sync khi tạo bundle
- `app/routes/app.bundles.$bundleId.edit.tsx` - Updated để sync khi sửa bundle
- `app/routes/app._index.tsx` - Updated để xóa Shopify product khi xóa bundle

### Frontend Files

- `extensions/bundle-extension/blocks/bundle_display.liquid` - Liquid template hiển thị bundle
- `extensions/bundle-extension/assets/bundle-display.js` - JavaScript xử lý add to cart

## 🔧 Cấu Trúc Metafield Data

Bundle data được lưu trong metafield với structure:

```json
{
  "bundleId": "cuid_of_bundle",
  "name": "Bundle Name",
  "description": "Bundle description",
  "discountType": "percentage",
  "discountValue": 20,
  "active": true,
  "items": [
    {
      "productId": "gid://shopify/Product/123",
      "variantId": "gid://shopify/ProductVariant/456",
      "quantity": 1,
      "price": 29.99
    }
  ],
  "originalPrice": 59.98,
  "bundlePrice": 47.98,
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

## 🎨 Customization

### Tùy Chỉnh Giao Diện

Edit file `extensions/bundle-extension/blocks/bundle_display.liquid`:

```liquid
<style>
  .bundle-block {
    /* Thay đổi colors, spacing, fonts */
    border-color: #your-color;
    border-radius: 12px;
  }

  .bundle-add-to-cart {
    background: #your-brand-color;
  }
</style>
```

### Thêm Logic Tùy Chỉnh

Edit file `extensions/bundle-extension/assets/bundle-display.js`:

```javascript
async function handleBundleAddToCart(event) {
  // Thêm custom logic trước/sau khi add to cart
  // Ví dụ: Analytics tracking, custom notifications, etc.
}
```

## 🔍 Storefront API Query

Nếu muốn fetch bundles từ Storefront API (advanced):

```graphql
query GetBundles {
  products(first: 10, query: "product_type:Bundle") {
    edges {
      node {
        id
        title
        description
        featuredImage {
          url
        }
        variants(first: 1) {
          edges {
            node {
              id
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
            }
          }
        }
        metafield(namespace: "custom", key: "bundle_data") {
          value
          type
        }
      }
    }
  }
}
```

## 🚨 Troubleshooting

### Bundle không hiển thị trên Storefront

1. ✅ Kiểm tra bundle đã được set `active: true`
2. ✅ Kiểm tra metafield definition đã được tạo (Setup Storefront page)
3. ✅ Kiểm tra Shopify product đã được tạo (xem field `bundleProductGid` trong database)
4. ✅ Deploy lại extension: `npm run deploy`

### Add to Cart không hoạt động

1. ✅ Kiểm tra JavaScript file đã được load
2. ✅ Mở Console để xem error messages
3. ✅ Kiểm tra theme có support AJAX cart API không
4. ✅ Test với product thông thường trước

### Metafield không visible

1. ✅ Chạy lại "Create Metafield Definitions"
2. ✅ Kiểm tra scope có `read_products` và `write_products`
3. ✅ Trong Admin, vào Settings > Custom Data > Products để verify

## 📊 Database Schema

Bundle được lưu trong database với fields:

```prisma
model Bundle {
  id                  String        @id @default(cuid())
  name                String
  description         String?
  imageUrl            String?
  discountType        String?
  discountValue       Float?
  active              Boolean       @default(false)
  startDate           DateTime?
  endDate             DateTime?
  shopDomain          String
  bundleProductGid    String?       // GID của Shopify Product
  items               BundleItem[]
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}
```

## 🎯 Phương Án Khác (Advanced)

### Option 2: App Proxy (Nếu cần custom API)

Nếu cần custom endpoints hoặc server-side logic phức tạp:

1. Tạo App Proxy route trong `shopify.app.toml`:

```toml
[app_proxy]
url = "https://your-app-url.com/api/storefront"
subpath = "bundles"
prefix = "apps"
```

2. Tạo API routes:

```typescript
// app/routes/api.storefront.bundles.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  // Fetch bundles from database
  // Return JSON for storefront
}
```

3. Theme gọi API:

```javascript
fetch("/apps/bundles/list")
  .then((res) => res.json())
  .then((bundles) => renderBundles(bundles));
```

### Option 3: Headless với Storefront API

Nếu sử dụng headless/custom frontend:

1. Expose bundles qua GraphQL custom app
2. Frontend fetch trực tiếp từ Storefront API
3. Không cần Liquid templates

## 📚 Resources

- [Shopify Metafields Documentation](https://shopify.dev/docs/apps/build/custom-data/metafields)
- [Theme Extensions Documentation](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- [Storefront API Reference](https://shopify.dev/docs/api/storefront)
- [AJAX Cart API](https://shopify.dev/docs/api/ajax/reference/cart)

## 💡 Best Practices

1. **Performance**: Cache bundle data nếu có nhiều bundles
2. **SEO**: Đảm bảo bundle products có proper title, description
3. **Analytics**: Track bundle purchases separately
4. **Inventory**: Consider inventory management cho bundle items
5. **Testing**: Test trên mobile và desktop browsers

## 🎉 Kết Luận

Bây giờ bạn đã có:

- ✅ Backend quản lý bundles hoàn chỉnh
- ✅ Auto-sync bundles với Shopify products
- ✅ Theme extension để hiển thị bundles
- ✅ Add to cart functionality
- ✅ Metafields để store và expose data

**Next Steps:**

1. Chạy setup metafields
2. Tạo vài test bundles
3. Deploy theme extension
4. Test trên storefront
5. Customize styling theo brand
6. Add analytics tracking nếu cần

Chúc may mắn! 🚀
