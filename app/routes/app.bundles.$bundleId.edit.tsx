/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BundleForm } from "../components/bundles/BundleForm";
import type { ProductItem, DiscountType, BundleEditLoaderData } from "../types";
import { createOrUpdateBundleProduct } from "../utils/bundleMetafields";
import { uploadImageToShopify, addMediaToProduct } from "../utils/shopifyImageUpload";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { bundleId } = params;

  if (!bundleId) {
    throw new Response("Bundle ID is required", { status: 400 });
  }

  const bundle = await db.bundle.findUnique({
    where: {
      id: bundleId,
      shopDomain: session.shop,
    },
    include: {
      items: true,
      labels: true,
    },
  });

  if (!bundle) {
    throw new Response("Bundle not found", { status: 404 });
  }

  const labels = await db.label.findMany({
    where: { shopDomain: session.shop },
    select: { id: true, name: true }
  });

  // Fetch product details from Shopify - parallel requests for better performance
  const productPromises = bundle.items.map(async (item, index) => {
    try {
      const response = await admin.graphql(
        `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              handle
              variants(first: 10) {
                nodes {
                  id
                  title
                  sku
                  price
                  image {
                    url
                  }
                }
              }
              featuredImage {
                url
              }
            }
          }`,
        {
          variables: {
            id: item.productId,
          },
        },
      );

      const data = await response.json();
      const product = data.data?.product;

      if (product) {
        // Try to find the originally selected variant by comparing IDs (gid or numeric)
        const requestedVariantId = item.variantId;
        const normalize = (id: string | undefined | null) => {
          if (!id) return null;
          const parts = String(id).split("/");
          return parts[parts.length - 1];
        };

        const reqIdNorm = normalize(requestedVariantId);

        let variant = null as any;
        if (reqIdNorm) {
          variant = product.variants.nodes.find((v: any) => {
            const vNorm = normalize(v.id);
            return v.id === requestedVariantId || vNorm === reqIdNorm;
          });
        }

        // If not found, try to match by title as a last resort
        if (!variant) {
          variant =
            product.variants.nodes.find(
              (v: any) => v.title === item.variantTitle,
            ) || product.variants.nodes[0];
        }

        // Use stored DB price if variant not found or variant price missing
        const priceFromVariant =
          variant && variant.price ? parseFloat(variant.price) : null;
        const price = priceFromVariant ?? item.price ?? 0;

        return {
          id: `${product.id}-${index}`,
          productId: product.id,
          handle: product.handle,
          variantId: variant?.id || item.variantId || "",
          title: product.title,
          sku: variant?.sku || item.sku || "N/A",
          variant: variant?.title || item.variantTitle || "",
          price: price,
          image:
            variant?.image?.url ||
            product.featuredImage?.url ||
            item.image ||
            undefined,
        } as ProductItem;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching product ${item.productId}:`, error);
      return null;
    }
  });

  const productResults = await Promise.all(productPromises);
  const productItems: ProductItem[] = productResults.filter(
    (item): item is ProductItem => item !== null,
  );

  return {
    bundle: {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      image: bundle.imageUrl || null,
      discountType: bundle.discountType,
      discountValue: bundle.discountValue,
      active: bundle.active,
      startDate: bundle.startDate?.toISOString().split("T")[0] || null,
      endDate: bundle.endDate?.toISOString().split("T")[0] || null,
      items: productItems,
      labelIds: bundle.labels.map(l => l.labelId),
    },
    labels
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { bundleId } = params;
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = formData.get("discountValue") as string;
  const active = formData.get("active") === "true";
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const itemsJson = formData.get("items") as string;
  const labelIdsJson = formData.get("labelIds") as string;
  const labelIds = labelIdsJson ? JSON.parse(labelIdsJson) : [];

  const imageEntry = formData.get("image");
  let image = "";
  let imageFile: { name: string; type: string; size: number; buffer: Buffer } | null = null;

  if (imageEntry && typeof imageEntry !== "string") {
    try {
      const file = imageEntry as File;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageFile = { name: file.name, type: file.type, size: file.size, buffer };

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filename = `${randomUUID()}-${file.name}`;
      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, buffer);

      // Get the cloudflare tunnel URL from request
      const host = request.headers.get("host") || "localhost:3000";
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      image = `${protocol}://${host}/uploads/${filename}`;
    } catch (err) {
      console.error("[Bundle Edit] ❌ Failed to process image:", err);
      image = "";
    }
  } else {
    image = (imageEntry as string) || "";
  }

  if (!bundleId || !name || !itemsJson) {
    return { error: "Bundle ID, name and products are required" };
  }

  const items: ProductItem[] = JSON.parse(itemsJson);

  if (items.length === 0) {
    return { error: "At least one product is required" };
  }

  try {
    // Delete existing items and create new ones
    const bundle = await db.bundle.update({
      where: {
        id: bundleId,
        shopDomain: session.shop,
      },
      data: {
        name,
        description: description || null,
        imageUrl: image || null,
        discountType: discountType || null,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        active,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        labels: {
          deleteMany: {},
          create: labelIds.map((id: string) => ({ labelId: id })),
        },
        items: {
          deleteMany: {},
          create: items.map((item) => ({
            productId: item.productId,
            handle: item.handle || null,
            variantId: item.variantId || null,
            quantity: 1,
            productTitle: item.title || null,
            variantTitle: item.variant || null,
            price: typeof item.price === "number" ? item.price : null,
            imageUrl: item.image || null,
          })),
        },
      },
    });

    // Sync with Shopify product
    const result = await createOrUpdateBundleProduct(admin, {
      bundleId: bundle.id,
      name,
      description: description || "",
      imageUrl: image || bundle.imageUrl,
      items,
      discountType: discountType || null,
      discountValue: discountValue ? parseFloat(discountValue) : null,
      active,
      startDate: startDate || null,
      endDate: endDate || null,
      existingProductGid: bundle.bundleProductGid,
      labelId: labelIds[0] || null,
    });

    if (result.success && result.productGid) {
      if (!bundle.bundleProductGid) {
        // Update bundle with product GID if it didn't exist
        await db.bundle.update({
          where: { id: bundle.id },
          data: { bundleProductGid: result.productGid },
        });
      }

      // Sync image to Shopify CDN if it's a new upload or we have a URL
      try {
        let finalImageSource = image;

        if (imageFile) {
          console.log("[Bundle Edit] Uploading new image to Shopify Staged Uploads...");
          finalImageSource = await uploadImageToShopify(admin, imageFile);
        }

        if (finalImageSource) {
          const mediaResult = await addMediaToProduct(admin, result.productGid, finalImageSource);
          if (mediaResult?.mediaUserErrors?.length > 0) {
            console.error(
              "[Bundle Edit] ❌ Failed to update product image:",
              mediaResult.mediaUserErrors[0].message,
            );
          } else {
            console.log("[Bundle Edit] ✅ Product image synced successfully");
          }
        }
      } catch (error) {
        console.error("[Bundle Edit] ❌ Error syncing product image:", error);
      }
    }

    return redirect("/app");
  } catch (error) {
    console.error("Error updating bundle:", error);
    return { error: "Failed to update bundle" };
  }
};

export default function EditBundle() {
  const { bundle, labels } = useLoaderData<BundleEditLoaderData>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const saveButtonRef = useRef<any>(null);
  const discardButtonRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    if (isSubmitting) return;
    if (submitRef.current) {
      await submitRef.current();
    }
  }, [isSubmitting]);

  const handleDiscard = useCallback(() => {
    navigate("/app");
  }, [navigate]);

  // Use refs to keep handlers stable for addEventListener
  const saveHandlerRef = useRef(handleSave);
  const discardHandlerRef = useRef(handleDiscard);
  saveHandlerRef.current = handleSave;
  discardHandlerRef.current = handleDiscard;

  useEffect(() => {
    const saveButton = saveButtonRef.current;
    const discardButton = discardButtonRef.current;

    const onSave = () => saveHandlerRef.current();
    const onDiscard = () => discardHandlerRef.current();

    if (saveButton) {
      saveButton.addEventListener("click", onSave);
    }
    if (discardButton) {
      discardButton.addEventListener("click", onDiscard);
    }

    return () => {
      if (saveButton) {
        saveButton.removeEventListener("click", onSave);
      }
      if (discardButton) {
        discardButton.removeEventListener("click", onDiscard);
      }
    };
  }, []); // Mount only

  const handleSubmit = useCallback(
    async (data: {
      name: string;
      description: string;
      discountType: DiscountType;
      discountValue: string;
      active: boolean;
      startDate: string;
      endDate: string;
      items: ProductItem[];
      labelIds?: string[];
      image?: string;
      imageFile?: File | null;
    }) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("description", data.description);
      formData.append("discountType", data.discountType);
      formData.append("discountValue", data.discountValue);
      formData.append("active", data.active.toString());
      formData.append("startDate", data.startDate);
      formData.append("endDate", data.endDate);
      if (data.labelIds) formData.append("labelIds", JSON.stringify(data.labelIds));

      if (
        data.imageFile &&
        typeof (data.imageFile as any).arrayBuffer === "function"
      ) {
        formData.append("image", data.imageFile as File);
      } else {
        formData.append("image", data.image || "");
      }
      formData.append("items", JSON.stringify(data.items));

      try {
        const response = await fetch(`/app/bundles/${bundle.id}/edit`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          shopify.toast.show("Bundle updated successfully");
          navigate("/app");
        }
        else {
          const error = await response.json();
          shopify.toast.show(error.error || "Failed to update bundle", {
            isError: true,
          });
          setIsSubmitting(false);
        }
      } catch (error) {
        console.error("Error updating bundle:", error);
        shopify.toast.show("Failed to update bundle", { isError: true });
        setIsSubmitting(false);
      }
    },
    [bundle.id, shopify, navigate, isSubmitting],
  );

  return (
    <s-page heading="Edit bundle" back-action="/app">
      <s-button
        ref={saveButtonRef}
        slot="primary-action"
        variant="primary"
        disabled={isSubmitting ? true : undefined}
      >
        {isSubmitting ? "Saving..." : "Save bundle"}
      </s-button>
      <s-button
        ref={discardButtonRef}
        slot="secondary-actions"
        disabled={isSubmitting ? true : undefined}
      >
        Discard
      </s-button>

      <BundleForm
        initialData={{
          name: bundle.name,
          description: bundle.description || "",
          discountType: (bundle.discountType as DiscountType) || "percentage",
          discountValue: bundle.discountValue?.toString() || "",
          active: bundle.active,
          startDate: bundle.startDate || "",
          endDate: bundle.endDate || "",
          items: bundle.items,
          labelIds: bundle.labelIds || [],
        }}
        onSubmit={handleSubmit}
        onSubmitRef={submitRef}
        labels={labels}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
