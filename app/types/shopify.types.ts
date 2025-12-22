/**
 * Shopify Resource Picker types
 * Used when selecting products via Shopify's resource picker
 */

export interface PickerImage {
  originalSrc?: string;
  url?: string;
  src?: string;
}

export interface PickerVariant {
  id?: string;
  sku?: string;
  title?: string;
  price?: string;
}

export interface PickerProduct {
  id: string;
  title?: string;
  variants?: PickerVariant[];
  images?: PickerImage[];
}
