import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    if (actionType === "read_products") {
      // ✅ TEST READ PRODUCTS - Sẽ thành công với read_products scope
      const response = await admin.graphql(
        `#graphql
        query getProducts {
          products(first: 5) {
            edges {
              node {
                id
                title
                status
                createdAt
              }
            }
          }
        }`,
      );
      const data = await response.json();

      if (data.errors) {
        const errorMessage = data.errors[0]?.message || "Unknown error";
        const errorCode = data.errors[0]?.extensions?.code;
        const isAccessDenied =
          errorMessage.toLowerCase().includes("access denied") ||
          errorMessage.toLowerCase().includes("access scope") ||
          errorCode === "ACCESS_DENIED";

        return {
          success: false,
          action: "read_products",
          error: errorMessage,
          errorCode: errorCode,
          needsUpgrade: isAccessDenied,
          data: null,
        };
      }

      return {
        success: true,
        action: "read_products",
        data: data.data.products.edges,
        error: null,
      };
    } else if (actionType === "read_orders") {
      // ✅ TEST READ ORDERS - Sẽ thành công với read_orders scope
      const response = await admin.graphql(
        `#graphql
        query getOrders {
          orders(first: 5) {
            edges {
              node {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }`,
      );
      const data = await response.json();

      if (data.errors) {
        const errorMessage = data.errors[0]?.message || "Unknown error";
        const errorCode = data.errors[0]?.extensions?.code;
        const isAccessDenied =
          errorMessage.toLowerCase().includes("access denied") ||
          errorMessage.toLowerCase().includes("access scope") ||
          errorCode === "ACCESS_DENIED";

        return {
          success: false,
          action: "read_orders",
          error: errorMessage,
          errorCode: errorCode,
          needsUpgrade: isAccessDenied,
          data: null,
        };
      }

      return {
        success: true,
        action: "read_orders",
        data: data.data.orders.edges,
        error: null,
      };
    } else if (actionType === "write_product") {
      // ❌ TEST WRITE PRODUCTS - Sẽ FAIL nếu chưa có write_products scope
      const response = await admin.graphql(
        `#graphql
        mutation updateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: {
              id: "gid://shopify/Product/1", // Dummy ID for testing
              title: "Updated Product Title",
            },
          },
        },
      );
      const data = await response.json();

      if (data.errors) {
        const errorMessage = data.errors[0]?.message || "Unknown error";
        const errorCode = data.errors[0]?.extensions?.code;
        const isAccessDenied =
          errorMessage.toLowerCase().includes("access denied") ||
          errorMessage.toLowerCase().includes("access scope") ||
          errorCode === "ACCESS_DENIED";

        return {
          success: false,
          action: "write_product",
          error: errorMessage,
          errorCode: errorCode,
          needsUpgrade: isAccessDenied,
          data: null,
        };
      }

      if (data.data?.productUpdate?.userErrors?.length > 0) {
        const userError = data.data.productUpdate.userErrors[0];
        const errorMessage = userError.message;

        // Nếu lỗi là "Product not found" = App có quyền write, chỉ thiếu product
        // → Coi như thành công (đã verify được scope)
        if (
          errorMessage.includes("does not exist") ||
          errorMessage.includes("not found") ||
          errorMessage.includes("Could not find")
        ) {
          return {
            success: true,
            action: "write_product",
            data: {
              message: "✅ WRITE scope đã được cấp thành công!",
              note: "App có đủ quyền để update products. (Product ID test không tồn tại nhưng API đã chấp nhận mutation)",
            },
            error: null,
          };
        }

        return {
          success: false,
          action: "write_product",
          error: errorMessage,
          data: null,
        };
      }

      return {
        success: true,
        action: "write_product",
        data: data.data.productUpdate.product,
        error: null,
      };
    }

    return { success: false, error: "Invalid action" };
  } catch (error: any) {
    return {
      success: false,
      action: actionType,
      error: error.message,
      data: null,
    };
  }
};

export default function TestScopes() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const handleAction = (action: string) => {
    const formData = new FormData();
    formData.append("action", action);
    submit(formData, { method: "post" });
  };

  return (
    <s-page heading="Test API Scopes">
      <s-section heading="✅ Test READ Scopes (Hiện tại có quyền)">
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={() => handleAction("read_products")}
            variant="primary"
          >
            📦 Read Products
          </s-button>

          <s-button
            onClick={() => handleAction("read_orders")}
            variant="primary"
          >
            🛒 Read Orders
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="❌ Test WRITE Scope (Chưa có quyền)">
        <s-button
          onClick={() => handleAction("write_product")}
          variant="tertiary"
        >
          ✏️ Update Product (Sẽ fail)
        </s-button>
      </s-section>

      {actionData && (
        <s-section heading={`Kết quả: ${actionData.action}`}>
          {actionData.success ? (
            <s-stack direction="block" gap="base">
              <s-banner tone="success">
                <s-paragraph>
                  <strong>✅ Thành công!</strong> API call thành công! App có đủ
                  quyền để thực hiện action này.
                </s-paragraph>
              </s-banner>

              {actionData.data && (
                <s-box
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <pre
                    style={{ margin: 0, fontSize: "12px", overflow: "auto" }}
                  >
                    <code>{JSON.stringify(actionData.data, null, 2)}</code>
                  </pre>
                </s-box>
              )}
            </s-stack>
          ) : (
            <s-stack direction="block" gap="base">
              <s-banner tone="critical">
                <s-paragraph>
                  <strong>❌ Thất bại!</strong>
                </s-paragraph>
                <s-paragraph>
                  <strong>Error:</strong> {actionData.error}
                </s-paragraph>
                {actionData.errorCode && (
                  <s-paragraph>
                    <strong>Error Code:</strong> {actionData.errorCode}
                  </s-paragraph>
                )}
              </s-banner>

              {actionData.needsUpgrade && (
                <s-banner tone="warning">
                  <s-paragraph>
                    <strong>🔒 App thiếu quyền truy cập!</strong>
                  </s-paragraph>
                  <s-paragraph>
                    API call này yêu cầu scope mà app chưa được cấp quyền. App
                    đã
                    <strong> BẮT ĐƯỢC LỖI ACCESS_DENIED</strong> và không bị
                    crash.
                  </s-paragraph>
                </s-banner>
              )}

              {actionData.needsUpgrade && (
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="base">
                    <s-heading>💡 Hướng dẫn khắc phục:</s-heading>
                    <s-ordered-list>
                      <s-list-item>
                        Mở file <code>shopify.app.toml</code>
                      </s-list-item>
                      <s-list-item>
                        Thêm scope cần thiết vào section{" "}
                        <code>[access_scopes]</code>
                      </s-list-item>
                      <s-list-item>
                        Ví dụ:{" "}
                        <code>scopes = "read_products,write_products"</code>
                      </s-list-item>
                      <s-list-item>
                        Restart dev server: <code>npm run dev</code>
                      </s-list-item>
                      <s-list-item>
                        Shopify CLI sẽ hiển thị URL để reinstall app
                      </s-list-item>
                      <s-list-item>
                        Truy cập URL và approve quyền mới
                      </s-list-item>
                      <s-list-item>
                        Thử lại API call - sẽ thành công! ✅
                      </s-list-item>
                    </s-ordered-list>
                  </s-stack>
                </s-box>
              )}
            </s-stack>
          )}
        </s-section>
      )}

      <s-section slot="aside" heading="⚠️ Quy tắc Scopes">
        <s-banner tone="warning">
          <s-paragraph>
            <strong>Thay đổi Scope = BẮT BUỘC Upgrade</strong>
          </s-paragraph>
        </s-banner>
        <s-unordered-list>
          <s-list-item>Thêm/xóa scope → Phải reinstall app</s-list-item>
          <s-list-item>Shopify CLI tự động phát hiện thay đổi</s-list-item>
          <s-list-item>User phải approve quyền mới qua OAuth</s-list-item>
          <s-list-item>Webhook app/scopes_update được trigger</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
