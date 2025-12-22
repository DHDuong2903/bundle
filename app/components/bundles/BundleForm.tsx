/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type {
  ProductItem,
  DiscountType,
  PickerVariant,
  PickerProduct,
  BundleFormProps,
} from "../../types";
import {
  calculateTotal,
  calculateDiscount,
  calculateFinalPrice,
} from "../../utils/bundlePricing";
import { validateBundleForm } from "../../utils/bundleValidation";

export function BundleForm({
  initialData,
  onSubmit,
  onSubmitRef,
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
  const [nameError, setNameError] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [itemsError, setItemsError] = useState("");
  const [dateError, setDateError] = useState("");

  const handleSubmitForm = useCallback(async () => {
    console.log("=== VALIDATION START ===");
    console.log("handleSubmitForm called", {
      name,
      items: items.length,
      discountType,
      discountValue,
      startDate,
      endDate,
    });

    // Clear previous errors
    setNameError("");
    setDiscountError("");
    setDateError("");
    setItemsError("");

    const errors = validateBundleForm(
      name,
      items,
      discountType,
      discountValue,
      startDate,
      endDate,
    );

    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setValidationErrors([]);
    try {
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
    } catch (error) {
      console.error("Error in onSubmit:", error);
    }
  }, [
    name,
    items,
    discountType,
    discountValue,
    startDate,
    endDate,
    description,
    active,
    onSubmit,
  ]);

  // Set default startDate on client-side only
  useEffect(() => {
    if (!initialData?.startDate && !startDate) {
      setStartDate(new Date().toISOString().split("T")[0]);
    }
  }, []);

  // Expose submit function to parent
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmitForm;
    }
  }, [handleSubmitForm, onSubmitRef]);

  const handleRemoveProduct = useCallback((id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  const handleBrowseProducts = useCallback(async () => {
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

      setItems((prevItems) => [...prevItems, ...newItems]);
    }
  }, [shopify]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const errors = validateBundleForm(
        name,
        items,
        discountType,
        discountValue,
        startDate,
        endDate,
      );

      if (errors.length > 0) {
        console.log("Validation errors:", errors);
        setValidationErrors(errors);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setValidationErrors([]);
      try {
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
        console.log("onSubmit completed");
      } catch (error) {
        console.error("Error in onSubmit:", error);
      }
    },
    [
      name,
      items,
      discountType,
      discountValue,
      startDate,
      endDate,
      description,
      active,
      onSubmit,
    ],
  );

  const total = useMemo(() => calculateTotal(items), [items]);
  const discount = useMemo(
    () => calculateDiscount(items, discountType, discountValue),
    [items, discountType, discountValue],
  );
  const finalPrice = useMemo(
    () => calculateFinalPrice(items, discountType, discountValue),
    [items, discountType, discountValue],
  );

  return (
    <form id="bundle-form" onSubmit={handleSubmit}>
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

      <s-stack gap="large">
        {/* Bundle Details */}
        <s-section>
          <s-stack gap="base">
            <s-heading>Bundle details</s-heading>

            <s-text-field
              label="Bundle Name"
              required
              value={name}
              onInput={(e) => {
                const value = (e.target as HTMLInputElement).value;
                setName(value);
                if (!value.trim()) {
                  setNameError("Bundle name is required");
                } else {
                  setNameError("");
                }
              }}
              placeholder="e.g., Summer Essentials Pack"
              error={nameError}
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
              <s-button type="button" onClick={handleBrowseProducts}>
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
                        <s-icon type="image" />
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

        {/* Pricing Rules & Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "20px",
          }}
        >
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
                  <s-text type="strong">Discount Type</s-text>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <s-button
                    type="button"
                    variant={
                      discountType === "percentage" ? "primary" : "secondary"
                    }
                    onClick={() => setDiscountType("percentage")}
                  >
                    Percentage
                  </s-button>
                  <s-button
                    type="button"
                    variant={discountType === "fixed" ? "primary" : "secondary"}
                    onClick={() => setDiscountType("fixed")}
                  >
                    Fixed
                  </s-button>
                </div>
              </div>

              <s-text-field
                label={`Discount Value ${discountType === "percentage" ? "(%)" : ""}`}
                value={discountValue}
                onInput={(e) => {
                  const value = (e.target as HTMLInputElement).value;
                  setDiscountValue(value);
                  const numValue = parseFloat(value);
                  if (value && (isNaN(numValue) || numValue < 0)) {
                    setDiscountError("Discount must be a positive number");
                  } else if (discountType === "percentage" && numValue > 100) {
                    setDiscountError("Percentage cannot exceed 100%");
                  } else {
                    setDiscountError("");
                  }
                }}
                placeholder="0"
                suffix={discountType === "percentage" ? "%" : ""}
                error={discountError}
              />
            </s-stack>
          </s-section>

          {/* Summary */}
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
            </s-stack>
          </s-section>
        </div>

        {/* Availability */}
        <s-section>
          <s-stack gap="base">
            <s-heading>Availability</s-heading>

            <div>
              <s-stack gap="small">
                <div>
                  <s-text type="strong">Status</s-text>
                </div>

                <s-stack direction="inline" gap="base">
                  <s-text tone="neutral">
                    {active ? "Active" : "Inactive"}
                  </s-text>
                  <s-switch
                    accessibilityLabel="Toggle bundle active status"
                    checked={active}
                    onChange={(e) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      if (checked && items.length === 0) {
                        setItemsError(
                          "Cannot activate a bundle with no products",
                        );
                      } else {
                        setActive(checked);
                        setItemsError("");
                      }
                    }}
                  />
                </s-stack>
                <s-text tone="neutral">
                  {active
                    ? "Bundle is visible to customers"
                    : "Bundle is hidden from customers"}
                </s-text>

                {itemsError && <s-text tone="critical">{itemsError}</s-text>}
              </s-stack>
            </div>

            <s-stack direction="inline" gap="large">
              <div>
                <s-text type="strong">Start Date</s-text>
                <s-date-picker
                  value={startDate}
                  onInput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    setStartDate(value);
                    if (!value) {
                      setDateError("Start date is required");
                    } else if (endDate && new Date(value) > new Date(endDate)) {
                      setDateError("End date must be after start date");
                    } else {
                      setDateError("");
                    }
                  }}
                />
              </div>

              <div>
                <s-text type="strong">End Date</s-text>
                <s-date-picker
                  value={endDate}
                  onInput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    setEndDate(value);
                    if (!value) {
                      setDateError("End date is required");
                    } else if (
                      startDate &&
                      new Date(startDate) > new Date(value)
                    ) {
                      setDateError("End date must be after start date");
                    } else {
                      setDateError("");
                    }
                  }}
                />
              </div>
            </s-stack>

            {dateError && <s-text tone="critical">{dateError}</s-text>}

            <s-text tone="neutral">
              Dates are required for bundle availability
            </s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </form>
  );
}
