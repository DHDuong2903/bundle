/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useNavigate, useLoaderData } from "react-router";
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
import { uploadImageToShopify, addMediaToProduct } from "../utils/shopifyImageUpload";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const labels = await db.label.findMany({
    where: { shopDomain: session.shop },
    select: { id: true, name: true }
  });
  return { labels };
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
  const labelIdsJson = formData.get("labelIds") as string;
  const labelIds = labelIdsJson ? JSON.parse(labelIdsJson) : [];

  const imageEntry = formData.get("image");
  let image = "";
  let imageFile: { name: string; type: string; size: number; buffer: Buffer } | null = null;

  if (imageEntry && typeof imageEntry !== "string") {
    // Received a File - save locally and get public URL
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
        labels: {
          create: labelIds.map((id: string) => ({ labelId: id })),
        },
        items: {
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
      labelId: labelIds[0] || null,
    });

    if (result.success && result.productGid) {
      await db.bundle.update({
        where: { id: bundle.id },
        data: { bundleProductGid: result.productGid },
      });

      // Upload image to Shopify CDN if we have a file or a valid URL
      try {
        let finalImageSource = image;

        // Nếu là file mới upload, dùng Staged Upload để đẩy lên Shopify CDN
        if (imageFile) {
          console.log("[Bundle Create] Uploading image to Shopify Staged Uploads...");
          finalImageSource = await uploadImageToShopify(admin, imageFile);
        }

        if (finalImageSource) {
          const mediaResult = await addMediaToProduct(admin, result.productGid, finalImageSource);
          if (mediaResult?.mediaUserErrors?.length > 0) {
            console.error(
              "[Bundle Create] ❌ Failed to upload product image:",
              mediaResult.mediaUserErrors[0].message,
            );
          } else {
            console.log("[Bundle Create] ✅ Product image synced successfully");
          }
        }
      } catch (error) {
        console.error("[Bundle Create] ❌ Error syncing product image:", error);
      }
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
  const { labels } = useLoaderData<typeof loader>();
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

  // Stable handlers using refs
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
  }, []); // Run once on mount

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
      labelIds?: string[];
      image?: string;
      imageFile?: File | null;
    }) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

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
      if (data.labelIds) formData.append("labelIds", JSON.stringify(data.labelIds));

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
          setIsSubmitting(false);
        }
      } catch (error) {
        console.error("Error creating bundle:", error);
        shopify.toast.show("Failed to create bundle", { isError: true });
        setIsSubmitting(false);
      }
    },
    [shopify, navigate, isSubmitting],
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

      <BundleForm onSubmit={handleSubmit} onSubmitRef={submitRef} labels={labels} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
