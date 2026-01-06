/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  distributeDiscounts,
} from "../../utils/bundlePricing";
import { validateBundleForm } from "../../utils/bundleValidation";

export function BundleForm({
  initialData,
  onSubmit,
  onSubmitRef,
  labels = [],
}: BundleFormProps) {
  const shopify = useAppBridge();

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [image, setImage] = useState(initialData?.image || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
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
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(initialData?.labelIds || []);

  const selectedLabel = useMemo(() => {
      const selected = labels.filter(l => selectedLabelIds.includes(l.id));
      // Sort by priority desc (assuming priority field exists), else first selected
      return selected.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  }, [labels, selectedLabelIds]);

  const getPreviewLabelStyle = useCallback((label: typeof labels[0]) => {
    const styles: React.CSSProperties = {
      position: "absolute",
      backgroundColor: label.bgColor,
      color: label.textColor,
      padding: label.shape === "pill" ? "1px 3px" : "1px 2px",
      fontSize: "8px", 
      fontWeight: "bold",
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: "1px",
      textTransform: "uppercase",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      lineHeight: "1",
      maxWidth: "90%",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      pointerEvents: "none",
    };

    if (label.shape === "rounded") styles.borderRadius = "2px";
    if (label.shape === "pill") styles.borderRadius = "8px";
    if (label.shape === "square") styles.borderRadius = "0";

    const offset = "2px";
    if (label.position === "top-left") { styles.top = offset; styles.left = offset; }
    if (label.position === "top-right") { styles.top = offset; styles.right = offset; }
    if (label.position === "bottom-left") { styles.bottom = offset; styles.left = offset; }
    if (label.position === "bottom-right") { styles.bottom = offset; styles.right = offset; }

    return styles;
  }, []);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [nameError, setNameError] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [itemsError, setItemsError] = useState("");
  const [dateError, setDateError] = useState("");

  const handleSubmitForm = useCallback(async () => {
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
        image,
        imageFile,
        discountType,
        discountValue,
        active,
        startDate,
        endDate,
        items,
                labelIds: selectedLabelIds,      });
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
    imageFile,
    image,
    selectedLabelIds,
  ]);

  // Set default startDate on client-side only
  useEffect(() => {
    if (!initialData?.startDate && !startDate) {
      setStartDate(new Date().toISOString().split("T")[0]);
    }
  }, [initialData?.startDate, startDate]);
  // Expose submit function to parent
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmitForm;
    }
  }, [handleSubmitForm, onSubmitRef]);

  // Track created object URL so we can revoke it when replaced/unmount
  const prevImageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      try {
        if (prevImageUrlRef.current) {
          URL.revokeObjectURL(prevImageUrlRef.current);
        }
      } catch (err) {
        // ignore
      }
    };
  }, []);

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
        
        // Try to get variant image first, then product image
        const variantImage = (variant as any).image;
        const productImage = product.images && product.images[0];
        const imageSource = variantImage || productImage;
        const imageUrl = imageSource
          ? imageSource.originalSrc || imageSource.url || imageSource.src
          : undefined;

        return {
          id: crypto.randomUUID(),
          productId: String(product.id),
          variantId: String(variant.id ?? ""),
          title: String(product.title ?? ""),
          handle: String((product as any).handle ?? ""),
          sku: String(variant.sku ?? "N/A"),
          variant: String(variant.title ?? ""),
          price: parseFloat(String(variant.price ?? "0")) || 0,
          image: imageUrl,
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
        setValidationErrors(errors);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setValidationErrors([]);
      try {
        await onSubmit({
          name,
          description,
          image,
          imageFile,
          discountType,
          discountValue,
          active,
          startDate,
          endDate,
          items,
                  labelIds: selectedLabelIds,        });
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
      image,
      imageFile,
      selectedLabelIds,
    ],
  );

  const total = useMemo(() => calculateTotal(items), [items]);
  const breakdown = useMemo(
    () => distributeDiscounts(items, discountType, discountValue),
    [items, discountType, discountValue],
  );
  const discount = breakdown.totalDiscount;
  const finalPrice = breakdown.finalPrice;

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
            {/* Name */}
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
            {/* Description */}
            <s-text-area
              label="Description"
              value={description}
              onInput={(e) =>
                setDescription((e.target as HTMLTextAreaElement).value)
              }
              placeholder="Describe the contents and value of this bundle..."
              rows={4}
            />

            {/* Bundle Label Selection */}
            <div>
              <s-text type="strong" style={{marginBottom: "8px", display: "block", fontSize: "14px", fontWeight: 500}}>Bundle Labels</s-text>
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #d1d5db", borderRadius: "4px", padding: "12px", backgroundColor: "white" }}>
                {labels.length === 0 && <s-text tone="neutral">No labels available. Create one first.</s-text>}
                {labels.map((l) => (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <input
                      type="checkbox"
                      id={`label-${l.id}`}
                      checked={selectedLabelIds.includes(l.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLabelIds((prev) => [...prev, l.id]);
                        } else {
                          setSelectedLabelIds((prev) => prev.filter((id) => id !== l.id));
                        }
                      }}
                      style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#000" }}
                    />
                    <div style={{ flex: 1 }}>
                      <label htmlFor={`label-${l.id}`} style={{ cursor: "pointer", fontWeight: 600, fontSize: "14px", display: "block" }}>
                        {l.name}
                      </label>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{l.text}</div>
                    </div>
                    {/* Mini Preview */}
                    <div
                      style={{
                        backgroundColor: l.bgColor,
                        color: l.textColor,
                        padding: l.shape === "pill" ? "2px 8px" : "2px 6px",
                        borderRadius: l.shape === "pill" ? "10px" : l.shape === "rounded" ? "4px" : "0",
                        fontSize: "10px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {l.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "4px" }}>
                <s-text tone="neutral">
                  Select one or more labels. The label with the highest priority will be shown.
                </s-text>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <s-drop-zone
                label="Upload bundle image"
                accessibilityLabel="Upload bundle image of type jpg, png, or gif"
                accept=".jpg,.jpeg,.png,.gif"
                onInput={(event: unknown) => {
                  const ev = event as Event & {
                    target?: { files?: FileList };
                    currentTarget?: { files?: FileList };
                  };
                  const files: FileList | null =
                    (ev.target && ev.target.files) ||
                    (ev.currentTarget && ev.currentTarget.files) ||
                    null;

                  if (files && files.length > 0) {
                    const file = files[0];
                    try {
                      const url = URL.createObjectURL(file);
                      // revoke previous object URL if we created one
                      try {
                        if (prevImageUrlRef.current) {
                          URL.revokeObjectURL(prevImageUrlRef.current);
                        }
                      } catch (err) {
                        // ignore
                      }
                      prevImageUrlRef.current = url;
                      setImage(url);
                      setImageFile(file);
                    } catch (err) {
                      console.error("Failed to create object URL:", err);
                    }
                  }
                }}
                onDropRejected={(event: unknown) => {
                  console.warn("Drop rejected", event);
                }}
              >
                <s-text tone="neutral">
                  Drag and drop an image here, or click to browse.
                </s-text>
              </s-drop-zone>

              {image ? (
                <div style={{ marginTop: "8px" }}>
                  <s-thumbnail
                    alt={description || name || "Bundle image"}
                    src={image}
                    size="small"
                  />
                </div>
              ) : null}
            </div>
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
                  } else if (
                    discountType === "fixed" &&
                    !isNaN(numValue) &&
                    numValue > total
                  ) {
                    setDiscountError(
                      `Fixed discount cannot exceed total product value ($${total.toFixed(2)})`,
                    );
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
                          : "$" + discountValue}{" "}
                        per item)
                      </span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic", marginTop: "-4px" }}>
                   * The discount value is applied to each product in the bundle individually.
                  </div>

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
                  ...(items.length > 5
                    ? {
                        maxHeight: "420px",
                        overflowY: "auto",
                        paddingRight: "4px",
                      }
                    : {}),
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
                        position: "relative",
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
                      
                      {selectedLabel && (
                        <div style={getPreviewLabelStyle(selectedLabel)}>
                          {selectedLabel.text}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <s-stack>
                        <s-text>{item.title}</s-text>
                        {item.variant && item.variant !== "Default Title" ? (
                          <s-text tone="neutral">{item.variant}</s-text>
                        ) : null}
                        {item.sku && item.sku !== "N/A" ? (
                           <s-text tone="neutral" size="small">SKU: {item.sku}</s-text>
                        ) : null}
                      </s-stack>
                    </div>
                    <div style={{ minWidth: "140px", textAlign: "right" }}>
                      {(() => {
                        const itemBreak = breakdown.items.find(
                          (b) => b.id === item.id,
                        );
                        if (itemBreak) {
                          return (
                            <div>
                              <s-text>${item.price.toFixed(2)}</s-text>
                              {itemBreak.discountAmount > 0 && (
                                <div
                                  style={{ color: "#059669", fontSize: "13px" }}
                                >
                                  -${itemBreak.discountAmount.toFixed(2)}
                                </div>
                              )}
                              <div style={{ fontWeight: 600 }}>
                                ${itemBreak.finalPrice.toFixed(2)}
                              </div>
                            </div>
                          );
                        }
                        return <s-text>${item.price.toFixed(2)}</s-text>;
                      })()}
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

        {/* Availability */}
        <s-section>
          <s-stack gap="base">
            <s-heading>Availability</s-heading>

            <s-stack direction="inline" justifyContent="space-between">
              <s-stack gap="small">
                <div>
                  <s-text type="strong">Status</s-text>
                </div>

                <s-stack direction="inline" gap="base">
                  <s-text tone="neutral">{active ? "Active" : "Draft"}</s-text>
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

              <s-stack direction="inline" gap="large">
                <s-stack gap="base">
                  <s-text type="strong">Start Date</s-text>
                  <s-date-picker
                    value={startDate}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      setStartDate(value);
                      if (!value) {
                        setDateError("Start date is required");
                      } else if (
                        endDate &&
                        new Date(value) > new Date(endDate)
                      ) {
                        setDateError("End date must be after start date");
                      } else {
                        setDateError("");
                      }
                    }}
                  />
                </s-stack>

                <s-stack gap="base">
                  <s-text type="strong">End Date</s-text>
                  <s-date-picker
                    value={endDate}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      setEndDate(value);
                      if (
                        value &&
                        startDate &&
                        new Date(startDate) > new Date(value)
                      ) {
                        setDateError("End date must be after start date");
                      } else {
                        setDateError("");
                      }
                    }}
                  />
                </s-stack>
              </s-stack>
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