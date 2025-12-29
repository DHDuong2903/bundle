import type { ProductItem, DiscountType } from "../types/bundle.types";

export function calculateTotal(items: ProductItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function calculateDiscount(
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
): number {
  const breakdown = distributeDiscounts(items, discountType, discountValue);
  return breakdown.totalDiscount;
}

export function calculateFinalPrice(
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
): number {
  const breakdown = distributeDiscounts(items, discountType, discountValue);
  return breakdown.finalPrice;
}

export function distributeDiscounts(
  items: ProductItem[],
  discountType: DiscountType,
  discountValue: string,
): {
  items: {
    id: string;
    price: number;
    discountAmount: number;
    finalPrice: number;
  }[];
  total: number;
  totalDiscount: number;
  finalPrice: number;
} {
  const total = calculateTotal(items);
  if (!discountValue || items.length === 0) {
    return {
      items: items.map((it) => ({
        id: it.id,
        price: it.price,
        discountAmount: 0,
        finalPrice: it.price,
      })),
      total,
      totalDiscount: 0,
      finalPrice: total,
    };
  }

  const value = parseFloat(discountValue);
  let totalDiscount = 0;
  const itemCount = items.length;

  if (discountType === "percentage") {
    totalDiscount = (total * value) / 100;

    // Distribute percentage discount proportionally based on item prices
    const distributed = items.map((item, index) => {
      let discountAmount = 0;
      if (index === itemCount - 1) {
        // Last item gets remaining discount to avoid rounding errors
        const allocated = items
          .slice(0, -1)
          .reduce((sum, prev) => sum + (prev.price / total) * totalDiscount, 0);
        discountAmount = Math.max(0, totalDiscount - allocated);
      } else {
        // Proportional discount: (item_price / total_price) * total_discount
        discountAmount = (item.price / total) * totalDiscount;
      }
      const rounded = Math.round(discountAmount * 100) / 100;
      return {
        id: item.id,
        price: item.price,
        discountAmount: rounded,
        finalPrice: Math.round((item.price - rounded) * 100) / 100,
      };
    });

    return {
      items: distributed,
      total,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalPrice: Math.round((total - totalDiscount) * 100) / 100,
    };
  }

  if (discountType === "fixed") {
    const perItemDiscount = value;
    totalDiscount = perItemDiscount * itemCount;

    const distributed = items.map((item) => {
      const discountAmount = perItemDiscount;
      const rounded = Math.round(discountAmount * 100) / 100;
      return {
        id: item.id,
        price: item.price,
        discountAmount: rounded,
        finalPrice: Math.max(0, Math.round((item.price - rounded) * 100) / 100),
      };
    });

    return {
      items: distributed,
      total,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalPrice: Math.max(0, Math.round((total - totalDiscount) * 100) / 100),
    };
  }

  return {
    items: items.map((it) => ({
      id: it.id,
      price: it.price,
      discountAmount: 0,
      finalPrice: it.price,
    })),
    total,
    totalDiscount: 0,
    finalPrice: total,
  };
}
