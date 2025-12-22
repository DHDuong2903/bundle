import type { ProductItem, DiscountType } from "./bundle.types";

/**
 * Component Props types
 */

export interface BundleFormProps {
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
  onCancel?: () => void;
  onSubmitRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}
