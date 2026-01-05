export interface ProductItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  sku: string;
  variant: string;
  price: number;
  image?: string;
  handle?: string;
}

export type DiscountType = "percentage" | "fixed";

export interface BundleFormData {
  name: string;
  description: string;
  image?: string;
  discountType: DiscountType;
  discountValue: string;
  active: boolean;
  startDate: string;
  endDate: string;
  items: ProductItem[];
  // Badge settings
  badgeText?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  badgePosition?: string;
}

export interface BundleData {
  id: string;
  name: string;
  description: string | null;
  image?: string | null;
  discountType: string | null;
  discountValue: number | null;
  active: boolean;
  itemCount: number;
  price: number;
  labelIds?: string[];
}
