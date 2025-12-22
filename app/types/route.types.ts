import type { ProductItem } from "./bundle.types";

/**
 * Route Loader/Action types
 */

export interface BundleEditLoaderData {
  bundle: {
    id: string;
    name: string;
    description: string | null;
    discountType: string | null;
    discountValue: number | null;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
    items: ProductItem[];
  };
}

export interface BundleListData {
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
