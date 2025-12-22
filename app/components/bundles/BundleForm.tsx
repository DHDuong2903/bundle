/* eslint-disable jsx-a11y/label-has-associated-control */
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { ProductItem, DiscountType } from "../../types/bundle.types";

// Types for the resourcePicker payload (narrowed to avoid `any`)
type PickerImage = { originalSrc?: string; url?: string; src?: string };
type PickerVariant = {
  id?: string;
  sku?: string;
  title?: string;
  price?: string;
};
type PickerProduct = {
  id: string;
  title?: string;
  variants?: PickerVariant[];
  images?: PickerImage[];
};
import {
  calculateTotal,
  calculateDiscount,
  calculateFinalPrice,
  validateBundleForm,
} from "../../utils/bundlePricing";

interface BundleFormProps {
  initialData?: {
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: string;
    active: boolean;
    startDate: string;
    endDate: string;
    items: ProductItem[];
  };
  onSubmit: (data: {
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: string;
    active: boolean;
    startDate: string;
    endDate: string;
    items: ProductItem[];
  }) => Promise<void>;
  submitButtonText?: string;
  onCancel?: () => void;
}

export function BundleForm({
  initialData,
  onSubmit,
  submitButtonText = "Create Bundle",
  onCancel,
}: BundleFormProps) {
  const shopify = useAppBridge();

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [discountType, setDiscountType] = useState<DiscountType>(
    initialData?.discountType || "percentage",
  );
  const [discountValue, setDiscountValue] = useState(
    initialData?.discountValue || "",
  );
  const [active, setActive] = useState(initialData?.active || false);
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [items, setItems] = useState<ProductItem[]>(initialData?.items || []);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleRemoveProduct = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleEditProduct = async (id: string) => {
    const selected = (await shopify.resourcePicker({
      type: "product",
      multiple: false,
    })) as PickerProduct[] | null;

    if (selected && selected.length > 0) {
      const product = selected[0] as PickerProduct;
      const variant =
        (product.variants && product.variants[0]) || ({} as PickerVariant);

      setItems(
        items.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              productId: String(product.id),
              variantId: String(variant.id ?? ""),
              title: String(product.title ?? ""),
              sku: String(variant.sku ?? "N/A"),
              variant: String(variant.title ?? ""),
              price: parseFloat(String(variant.price ?? "0")) || 0,
              image:
                (product.images &&
                  product.images[0] &&
                  (product.images[0].originalSrc ||
                    product.images[0].url ||
                    product.images[0].src)) ||
                undefined,
            } as ProductItem;
          }
          return item;
        }),
      );
    }
  };

  const handleBrowseProducts = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
    });

    if (selected) {
      const newItems = (selected as PickerProduct[]).map((product) => {
        const variant =
          (product.variants && product.variants[0]) || ({} as PickerVariant);
        return {
          id: crypto.randomUUID(),
          productId: String(product.id),
          variantId: String(variant.id ?? ""),
          title: String(product.title ?? ""),
          sku: String(variant.sku ?? "N/A"),
          variant: String(variant.title ?? ""),
          price: parseFloat(String(variant.price ?? "0")) || 0,
          image:
            (product.images &&
              product.images[0] &&
              (product.images[0].originalSrc ||
                product.images[0].url ||
                product.images[0].src)) ||
            undefined,
        } as ProductItem;
      });

      setItems([...items, ...newItems]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateBundleForm(name, items, discountType, discountValue);

    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setValidationErrors([]);
    await onSubmit({
      name,
      description,
      discountType,
      discountValue,
      active,
      startDate,
      endDate,
      items,
    });
  };

  const total = calculateTotal(items);
  const discount = calculateDiscount(items, discountType, discountValue);
  const finalPrice = calculateFinalPrice(items, discountType, discountValue);

  return (
    <form onSubmit={handleSubmit}>
      {validationErrors.length > 0 && (
        <s-section>
          <s-banner tone="critical" heading="Please fix the following errors:">
            <s-stack gap="small">
              {validationErrors.map((error, index) => (
                <s-text key={index}>• {error}</s-text>
              ))}
            </s-stack>
          </s-banner>
        </s-section>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "20px",
        }}
      >
        {/* Left Column */}
        <s-stack gap="large">
          {/* Bundle Details */}
          <s-section>
            <s-stack gap="base">
              <s-heading>Bundle details</s-heading>

              <s-text-field
                label="Bundle Name"
                required
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="e.g., Summer Essentials Pack"
              />

              <s-text-area
                label="Description"
                value={description}
                onInput={(e) =>
                  setDescription((e.target as HTMLTextAreaElement).value)
                }
                placeholder="Describe the contents and value of this bundle..."
                rows={4}
              />
            </s-stack>
          </s-section>

          {/* Products in Bundle */}
          <s-section>
            <s-stack gap="base">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <s-heading>Products in bundle</s-heading>
                <s-button
                  type="button"
                  onClick={handleBrowseProducts}
                  variant="plain"
                >
                  Browse products
                </s-button>
              </div>

              {items.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        padding: "12px 16px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <s-icon name="image" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <s-text>{item.title}</s-text>
                      </div>
                      <div style={{ minWidth: "100px", textAlign: "right" }}>
                        <s-text>${item.price.toFixed(2)}</s-text>
                      </div>
                      <s-button
                        type="button"
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        onClick={() => handleRemoveProduct(item.id)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    border: "1px dashed var(--s-color-border)",
                    borderRadius: "var(--s-border-radius-base)",
                    backgroundColor: "var(--s-color-bg-surface-secondary)",
                  }}
                >
                  <s-text tone="neutral">
                    No products added yet. Search or browse to add products.
                  </s-text>
                </div>
              )}
            </s-stack>
          </s-section>

          {/* Pricing Rules */}
          <s-section>
            <s-stack gap="base">
              <s-heading>Pricing rules</s-heading>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 500,
                    fontSize: "14px",
                  }}
                >
                  Discount Type
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <s-button
                    type="button"
                    variant={
                      discountType === "percentage" ? "primary" : "secondary"
                    }
                    onClick={() => setDiscountType("percentage")}
                    style={{ flex: 1 }}
                  >
                    Percentage
                  </s-button>
                  <s-button
                    type="button"
                    variant={discountType === "fixed" ? "primary" : "secondary"}
                    onClick={() => setDiscountType("fixed")}
                    style={{ flex: 1 }}
                  >
                    Fixed
                  </s-button>
                </div>
              </div>

              <s-text-field
                label={`Discount Value ${discountType === "percentage" ? "(%)" : ""}`}
                type="number"
                value={discountValue}
                onInput={(e) =>
                  setDiscountValue((e.target as HTMLInputElement).value)
                }
                placeholder="0"
                min="0"
                step={discountType === "percentage" ? "1" : "0.01"}
                max={discountType === "percentage" ? "100" : undefined}
                suffix={discountType === "percentage" ? "%" : ""}
              />
            </s-stack>
          </s-section>

          {/* Availability */}
          <s-section>
            <s-stack gap="base">
              <s-heading>Availability</s-heading>

              <div>
                <s-stack gap="small">
                  <div>
                    <s-text variant="heading">Status</s-text>
                    <s-text tone="neutral">Draft bundles are hidden</s-text>
                  </div>

                  <s-button commandFor="status-menu">
                    {active ? "Active (visible)" : "Draft (hidden)"}
                  </s-button>
                  <s-menu
                    id="status-menu"
                    accessibilityLabel="Select bundle status"
                  >
                    <s-button onClick={() => setActive(false)}>
                      Draft (hidden)
                    </s-button>
                    <s-button
                      onClick={() => setActive(true)}
                      disabled={items.length === 0}
                    >
                      Active (visible)
                    </s-button>
                  </s-menu>

                  {items.length === 0 && active && (
                    <s-text tone="critical" style={{ fontSize: "13px" }}>
                      Cannot activate a bundle with no products. Add products
                      first or save as Draft.
                    </s-text>
                  )}
                </s-stack>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <s-text
                    variant="heading"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    Start Date
                  </s-text>
                  <s-date-picker
                    value={startDate}
                    onInput={(e) =>
                      setStartDate((e.target as HTMLInputElement).value)
                    }
                  />
                </div>

                <div>
                  <s-text
                    variant="heading"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    End Date
                  </s-text>
                  <s-date-picker
                    value={endDate}
                    onInput={(e) =>
                      setEndDate((e.target as HTMLInputElement).value)
                    }
                  />
                </div>
              </div>

              <s-text tone="neutral" style={{ fontSize: "13px" }}>
                Leave blank for indefinite availability
              </s-text>
            </s-stack>
          </s-section>
        </s-stack>

        {/* Right Column - Summary */}
        <div>
          <s-section>
            <s-stack gap="base">
              <s-heading>Summary</s-heading>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                }}
              >
                <s-stack gap="small">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>
                      Total Product Value
                    </span>
                    <span>${total.toFixed(2)}</span>
                  </div>

                  {discountValue && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        color: "#059669",
                      }}
                    >
                      <span>
                        Bundle Discount (
                        {discountType === "percentage"
                          ? `${discountValue}%`
                          : "$" + discountValue}
                        )
                      </span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: "1px solid #d1d5db",
                      paddingTop: "12px",
                      marginTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "16px",
                        fontWeight: 600,
                      }}
                    >
                      <span>Final Bundle Price</span>
                      <span>${finalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </s-stack>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginTop: "16px",
                }}
              >
                <s-button
                  type="submit"
                  variant="primary"
                  style={{ width: "100%" }}
                >
                  {submitButtonText}
                </s-button>
                {onCancel && (
                  <s-button
                    type="button"
                    onClick={onCancel}
                    style={{ width: "100%" }}
                  >
                    Cancel
                  </s-button>
                )}
              </div>
            </s-stack>
          </s-section>
        </div>
      </div>
    </form>
  );
}
