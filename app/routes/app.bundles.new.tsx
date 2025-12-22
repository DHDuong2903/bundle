import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BundleForm } from "../components/bundles/BundleForm";
import type { ProductItem } from "../types/bundle.types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = formData.get("discountValue") as string;
  const active = formData.get("active") === "true";
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const itemsJson = formData.get("items") as string;

  if (!name || !itemsJson) {
    return { error: "Bundle name and products are required" };
  }

  const items: ProductItem[] = JSON.parse(itemsJson);

  if (items.length === 0) {
    return { error: "At least one product is required" };
  }

  try {
    await db.bundle.create({
      data: {
        name,
        description: description || null,
        discountType: discountType || null,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        shopDomain: session.shop,
        active,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: 1,
          })),
        },
      },
    });

    return redirect("/app");
  } catch (error) {
    console.error("Error creating bundle:", error);
    return { error: "Failed to create bundle" };
  }
};

export default function NewBundle() {
  const navigate = useNavigate();

  const handleSubmit = async (data: {
    name: string;
    description: string;
    discountType: "percentage" | "fixed";
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

    const response = await fetch("/app/bundles/new", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      navigate("/app");
    }
  };

  return (
    <s-page heading="Create Bundle" back-action="/app">
      <BundleForm
        onSubmit={handleSubmit}
        submitButtonText="Create Bundle"
        onCancel={() => navigate("/app")}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
