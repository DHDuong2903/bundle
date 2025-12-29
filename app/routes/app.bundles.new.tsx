/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BundleForm } from "../components/bundles/BundleForm";
import type { ProductItem } from "../types";
import { createOrUpdateBundleProduct } from "../utils/bundleMetafields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
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
    // Received a File - save locally and get public URL
    try {
      const file = imageEntry as File;
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
    } catch (err) {
      console.error("[Bundle Create] ❌ Failed to save image:", err);
      image = "";
    }
  } else {
    image = (imageEntry as string) || "";
  }

  if (!name || !itemsJson) {
    return { error: "Bundle name and products are required" };
  }

  const items: ProductItem[] = JSON.parse(itemsJson);

  if (items.length === 0) {
    return { error: "At least one product is required" };
  }

  try {
    // Create bundle in database first
    const bundle = await db.bundle.create({
      data: {
        name,
        description: description || null,
        imageUrl: image || null,
        discountType: discountType || null,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        shopDomain: session.shop,
        active,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        items: {
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

    // Create Shopify product with bundle data in metafields
    const result = await createOrUpdateBundleProduct(admin, {
      bundleId: bundle.id,
      name,
      description: description || "",
      imageUrl: image || null,
      items,
      discountType: discountType || null,
      discountValue: discountValue ? parseFloat(discountValue) : null,
      active,
      startDate: startDate || null,
      endDate: endDate || null,
      existingProductGid: bundle.bundleProductGid || null,
    });

    await db.bundle.update({
      where: { id: bundle.id },
      data: { bundleProductGid: result.productGid },
    });

    if (result.success && result.productGid) {
      // Upload image to Product if we have imageUrl
      if (image) {
        try {
          const mediaResponse = await admin.graphql(
            `#graphql
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                media {
                  id
                  ... on MediaImage {
                    image {
                      url
                    }
                  }
                }
                mediaUserErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                productId: result.productGid,
                media: [
                  {
                    originalSource: image,
                    mediaContentType: "IMAGE",
                  },
                ],
              },
            },
          );

          const mediaData = await mediaResponse.json();
          if (mediaData.data?.productCreateMedia?.mediaUserErrors?.length > 0) {
            console.error(
              "[Bundle Create] ❌ Failed to upload product image:",
              mediaData.data.productCreateMedia.mediaUserErrors[0].message,
            );
          }
        } catch (error) {
          console.error(
            "[Bundle Create] ❌ Error uploading product image:",
            error,
          );
        }
      }

      // Update bundle with Shopify product GID
      const updated = await db.bundle.update({
        where: { id: bundle.id },
        data: { bundleProductGid: result.productGid },
      });
    } else {
      console.error(
        "[Bundle Create] ❌ Failed to create Shopify product:",
        result.error,
      );
    }

    return redirect("/app");
  } catch (error) {
    console.error("Error creating bundle:", error);
    return { error: "Failed to create bundle" };
  }
};

export default function NewBundle() {
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const saveButtonRef = useRef<any>(null);
  const discardButtonRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    if (submitRef.current) {
      await submitRef.current();
    }
  }, []);

  const handleDiscard = useCallback(() => {
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
      discountType: "percentage" | "fixed";
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
      if (
        data.imageFile &&
        typeof (data.imageFile as any).arrayBuffer === "function"
      ) {
        formData.append("image", data.imageFile as File);
      } else {
        formData.append("image", data.image || "");
      }
      formData.append("discountType", data.discountType);
      formData.append("discountValue", data.discountValue);
      formData.append("active", data.active.toString());
      formData.append("startDate", data.startDate);
      formData.append("endDate", data.endDate);
      formData.append("items", JSON.stringify(data.items));

      setIsSubmitting(true);
      try {
        const response = await fetch("/app/bundles/new", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          shopify.toast.show("Bundle created successfully");
          navigate("/app");
        } else {
          const error = await response.json();
          shopify.toast.show(error.error || "Failed to create bundle", {
            isError: true,
          });
        }
      } catch (error) {
        console.error("Error creating bundle:", error);
        shopify.toast.show("Failed to create bundle", { isError: true });
      } finally {
        setIsSubmitting(false);
      }
    },
    [shopify, navigate],
  );

  return (
    <s-page heading="Create new bundle" back-action="/app">
      <s-button
        ref={saveButtonRef}
        slot="primary-action"
        variant="primary"
        disabled={isSubmitting ? true : undefined}
      >
        {isSubmitting ? "Creating..." : "Create bundle"}
      </s-button>
      <s-button
        ref={discardButtonRef}
        slot="secondary-actions"
        variant="secondary"
        disabled={isSubmitting ? true : undefined}
      >
        Discard
      </s-button>

      <BundleForm onSubmit={handleSubmit} onSubmitRef={submitRef} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
