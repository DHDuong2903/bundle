import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BundleForm } from "../components/bundles/BundleForm";
import type { ProductItem, DiscountType } from "../types/bundle.types";

interface LoaderData {
  bundle: {
    id: string;
    name: string;
    description: string | null;
    discountType: string | null;
    discountValue: number | null;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
    items: ProductItem[];
  };
}

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

  // Fetch product details from Shopify
  const productItems: ProductItem[] = [];

  for (const item of bundle.items) {
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
        productItems.push({
          id: crypto.randomUUID(),
          productId: product.id,
          variantId: variant.id,
          title: product.title,
          sku: variant.sku || "N/A",
          variant: variant.title,
          price: parseFloat(variant.price),
          image: variant.image?.url || product.featuredImage?.url,
        });
      }
    } catch (error) {
      console.error(`Error fetching product ${item.productId}:`, error);
    }
  }

  return {
    bundle: {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
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
  const { session } = await authenticate.admin(request);
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

  if (!bundleId || !name || !itemsJson) {
    return { error: "Bundle ID, name and products are required" };
  }

  const items: ProductItem[] = JSON.parse(itemsJson);

  if (items.length === 0) {
    return { error: "At least one product is required" };
  }

  try {
    // Delete existing items and create new ones
    await db.bundle.update({
      where: {
        id: bundleId,
        shopDomain: session.shop,
      },
      data: {
        name,
        description: description || null,
        discountType: discountType || null,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        active,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        items: {
          deleteMany: {},
          create: items.map((item) => ({
            productId: item.productId,
            quantity: 1,
          })),
        },
      },
    });

    return redirect("/app");
  } catch (error) {
    console.error("Error updating bundle:", error);
    return { error: "Failed to update bundle" };
  }
};

export default function EditBundle() {
  const { bundle } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const handleSubmit = async (data: {
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: string;
    active: boolean;
    startDate: string;
    endDate: string;
    items: ProductItem[];
  }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("discountType", data.discountType);
    formData.append("discountValue", data.discountValue);
    formData.append("active", data.active.toString());
    formData.append("startDate", data.startDate);
    formData.append("endDate", data.endDate);
    formData.append("items", JSON.stringify(data.items));

    const response = await fetch(`/app/bundles/${bundle.id}/edit`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      navigate("/app");
    }
  };

  return (
    <s-page heading="Edit Bundle" back-action="/app">
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
        submitButtonText="Update Bundle"
        onCancel={() => navigate("/app")}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
