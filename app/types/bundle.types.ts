export interface ProductItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  sku: string;
  variant: string;
  price: number;
  image?: string;
}

export type DiscountType = "percentage" | "fixed";

export interface BundleFormData {
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  active: boolean;
  startDate: string;
  endDate: string;
  items: ProductItem[];
}

export interface BundleData {
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
