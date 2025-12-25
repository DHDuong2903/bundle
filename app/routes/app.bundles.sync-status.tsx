import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useRevalidator,
  useSubmit,
  useNavigation,
  useActionData,
} from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect } from "react";
import { createOrUpdateBundleProduct } from "../utils/bundleMetafields";
import { useAppBridge } from "@shopify/app-bridge-react";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "sync_all" || action === "resync_all") {
    try {
      // Get bundles based on action
      const bundles = await db.bundle.findMany({
        where: {
          shopDomain: session.shop,
          ...(action === "sync_all" ? { bundleProductGid: null } : {}),
        },
        include: {
          items: true,
        },
      });

      console.log(`[Sync All] Found ${bundles.length} bundles to sync`);

      let successCount = 0;
      let errorCount = 0;

      for (const bundle of bundles) {
        try {
          // Prepare items in correct format
          const items = bundle.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId || "",
            title: item.productTitle || "",
            sku: "",
            variant: item.variantTitle || "",
            price: item.price || 0,
            image: item.imageUrl || undefined,
          }));

          const result = await createOrUpdateBundleProduct(admin, {
            bundleId: bundle.id,
            name: bundle.name,
            description: bundle.description || "",
            imageUrl: bundle.imageUrl,
            items,
            discountType: bundle.discountType,
            discountValue: bundle.discountValue,
            active: bundle.active,
            startDate: bundle.startDate?.toISOString() || null,
            endDate: bundle.endDate?.toISOString() || null,
          });

          if (result.success && result.productGid) {
            await db.bundle.update({
              where: { id: bundle.id },
              data: { bundleProductGid: result.productGid },
            });
            console.log(
              `[Sync All] Synced bundle ${bundle.id} -> ${result.productGid}`,
            );
            successCount++;
          } else {
            console.error(
              `[Sync All] Failed to sync bundle ${bundle.id}:`,
              result.error,
            );
            errorCount++;
          }
        } catch (error) {
          console.error(`[Sync All] Error syncing bundle ${bundle.id}:`, error);
          errorCount++;
        }
      }

      return {
        success: true,
        message: `Synced ${successCount} bundle(s) successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
        successCount,
        errorCount,
      };
    } catch (error) {
      console.error("[Sync All] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  return { success: false, error: "Invalid action" };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Get all bundles for this shop
  const bundles = await db.bundle.findMany({
    where: {
      shopDomain: session.shop,
    },
    include: {
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(
    `[Sync Status] Found ${bundles.length} bundles for shop ${session.shop}`,
  );

  // Get sync status for each bundle
  const bundlesWithStatus = await Promise.all(
    bundles.map(async (bundle) => {
      let shopifyProduct = null;
      let syncStatus = "not_synced";

      console.log(
        `[Bundle ${bundle.id}] bundleProductGid: ${bundle.bundleProductGid}`,
      );

      if (bundle.bundleProductGid) {
        try {
          const response = await admin.graphql(
            `#graphql
            query GetProduct($id: ID!) {
              product(id: $id) {
                id
                title
                status
                onlineStoreUrl
                metafield(namespace: "custom", key: "bundle_data") {
                  id
                  value
                }
              }
            }`,
            {
              variables: { id: bundle.bundleProductGid },
            },
          );

          const data = await response.json();
          shopifyProduct = data.data?.product;

          console.log(
            `[Bundle ${bundle.id}] Shopify product:`,
            shopifyProduct ? "Found" : "Not found",
          );

          if (shopifyProduct) {
            syncStatus = shopifyProduct.metafield
              ? "synced"
              : "missing_metafield";
          } else {
            syncStatus = "product_deleted";
          }
        } catch (error) {
          console.error(
            `Error fetching product ${bundle.bundleProductGid}:`,
            error,
          );
          syncStatus = "error";
        }
      }

      return {
        bundle,
        shopifyProduct,
        syncStatus,
      };
    }),
  );

  console.log(
    `[Sync Status] Returning ${bundlesWithStatus.length} bundles with status`,
  );

  return { bundlesWithStatus };
};

export default function BundlesSyncStatus() {
  const { bundlesWithStatus } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSyncing =
    navigation.state === "submitting" &&
    navigation.formData?.get("action") === "sync_all";

  // Show toast after sync completes
  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show(actionData.message, { duration: 5000 });
      // Refresh data after successful sync
      revalidator.revalidate();
    } else if (actionData?.error) {
      shopify.toast.show(`Error: ${actionData.error}`, {
        duration: 5000,
        isError: true,
      });
    }
  }, [actionData, shopify, revalidator]);

  // Auto refresh data when component mounts - only once
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 100);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncAll = () => {
    console.log("[UI] Sync All button clicked");
    const formData = new FormData();
    formData.append("action", "sync_all");
    submit(formData, { method: "post" });
  };

  const handleResyncAll = () => {
    console.log("[UI] Re-sync All button clicked");
    const formData = new FormData();
    formData.append("action", "resync_all");
    submit(formData, { method: "post" });
  };

  const unsyncedCount = bundlesWithStatus.filter(
    ({ syncStatus }) => syncStatus === "not_synced",
  ).length;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      synced: { tone: "success", label: "✓ Synced" },
      not_synced: { tone: "warning", label: "⚠ Not Synced" },
      missing_metafield: { tone: "warning", label: "⚠ Missing Metafield" },
      product_deleted: { tone: "critical", label: "✗ Product Deleted" },
      error: { tone: "critical", label: "✗ Error" },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.error;
    return <s-badge tone={config.tone}>{config.label}</s-badge>;
  };

  return (
    <s-page>
      <s-section heading="Bundle Sync Status">
        <s-stack direction="block" gap="base">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <s-paragraph>
              Trang này hiển thị trạng thái đồng bộ của bundles với Shopify
              Products. Mỗi bundle cần được sync với một Shopify Product để hiển
              thị trên storefront.
            </s-paragraph>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              {unsyncedCount > 0 && (
                <s-button
                  variant="primary"
                  onClick={handleSyncAll}
                  loading={isSyncing}
                >
                  {isSyncing ? "Syncing..." : `Sync All (${unsyncedCount})`}
                </s-button>
              )}
              <s-button onClick={handleResyncAll} loading={isSyncing}>
                {isSyncing ? "Re-syncing..." : "Re-sync All"}
              </s-button>
              <s-button
                onClick={() => revalidator.revalidate()}
                loading={revalidator.state === "loading"}
              >
                {revalidator.state === "loading" ? "Refreshing..." : "Refresh"}
              </s-button>
            </div>
          </div>

          <s-banner tone="info">
            <s-stack direction="block" gap="small">
              <strong>Sync được thực hiện tự động khi:</strong>
              <s-unordered-list>
                <s-list-item>Tạo mới bundle</s-list-item>
                <s-list-item>Chỉnh sửa bundle</s-list-item>
                <s-list-item>Xóa bundle (product cũng bị xóa)</s-list-item>
              </s-unordered-list>
            </s-stack>
          </s-banner>

          {bundlesWithStatus.length === 0 ? (
            <s-box padding="large" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <div style={{ fontSize: "48px", textAlign: "center" }}>📦</div>
                <s-heading>No bundles yet</s-heading>
                <s-paragraph>
                  Create your first bundle to see sync status. Go to Home page
                  to create bundles.
                </s-paragraph>
              </s-stack>
            </s-box>
          ) : (
            <>
              <s-banner tone="success">
                <s-paragraph>
                  Found {bundlesWithStatus.length} bundle
                  {bundlesWithStatus.length > 1 ? "s" : ""} in your store.
                </s-paragraph>
              </s-banner>

              <s-section padding="none">
                <s-table>
                  <thead>
                    <tr>
                      <th>Bundle Name</th>
                      <th>Status</th>
                      <th>Active</th>
                      <th>Items</th>
                      <th>Shopify Product</th>
                      <th>Storefront URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundlesWithStatus.map(
                      ({ bundle, shopifyProduct, syncStatus }) => (
                        <tr key={bundle.id}>
                          <td>
                            <s-stack direction="block" gap="small">
                              <strong>{bundle.name}</strong>
                              {bundle.description && (
                                <span
                                  style={{ color: "#6b7280", fontSize: "13px" }}
                                >
                                  {bundle.description.substring(0, 60)}
                                  {bundle.description.length > 60 ? "..." : ""}
                                </span>
                              )}
                            </s-stack>
                          </td>
                          <td>{getStatusBadge(syncStatus)}</td>
                          <td>
                            {bundle.active ? (
                              <s-badge tone="success">Active</s-badge>
                            ) : (
                              <s-badge>Inactive</s-badge>
                            )}
                          </td>
                          <td>{bundle.items.length} products</td>
                          <td>
                            {shopifyProduct ? (
                              <s-stack direction="block" gap="small">
                                <span style={{ fontSize: "13px" }}>
                                  {shopifyProduct.title}
                                </span>
                                <s-badge
                                  tone={
                                    shopifyProduct.status === "ACTIVE"
                                      ? "success"
                                      : "warning"
                                  }
                                >
                                  {shopifyProduct.status}
                                </s-badge>
                              </s-stack>
                            ) : bundle.bundleProductGid ? (
                              <span
                                style={{ color: "#9ca3af", fontSize: "13px" }}
                              >
                                Product ID:{" "}
                                {bundle.bundleProductGid.split("/").pop()}
                              </span>
                            ) : (
                              <span
                                style={{ color: "#9ca3af", fontSize: "13px" }}
                              >
                                Not created yet
                              </span>
                            )}
                          </td>
                          <td>
                            {shopifyProduct?.onlineStoreUrl ? (
                              <s-link
                                href={shopifyProduct.onlineStoreUrl}
                                target="_blank"
                              >
                                View on Store
                              </s-link>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </s-table>
              </s-section>
            </>
          )}

          <s-divider />

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-heading>Legend</s-heading>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <s-badge tone="success">✓ Synced</s-badge>
                  <span style={{ marginLeft: "8px", fontSize: "13px" }}>
                    Bundle đã được sync đầy đủ
                  </span>
                </div>
                <div>
                  <s-badge tone="warning">⚠ Not Synced</s-badge>
                  <span style={{ marginLeft: "8px", fontSize: "13px" }}>
                    Chưa có Shopify Product
                  </span>
                </div>
                <div>
                  <s-badge tone="warning">⚠ Missing Metafield</s-badge>
                  <span style={{ marginLeft: "8px", fontSize: "13px" }}>
                    Product có nhưng thiếu metafield
                  </span>
                </div>
                <div>
                  <s-badge tone="critical">✗ Product Deleted</s-badge>
                  <span style={{ marginLeft: "8px", fontSize: "13px" }}>
                    Shopify Product đã bị xóa
                  </span>
                </div>
              </div>
            </s-stack>
          </s-box>

          <s-banner tone="info">
            <s-stack direction="block" gap="small">
              <strong>💡 Troubleshooting:</strong>
              <s-unordered-list>
                <s-list-item>
                  Nếu status là "Not Synced": Edit và save lại bundle
                </s-list-item>
                <s-list-item>
                  Nếu status là "Missing Metafield": Chạy "Setup Storefront" để
                  tạo metafield definitions
                </s-list-item>
                <s-list-item>
                  Nếu status là "Product Deleted": Edit và save lại bundle để
                  tạo product mới
                </s-list-item>
              </s-unordered-list>
            </s-stack>
          </s-banner>
        </s-stack>
      </s-section>
    </s-page>
  );
}
