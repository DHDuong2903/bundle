import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ProductItem } from "../types";
import db from "../db.server";

/**
 * Thông tin bundle đầy đủ lưu tại sản phẩm con
 */
export interface RelatedBundleInfo {
  bundleId: string;
  bundleName: string;
  bundlePrice: number;
  originalPrice: number;
  discountValue: number | null;
  discountType: string | null;
  active: boolean;
  items: {
    productId: string;
    variantId: string | null;
    title: string;
    image: string;
    price: number;
    handle: string;
  }[];
  label?: {
    text: string;
    icon: string | null;
    bgColor: string;
    textColor: string;
    position: string;
    shape: string;
    showOnPDP: boolean;
    showOnCollection: boolean;
  } | null;
}

export async function createOrUpdateBundleProduct(
  admin: AdminApiContext,
  bundleData: {
    bundleId: string;
    name: string;
    description: string;
    imageUrl?: string | null;
    items: ProductItem[];
    discountType: "percentage" | "fixed" | null;
    discountValue: number | null;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
    existingProductGid?: string | null;
    labelId?: string | null;
  },
): Promise<{ success: boolean; productGid?: string; error?: string }> {
  try {
    const originalPrice = bundleData.items.reduce((sum, item) => sum + item.price, 0);
    let bundlePrice = originalPrice;

    if (bundleData.discountType && bundleData.discountValue && bundleData.discountValue > 0) {
      if (bundleData.discountType === "percentage") {
        bundlePrice = originalPrice * (1 - bundleData.discountValue / 100);
      } else if (bundleData.discountType === "fixed") {
        bundlePrice = Math.max(0, originalPrice - (bundleData.discountValue * bundleData.items.length));
      }
    }

    // Lấy thông tin Label nếu có
    let labelInfo = null;
    if (bundleData.labelId) {
      const label = await db.label.findUnique({
        where: { id: bundleData.labelId }
      });
      if (label) {
        labelInfo = {
          text: label.text,
          icon: label.icon,
          bgColor: label.bgColor,
          textColor: label.textColor,
          position: label.position,
          shape: label.shape,
          showOnPDP: label.showOnPDP,
          showOnCollection: label.showOnCollection,
        };
      }
    }

    const relatedInfo: RelatedBundleInfo = {
        bundleId: bundleData.bundleId,
        bundleName: bundleData.name,
        bundlePrice: Math.round(bundlePrice * 100) / 100,
        originalPrice: Math.round(originalPrice * 100) / 100,
        discountValue: bundleData.discountValue,
        discountType: bundleData.discountType,
        active: bundleData.active,
        label: labelInfo,
        items: bundleData.items.map(i => ({
            productId: i.productId,
            variantId: i.variantId || null,
            title: i.title || "",
            image: i.image || "",
            price: i.price || 0,
            handle: i.handle || ""
        })),
    };

    await updateChildProductsReferences(admin, bundleData.items, relatedInfo);
    return { success: true, productGid: "" };
  } catch (error) {
    console.error("Error syncing bundle to children:", error);
    return { success: false, error: "Internal error during sync" };
  }
}

async function updateChildProductsReferences(admin: AdminApiContext, items: any[], info: RelatedBundleInfo) {
    for (const item of items) {
        try {
            const query = await admin.graphql(`#graphql
                query getMeta($id: ID!) { 
                  product(id: $id) { 
                    metafield(namespace: "custom", key: "related_bundles") { value } 
                  } 
                }`,
                { variables: { id: item.productId } }
            );
            const res = await query.json();
            let list: RelatedBundleInfo[] = [];
            const raw = res.data?.product?.metafield?.value;
            if (raw) list = JSON.parse(raw);

            list = list.filter(b => b.bundleId !== info.bundleId);
            list.push(info);

            await admin.graphql(`#graphql
                mutation setMeta($metafields: [MetafieldsSetInput!]!) { 
                  metafieldsSet(metafields: $metafields) { userErrors { message } } 
                }`,
                { variables: { metafields: [{
                    ownerId: item.productId,
                    namespace: "custom",
                    key: "related_bundles",
                    type: "json",
                    value: JSON.stringify(list)
                }]}}
            );
        } catch (e) {}
    }
}

export async function deleteBundleProduct(admin: AdminApiContext, productGid: string, bundleId: string, childIds: string[] = []) {
    for (const pid of childIds) {
        try {
            const query = await admin.graphql(`#graphql
                query getMeta($id: ID!) { 
                  product(id: $id) { 
                    metafield(namespace: "custom", key: "related_bundles") { value } 
                  } 
                }`,
                { variables: { id: pid } }
            );
            const res = await query.json();
            const raw = res.data?.product?.metafield?.value;
            if (raw) {
                let list: RelatedBundleInfo[] = JSON.parse(raw);
                const newList = list.filter(b => b.bundleId !== bundleId);
                await admin.graphql(`#graphql
                    mutation setMeta($metafields: [MetafieldsSetInput!]!) { 
                      metafieldsSet(metafields: $metafields) { userErrors { message } } 
                    }`,
                    { variables: { metafields: [{ 
                        ownerId: pid, namespace: "custom", key: "related_bundles", type: "json", value: JSON.stringify(newList) 
                    }]}}
                );
            }
        } catch (e) {}
    }

    if (productGid && productGid.startsWith("gid://")) {
        try {
            await admin.graphql(`#graphql
                mutation del($id: ID!) { productDelete(input: { id: $id }) { deletedProductId } }`,
                { variables: { id: productGid } }
            );
        } catch (e) {}
    }
    return { success: true };
}
