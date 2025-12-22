import type { ProductItem, DiscountType } from "../types/bundle.types";

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Individual field validators
 */
export const validators = {
  /**
   * Validate bundle name
   */
  name: (name: string): string[] => {
    const errors: string[] = [];
    if (!name.trim()) {
      errors.push("Bundle name is required");
    }
    if (name.trim().length > 255) {
      errors.push("Bundle name must be less than 255 characters");
    }
    return errors;
  },

  /**
   * Validate bundle items/products
   */
  items: (items: ProductItem[]): string[] => {
    const errors: string[] = [];
    if (items.length === 0) {
      errors.push("At least one product is required");
    }
    return errors;
  },

  /**
   * Validate discount value
   */
  discount: (discountType: DiscountType, discountValue: string): string[] => {
    const errors: string[] = [];

    if (!discountValue || discountValue.trim() === "") {
      errors.push("Discount value is required");
      return errors;
    }

    const value = parseFloat(discountValue);

    if (isNaN(value)) {
      errors.push("Discount value must be a valid number");
      return errors;
    }

    if (value <= 0) {
      errors.push("Discount value must be greater than 0");
    }

    if (value < 0) {
      errors.push("Discount value cannot be negative");
    }

    if (discountType === "percentage" && value > 100) {
      errors.push("Percentage discount cannot exceed 100%");
    }

    return errors;
  },

  /**
   * Validate date range
   */
  dateRange: (startDate: string, endDate: string): string[] => {
    const errors: string[] = [];

    if (!startDate) {
      errors.push("Start date is required");
    }

    if (!endDate) {
      errors.push("End date is required");
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime())) {
        errors.push("Start date is invalid");
      }

      if (isNaN(end.getTime())) {
        errors.push("End date is invalid");
      }

      if (start > end) {
        errors.push("End date must be after start date");
      }
    }

    return errors;
  },
};

/**
 * Validate entire bundle form
 */
export function validateBundleForm(
  name: string,
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
  startDate: string,
  endDate: string,
): string[] {
  const errors: string[] = [];

  // Validate each field
  errors.push(...validators.name(name));
  errors.push(...validators.items(items));
  errors.push(...validators.discount(discountType, discountValue));
  errors.push(...validators.dateRange(startDate, endDate));

  return errors;
}

/**
 * Validate bundle form and return structured result
 */
export function validateBundleFormWithResult(
  name: string,
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
  startDate: string,
  endDate: string,
): ValidationResult {
  const errors = validateBundleForm(
    name,
    items,
    discountType,
    discountValue,
    startDate,
    endDate,
  );

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate individual field (useful for real-time validation)
 */
export function validateField(
  fieldName: "name" | "items" | "discount" | "dateRange",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
): string[] {
  switch (fieldName) {
    case "name":
      return validators.name(args[0]);
    case "items":
      return validators.items(args[0]);
    case "discount":
      return validators.discount(args[0], args[1]);
    case "dateRange":
      return validators.dateRange(args[0], args[1]);
    default:
      return [];
  }
}
