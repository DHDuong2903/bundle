import type { ProductItem, DiscountType } from "../types/bundle.types";

export function calculateTotal(items: ProductItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function calculateDiscount(
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
): number {
  const total = calculateTotal(items);
  if (!discountValue) return 0;

  const value = parseFloat(discountValue);

  if (discountType === "percentage") {
    return (total * value) / 100;
  } else if (discountType === "fixed") {
    return value;
  }
  return 0;
}

export function calculateFinalPrice(
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
): number {
  return (
    calculateTotal(items) -
    calculateDiscount(items, discountType, discountValue)
  );
}

// Validation logic has been moved to bundleValidation.ts
// Import from there: import { validateBundleForm } from "../utils/bundleValidation";
