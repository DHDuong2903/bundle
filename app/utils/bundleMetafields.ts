import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ProductItem } from "../types";

/**
 * Bundle data structure to store in metafields
 */
export interface BundleMetafieldData {
  bundleId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  discountType: string | null;
  discountValue: number | null;
  active: boolean;
  items: {
    productId: string;
    variantId: string;
    productTitle: string;
    productHandle: string;
    variantTitle: string;
    imageUrl: string | null;
    quantity: number;
    price: number;
  }[];
  originalPrice: number;
  bundlePrice: number;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Create or update bundle product in Shopify
 * This creates a "bundle product" that represents the bundle on the storefront
 */
export async function createOrUpdateBundleProduct(
  admin: AdminApiContext,
  bundleData: {
    bundleId: string;
    name: string;
    description: string;
    imageUrl?: string | null;
    items: ProductItem[];
    discountType: string | null;
    discountValue: number | null;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
    existingProductGid?: string | null;
  },
): Promise<{ success: boolean; productGid?: string; error?: string }> {
  try {
    // Calculate prices
    const originalPrice = bundleData.items.reduce(
      (sum, item) => sum + item.price,
      0,
    );
    let bundlePrice = originalPrice;

    if (bundleData.discountType && bundleData.discountValue) {
      if (bundleData.discountType === "percentage") {
        bundlePrice = originalPrice * (1 - bundleData.discountValue / 100);
      } else if (bundleData.discountType === "fixed") {
        bundlePrice = originalPrice - bundleData.discountValue;
      }
    }

    // Prepare metafield data
    const metafieldData: BundleMetafieldData = {
      bundleId: bundleData.bundleId,
      name: bundleData.name,
      description: bundleData.description,
      imageUrl: bundleData.imageUrl,
      discountType: bundleData.discountType,
      discountValue: bundleData.discountValue,
      active: bundleData.active,
      items: bundleData.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        productTitle: item.title,
        productHandle: item.productId.replace("gid://shopify/Product/", ""),
        variantTitle: item.variant,
        imageUrl: item.image || null,
        quantity: 1,
        price: item.price,
      })),
      originalPrice,
      bundlePrice,
      startDate: bundleData.startDate,
      endDate: bundleData.endDate,
    };

    if (bundleData.existingProductGid) {
      // Update existing product
      const response = await admin.graphql(
        `#graphql
        mutation UpdateBundleProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
              descriptionHtml
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
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
              id: bundleData.existingProductGid,
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

      if (data.data?.productUpdate?.userErrors?.length > 0) {
        return {
          success: false,
          error: data.data.productUpdate.userErrors[0].message,
        };
      }

      // Update variant price
      const variantId =
        data.data?.productUpdate?.product?.variants?.edges?.[0]?.node?.id;
      if (variantId) {
        console.log(
          `[Sync] Updating variant price for ${variantId}: $${bundlePrice.toFixed(2)} (was $${originalPrice.toFixed(2)})`,
        );
        try {
          const variantResponse = await admin.graphql(
            `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  price
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                productId: bundleData.existingProductGid,
                variants: [
                  {
                    id: variantId,
                    price: bundlePrice.toFixed(2),
                    compareAtPrice: originalPrice.toFixed(2),
                  },
                ],
              },
            },
          );

          const variantData = await variantResponse.json();
          if (
            variantData.data?.productVariantsBulkUpdate?.userErrors?.length > 0
          ) {
            console.error(
              "[Sync] Variant update errors:",
              variantData.data.productVariantsBulkUpdate.userErrors,
            );
          } else {
            console.log("[Sync] ✅ Variant price updated successfully");
          }
        } catch (err) {
          console.error("[Sync] Error updating variant:", err);
        }
      }

      return {
        success: true,
        productGid: data.data?.productUpdate?.product?.id,
      };
    } else {
      // Create new product
      const response = await admin.graphql(
        `#graphql
        mutation CreateBundleProduct($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
              descriptionHtml
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
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

      if (data.data?.productCreate?.userErrors?.length > 0) {
        return {
          success: false,
          error: data.data.productCreate.userErrors[0].message,
        };
      }

      const productGid = data.data?.productCreate?.product?.id;

      if (!productGid) {
        return {
          success: false,
          error: "Failed to get product ID after creation",
        };
      }

      // Update variant price
      const variantId =
        data.data?.productCreate?.product?.variants?.edges?.[0]?.node?.id;
      if (variantId && productGid) {
        console.log(
          `[Sync] Setting variant price for new product ${productGid}: $${bundlePrice.toFixed(2)} (compare: $${originalPrice.toFixed(2)})`,
        );
        try {
          const variantResponse = await admin.graphql(
            `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  price
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                productId: productGid,
                variants: [
                  {
                    id: variantId,
                    price: bundlePrice.toFixed(2),
                    compareAtPrice: originalPrice.toFixed(2),
                  },
                ],
              },
            },
          );

          const variantData = await variantResponse.json();
          if (
            variantData.data?.productVariantsBulkUpdate?.userErrors?.length > 0
          ) {
            console.error(
              "[Sync] Variant update errors:",
              variantData.data.productVariantsBulkUpdate.userErrors,
            );
          } else {
            console.log("[Sync] ✅ Variant price set successfully");
          }
        } catch (err) {
          console.error("[Sync] Error setting variant price:", err);
        }
      }

      // Product created successfully with metafield data and image
      return {
        success: true,
        productGid,
      };
    }
  } catch (error) {
    console.error("Error creating/updating bundle product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete bundle product from Shopify
 */
export async function deleteBundleProduct(
  admin: AdminApiContext,
  productGid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation DeleteProduct($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            id: productGid,
          },
        },
      },
    );

    const data = await response.json();

    if (data.data?.productDelete?.userErrors?.length > 0) {
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
