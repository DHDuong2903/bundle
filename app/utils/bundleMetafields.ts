import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ProductItem } from "../types";

export interface BundleMetafieldData {
  bundleId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;

  discountType: "percentage" | "fixed" | null;
  discountValue: number | null;

  active: boolean;

  items: {
    productId: string;
    variantId: string | null;
    quantity: number;
    price: number;
    title?: string;
    variantTitle?: string;
    handle?: string;
    image?: string;
  }[];

  originalPrice: number;
  bundlePrice: number;
  totalDiscount: number;

  startDate: string | null;
  endDate: string | null;
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
  },
): Promise<{ success: boolean; productGid?: string; error?: string }> {
  try {
    // 1. TÍNH GIÁ GỐC & DISCOUNT

    const originalPrice = bundleData.items.reduce(
      (sum, item) => sum + item.price,
      0,
    );

    let bundlePrice = originalPrice;
    let totalDiscount = 0;

    if (
      bundleData.discountType &&
      bundleData.discountValue &&
      bundleData.discountValue > 0
    ) {
      if (bundleData.discountType === "percentage") {
        bundlePrice =
          originalPrice * (1 - bundleData.discountValue / 100);
        totalDiscount = originalPrice - bundlePrice;
      } else if (bundleData.discountType === "fixed") {
        const totalFixedDiscount = bundleData.discountValue * bundleData.items.length;
        bundlePrice = Math.max(
          0,
          originalPrice - totalFixedDiscount,
        );
        totalDiscount = originalPrice - bundlePrice;
      }
    }

    // 2. DANH SÁCH ITEM (KHÔNG DISCOUNT PER ITEM)

    const items = bundleData.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: 1,
      price: item.price,
      title: item.title,
      variantTitle: item.variant,
      handle: item.handle,
      image: item.image,
    }));

    // 3. METAFIELD DATA

    const metafieldData: BundleMetafieldData = {
      bundleId: bundleData.bundleId,
      name: bundleData.name,
      description: bundleData.description,
      imageUrl: bundleData.imageUrl || null,

      discountType: bundleData.discountType,
      discountValue: bundleData.discountValue,

      active: bundleData.active,
      items,

      originalPrice: Math.round(originalPrice * 100) / 100,
      bundlePrice: Math.round(bundlePrice * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,

      startDate: bundleData.startDate,
      endDate: bundleData.endDate,
    };

    // 4. UPDATE PRODUCT BUNDLE
    if (bundleData.existingProductGid) {
      const response = await admin.graphql(
        `#graphql
        mutation productUpdate($id: ID!, $input: ProductUpdateInput!) {
          productUpdate(id: $id, input: $input) {
            product { id }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            id: bundleData.existingProductGid,
            input: {
              title: bundleData.name,
              descriptionHtml: bundleData.description,
              status: bundleData.active ? "ACTIVE" : "DRAFT",
              metafields: [
                {
                  namespace: "custom",
                  key: "bundle_data",
                  type: "json",
                  value: JSON.stringify(metafieldData),
                },
              ],
            },
          },
        },
      );

      const data = await response.json();
      if (data.data?.productUpdate?.userErrors?.length) {
        return {
          success: false,
          error: data.data.productUpdate.userErrors[0].message,
        };
      }

      return { success: true, productGid: bundleData.existingProductGid };
    }

    // 5. CREATE PRODUCT BUNDLE

    const response = await admin.graphql(
      `#graphql
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            title: `[Bundle] ${bundleData.name}`,
            descriptionHtml: bundleData.description || "",
            status: bundleData.active ? "ACTIVE" : "DRAFT",
            productType: "Bundle",
            vendor: "Bundle App",
            metafields: [
              {
                namespace: "custom",
                key: "bundle_data",
                type: "json",
                value: JSON.stringify(metafieldData),
              },
            ],
          },
        },
      },
    );

    const data = await response.json();
    if (data.data?.productCreate?.userErrors?.length) {
      return {
        success: false,
        error: data.data.productCreate.userErrors[0].message,
      };
    }

    const productGid = data.data?.productCreate?.product?.id;
    if (!productGid) {
      return { success: false, error: "Failed to create bundle product" };
    }

    return { success: true, productGid };
  } catch (error) {
    console.error("Error creating/updating bundle product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// DELETE BUNDLE PRODUCT

export async function deleteBundleProduct(
  admin: AdminApiContext,
  productGid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation productDelete($id: ID!) {
        productDelete(input: { id: $id }) {
          deletedProductId
          userErrors { field message }
        }
      }`,
      { variables: { id: productGid } },
    );

    const data = await response.json();
    if (data.data?.productDelete?.userErrors?.length) {
      return {
        success: false,
        error: data.data.productDelete.userErrors[0].message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting bundle product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
