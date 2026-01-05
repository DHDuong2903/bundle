import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useActionData,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const labels = await db.label.findMany({
    where: { shopDomain: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return { labels };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const labelId = formData.get("labelId") as string;

  if (action === "delete" && labelId) {
    try {
      await db.label.delete({
        where: { id: labelId, shopDomain: session.shop },
      });
      return { success: true, message: "Label deleted successfully" };
    } catch (error) {
      console.error("Error deleting label:", error);
      return { error: "Failed to delete label" };
    }
  }
  return { error: "Invalid action" };
};

export default function LabelListing() {
  const { labels } = useLoaderData<typeof loader>();
  const actionData = useActionData<{
    success?: boolean;
    error?: string;
    message?: string;
  }>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const [deletingLabel, setDeletingLabel] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Show toast on delete success, update, or create
  useEffect(() => {
    const url = new URL(window.location.href);
    const actionParam = url.searchParams.get("action");

    if (actionParam === "updated") {
      shopify.toast.show("Label updated successfully");
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.pathname);
    }

    if (actionData?.success) {
      shopify.toast.show(actionData.message || "Label deleted successfully");
    } else if (actionData?.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const filteredLabels = labels.filter(
    (label) =>
      label.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      label.text.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredLabels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLabels = filteredLabels.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = () => {
    if (deletingLabel) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("labelId", deletingLabel.id);
      submit(formData, { method: "post" });
      setDeletingLabel(null);
    }
  };

  return (
    <s-page heading="Bundle Labels">
      <s-modal
        id="delete-label-modal"
        heading="Delete label?"
        open={!!deletingLabel}
      >
        <s-stack gap="base">
          <s-paragraph>
            Are you sure you want to delete label "{deletingLabel?.name}"? This
            label will no longer appear on products in associated bundles.
          </s-paragraph>
        </s-stack>
        <s-button
          slot="secondary-actions"
          commandFor="delete-label-modal"
          command="--hide"
          onClick={() => setDeletingLabel(null)}
        >
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="delete-label-modal"
          command="--hide"
          onClick={confirmDelete}
        >
          Delete label
        </s-button>
      </s-modal>

      <s-section>
        <s-stack gap="base">
          <s-button
            variant="primary"
            icon="plus"
            onClick={() => navigate("/app/labels/new")}
          >
            Create Label
          </s-button>

          <s-paragraph>
            Design and manage labels to highlight bundles on your storefront.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section>
        {labels.length === 0 ? (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "16px", fontSize: "48px" }}>🏷️</div>
            <s-heading>No labels yet</s-heading>
            <s-paragraph>
              Create your first label to highlight your bundles on the
              storefront.
            </s-paragraph>
            <div style={{ marginTop: "24px" }}>
              <s-button
                variant="primary"
                icon="plus"
                onClick={() => navigate("/app/labels/new")}
              >
                Create your first label
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
                <s-search-field
                  placeholder="Search labels..."
                  value={searchTerm}
                  onInput={(e) => {
                    setSearchTerm((e.target as HTMLInputElement).value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                />
              </div>
              <s-table-header-row>
                <s-table-header>Preview</s-table-header>
                <s-table-header>Internal Name</s-table-header>
                <s-table-header>Display Text</s-table-header>
                <s-table-header format="numeric">Priority</s-table-header>
                <s-table-header>Visibility</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {paginatedLabels.map((label) => (
                  <s-table-row key={label.id}>
                    <s-table-cell>
                      <div
                        style={{
                          width: "100px",
                          height: "100px",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "8px",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #e5e7eb",
                          overflow: "hidden",
                        }}
                      >
                        <s-icon type="image" tone="neutral" />
                        <div
                          style={{
                            position: "absolute",
                            backgroundColor: label.bgColor,
                            color: label.textColor,
                            padding:
                              label.shape === "pill" ? "2px 8px" : "2px 4px",
                            fontSize: "8px",
                            fontWeight: "bold",
                            borderRadius:
                              label.shape === "rounded"
                                ? "2px"
                                : label.shape === "pill"
                                  ? "12px"
                                  : "0",
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                            textTransform: "uppercase",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                            whiteSpace: "nowrap",
                            ...(label.position === "top-left"
                              ? { top: "6px", left: "6px" }
                              : {}),
                            ...(label.position === "top-right"
                              ? { top: "6px", right: "6px" }
                              : {}),
                            ...(label.position === "bottom-left"
                              ? { bottom: "6px", left: "6px" }
                              : {}),
                            ...(label.position === "bottom-right"
                              ? { bottom: "6px", right: "6px" }
                              : {}),
                          }}
                        >
                          {label.icon && (
                            <s-icon
                              type={label.icon as any}
                              style={{ width: "8px", height: "8px" }}
                            />
                          )}
                          {label.text}
                        </div>
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text type="strong">{label.name}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text>{label.text}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text>{label.priority}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack gap="small" direction="inline">
                        {label.showOnPDP && (
                          <s-badge tone="success">PDP</s-badge>
                        )}
                        {label.showOnCollection && (
                          <s-badge tone="info">Collection</s-badge>
                        )}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <s-button
                          icon="edit"
                          variant="tertiary"
                          onClick={() => navigate(`/app/labels/${label.id}`)}
                        />
                        <s-button
                          icon="delete"
                          variant="tertiary"
                          tone="critical"
                          commandFor="delete-label-modal"
                          onClick={() =>
                            setDeletingLabel({ id: label.id, name: label.name })
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
                {Math.min(endIndex, filteredLabels.length)} of{" "}
                {filteredLabels.length}{" "}
                {filteredLabels.length === 1 ? "label" : "labels"}
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
