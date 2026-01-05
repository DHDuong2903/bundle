import type { ProductItem, DiscountType } from "./bundle.types";

/**
 * Component Props types
 */

export interface BundleFormProps {

  initialData?: {

    name: string;

    description: string;

    image?: string;

    discountType: DiscountType;

    discountValue: string;

    active: boolean;

    startDate: string;

    endDate: string;

    items: ProductItem[];

    labelIds?: string[];

  };

  labels?: any[]; // Using any[] to allow full label objects for preview

  onSubmit: (data: {

    name: string;

    description: string;

    image?: string;

    imageFile?: File | null;

    discountType: DiscountType;

    discountValue: string;

    active: boolean;

    startDate: string;

    endDate: string;

    items: ProductItem[];

    labelIds: string[];

  }) => Promise<void>;

  onCancel?: () => void;

  onSubmitRef?: React.MutableRefObject<(() => Promise<void>) | null>;

}
