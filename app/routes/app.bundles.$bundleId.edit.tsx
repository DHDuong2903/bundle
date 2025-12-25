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
    },
  });

  if (!bundle) {
    throw new Response("Bundle not found", { status: 404 });
  }

  // Fetch product details from Shopify - parallel requests for better performance
  const productPromises = bundle.items.map(async (item, index) => {
    try {
      const response = await admin.graphql(
        `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
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
        const variant = product.variants.nodes[0];
        return {
          id: `${product.id}-${index}`,
          productId: product.id,
          variantId: variant.id,
          title: product.title,
          sku: variant.sku || "N/A",
          variant: variant.title,
          price: parseFloat(variant.price),
          image: variant.image?.url || product.featuredImage?.url || undefined,
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
    },
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
  const imageEntry = formData.get("image");
  let image = "";

  if (imageEntry && typeof imageEntry !== "string") {
    try {
      const file = imageEntry as File;
      console.log("[Bundle Edit] File details:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filename = `${randomUUID()}-${file.name}`;
      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, buffer);

      // Get the cloudflare tunnel URL from request
      const host = request.headers.get("host") || "localhost:3000";
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      image = `${protocol}://${host}/uploads/${filename}`;

      console.log("[Bundle Edit] ✅ File saved, public URL:", image);
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
        items: {
          deleteMany: {},
          create: items.map((item) => ({
            productId: item.productId,
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
    });

    if (result.success && result.productGid && !bundle.bundleProductGid) {
      // Update bundle with product GID if it didn't exist
      await db.bundle.update({
        where: { id: bundle.id },
        data: { bundleProductGid: result.productGid },
      });
    }

    return redirect("/app");
  } catch (error) {
    console.error("Error updating bundle:", error);
    return { error: "Failed to update bundle" };
  }
};

export default function EditBundle() {
  const { bundle } = useLoaderData<BundleEditLoaderData>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const saveButtonRef = useRef<any>(null);
  const discardButtonRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    console.log("Save button clicked");
    if (submitRef.current) {
      await submitRef.current();
    } else {
      console.error("submitRef.current is null");
    }
  }, []);

  const handleDiscard = useCallback(() => {
    console.log("Discard button clicked");
    navigate("/app");
  }, [navigate]);

  useEffect(() => {
    const saveButton = saveButtonRef.current;
    const discardButton = discardButtonRef.current;

    if (saveButton) {
      saveButton.addEventListener("click", handleSave);
    }
    if (discardButton) {
      discardButton.addEventListener("click", handleDiscard);
    }

    return () => {
      if (saveButton) {
        saveButton.removeEventListener("click", handleSave);
      }
      if (discardButton) {
        discardButton.removeEventListener("click", handleDiscard);
      }
    };
  }, [handleSave, handleDiscard]);

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
      image?: string;
      imageFile?: File | null;
    }) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("description", data.description);
      formData.append("discountType", data.discountType);
      formData.append("discountValue", data.discountValue);
      formData.append("active", data.active.toString());
      formData.append("startDate", data.startDate);
      formData.append("endDate", data.endDate);
      if (
        data.imageFile &&
        typeof (data.imageFile as any).arrayBuffer === "function"
      ) {
        formData.append("image", data.imageFile as File);
      } else {
        formData.append("image", data.image || "");
      }
      formData.append("items", JSON.stringify(data.items));

      setIsSubmitting(true);
      try {
        const response = await fetch(`/app/bundles/${bundle.id}/edit`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          shopify.toast.show("Bundle updated successfully");
          navigate("/app");
        } else {
          const error = await response.json();
          shopify.toast.show(error.error || "Failed to update bundle", {
            isError: true,
          });
        }
      } catch (error) {
        console.error("Error updating bundle:", error);
        shopify.toast.show("Failed to update bundle", { isError: true });
      } finally {
        setIsSubmitting(false);
      }
    },
    [bundle.id, shopify, navigate],
  );

  console.log("EditBundle component rendered", {
    isSubmitting,
    hasSubmitRef: !!submitRef.current,
  });

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
        }}
        onSubmit={handleSubmit}
        onSubmitRef={submitRef}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
