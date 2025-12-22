import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useNavigate, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface BundleData {
  id: string;
  name: string;
  description: string | null;
  discountType: string | null;
  discountValue: number | null;
  active: boolean;
  itemCount: number;
  price: number;
  inventory: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

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

  const bundlesData: BundleData[] = [];
  for (const bundle of bundles) {
    const basePrice = bundle.items.length * 25; // Placeholder

    // Calculate final price after discount
    let finalPrice = basePrice;
    if (bundle.discountType && bundle.discountValue) {
      if (bundle.discountType === "percentage") {
        finalPrice = basePrice - (basePrice * bundle.discountValue) / 100;
      } else if (bundle.discountType === "fixed") {
        finalPrice = basePrice - bundle.discountValue;
      }
    }

    // Fetch inventory for bundle items from Shopify Admin API
    let inventory = 0;
    try {
      const inventories: number[] = [];

      for (const item of bundle.items) {
        try {
          const response = await admin.graphql(
            `#graphql
            query getProduct($id: ID!) {
              product(id: $id) {
                variants(first: 10) {
                  nodes {
                    id
                    inventoryQuantity
                  }
                }
              }
            }`,
            { variables: { id: item.productId } },
          );

          const data = await response.json();
          const product = data.data?.product;
          if (
            product &&
            product.variants &&
            product.variants.nodes.length > 0
          ) {
            // Use the first variant's inventory as a simple heuristic
            const qty = product.variants.nodes[0].inventoryQuantity;
            inventories.push(typeof qty === "number" ? qty : 0);
          } else {
            inventories.push(0);
          }
        } catch (err) {
          console.error(
            `Error fetching inventory for product ${item.productId}:`,
            err,
          );
          inventories.push(0);
        }
      }

      if (inventories.length > 0) {
        // For bundle availability, the limiting factor is the minimum inventory
        inventory = Math.max(0, Math.min(...inventories));
      }
    } catch (err) {
      console.error("Error fetching inventories for bundle:", err);
      inventory = 0;
    }

    bundlesData.push({
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      discountType: bundle.discountType,
      discountValue: bundle.discountValue,
      active: bundle.active,
      itemCount: bundle.items.length,
      price: Math.max(0, finalPrice),
      inventory,
    });
  }

  return { bundles: bundlesData };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const bundleId = formData.get("bundleId") as string;

  if (action === "delete" && bundleId) {
    try {
      await db.bundle.delete({
        where: {
          id: bundleId,
          shopDomain: session.shop,
        },
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting bundle:", error);
      return { error: "Failed to delete bundle" };
    }
  }

  return { error: "Invalid action" };
};

export default function Index() {
  const { bundles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<
    "all" | "percentage" | "fixed"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [deletingBundle, setDeletingBundle] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleEdit = (bundleId: string) => {
    navigate(`/app/bundles/${bundleId}/edit`);
  };

  const handleDeleteClick = (bundleId: string, bundleName: string) => {
    setDeletingBundle({ id: bundleId, name: bundleName });
    setDeleteConfirmText("");
  };

  const confirmDelete = () => {
    if (deletingBundle) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("bundleId", deletingBundle.id);
      submit(formData, { method: "post" });
      setDeletingBundle(null);
      setDeleteConfirmText("");
    }
  };

  const filteredBundles = bundles.filter((bundle) => {
    const matchesSearch =
      bundle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bundle.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && bundle.active) ||
      (statusFilter === "inactive" && !bundle.active);

    const matchesDiscountType =
      discountTypeFilter === "all" ||
      bundle.discountType === discountTypeFilter;

    return matchesSearch && matchesStatus && matchesDiscountType;
  });

  const totalPages = Math.ceil(filteredBundles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBundles = filteredBundles.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage(currentPage + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePreviousPage = () => {
    setCurrentPage(currentPage - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <s-page heading="Product Bundles">
      <s-modal
        id="delete-modal"
        heading="Delete bundle?"
        open={!!deletingBundle}
      >
        <s-stack gap="base">
          <s-paragraph>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Are you sure you want to delete "{deletingBundle?.name}"? This
            action cannot be undone.
          </s-paragraph>

          <s-text-field
            label={`Type "${deletingBundle?.name}" to confirm`}
            value={deleteConfirmText}
            onInput={(e) =>
              setDeleteConfirmText((e.target as HTMLInputElement).value)
            }
            placeholder="Enter bundle name"
          />
        </s-stack>

        <s-button
          slot="secondary-actions"
          commandFor="delete-modal"
          command="--hide"
          onClick={() => {
            setDeletingBundle(null);
            setDeleteConfirmText("");
          }}
        >
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="delete-modal"
          command="--hide"
          onClick={confirmDelete}
          disabled={deleteConfirmText !== deletingBundle?.name}
        >
          Delete bundle
        </s-button>
      </s-modal>

      <s-section>
        <s-stack gap="base">
          <s-button
            variant="primary"
            icon="plus"
            onClick={() => navigate("/app/bundles/new")}
          >
            Create bundle
          </s-button>
          <s-paragraph>
            Manage your active discounts and grouped products. Create offers
            that increase your average order value.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section>
        {bundles.length === 0 ? (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "16px", fontSize: "48px" }}>📦</div>
            <s-heading>No bundles yet</s-heading>
            <s-paragraph>
              Create your first product bundle to start offering discounts and
              increasing your average order value.
            </s-paragraph>
            <div style={{ marginTop: "24px" }}>
              <s-button
                variant="primary"
                icon="plus"
                onClick={() => navigate("/app/bundles/new")}
              >
                Create your first bundle
              </s-button>
            </div>
          </div>
        ) : (
          <s-section padding="none">
            <s-table>
              <div
                slot="filters"
                style={{ display: "flex", gap: "12px", marginBottom: "16px" }}
              >
                <s-text-field
                  placeholder="Search bundles by name..."
                  value={searchTerm}
                  onInput={(e) =>
                    setSearchTerm((e.target as HTMLInputElement).value)
                  }
                  icon="search"
                  style={{ flex: 1 }}
                />
                <s-button commandFor="status-filter-menu" icon="filter">
                  Status:{" "}
                  {statusFilter === "all"
                    ? "All"
                    : statusFilter === "active"
                      ? "Active"
                      : "Inactive"}
                </s-button>
                <s-menu
                  id="status-filter-menu"
                  accessibilityLabel="Filter by status"
                >
                  <s-button onClick={() => setStatusFilter("all")}>
                    All statuses
                  </s-button>
                  <s-button onClick={() => setStatusFilter("active")}>
                    Active
                  </s-button>
                  <s-button onClick={() => setStatusFilter("inactive")}>
                    Inactive
                  </s-button>
                </s-menu>

                <s-button commandFor="discount-filter-menu" icon="filter">
                  Discount:{" "}
                  {discountTypeFilter === "all"
                    ? "All"
                    : discountTypeFilter === "percentage"
                      ? "Percentage"
                      : "Fixed"}
                </s-button>
                <s-menu
                  id="discount-filter-menu"
                  accessibilityLabel="Filter by discount type"
                >
                  <s-button onClick={() => setDiscountTypeFilter("all")}>
                    All discounts
                  </s-button>
                  <s-button onClick={() => setDiscountTypeFilter("percentage")}>
                    Percentage
                  </s-button>
                  <s-button onClick={() => setDiscountTypeFilter("fixed")}>
                    Fixed
                  </s-button>
                </s-menu>
              </div>
              <s-table-header-row>
                <s-table-header listSlot="primary">Bundle Name</s-table-header>
                <s-table-header listSlot="inline">Status</s-table-header>
                <s-table-header format="numeric" listSlot="labeled">
                  Products
                </s-table-header>
                <s-table-header listSlot="labeled">Discount</s-table-header>
                <s-table-header format="numeric" listSlot="labeled">
                  Inventory
                </s-table-header>
                <s-table-header listSlot="inline">Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {paginatedBundles.map((bundle) => (
                  <s-table-row key={bundle.id}>
                    <s-table-cell>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "8px",
                            backgroundColor: bundle.active
                              ? "#d1f7e5"
                              : "#e5e7eb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                          }}
                        >
                          📦
                        </div>
                        <div>
                          <s-heading>{bundle.name}</s-heading>
                          <s-text tone="neutral">
                            {bundle.description || "No description"}
                          </s-text>
                        </div>
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={bundle.active ? "success" : "info"}>
                        {bundle.active ? "Active" : "Inactive"}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text>{bundle.itemCount} items</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text>
                        {bundle.discountType && bundle.discountValue
                          ? `${bundle.discountValue}${bundle.discountType === "percentage" ? "%" : " USD"}`
                          : "No discount"}
                      </s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text>{bundle.inventory} available</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <s-button
                          icon="edit"
                          variant="tertiary"
                          onClick={() => handleEdit(bundle.id)}
                        />
                        <s-button
                          icon="delete"
                          variant="tertiary"
                          tone="critical"
                          commandFor="delete-modal"
                          onClick={() =>
                            handleDeleteClick(bundle.id, bundle.name)
                          }
                        />
                      </div>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px",
                borderTop: "1px solid var(--s-color-border)",
              }}
            >
              <s-text tone="neutral">
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredBundles.length)} of{" "}
                {filteredBundles.length}{" "}
                {filteredBundles.length === 1 ? "bundle" : "bundles"}
              </s-text>
              {totalPages > 1 && (
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <s-button
                    icon="chevron-left"
                    variant="tertiary"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  />
                  <s-text>
                    Page {currentPage} of {totalPages}
                  </s-text>
                  <s-button
                    icon="chevron-right"
                    variant="tertiary"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  />
                </div>
              )}
            </div>
          </s-section>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
