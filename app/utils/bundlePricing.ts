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

export function validateBundleForm(
  name: string,
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
): string[] {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push("Bundle name is required");
  }

  if (items.length === 0) {
    errors.push("At least one product is required");
  }

  if (
    discountType === "percentage" &&
    discountValue &&
    parseFloat(discountValue) > 100
  ) {
    errors.push("Percentage discount cannot exceed 100%");
  }

  if (discountValue && parseFloat(discountValue) < 0) {
    errors.push("Discount value cannot be negative");
  }

  return errors;
}
