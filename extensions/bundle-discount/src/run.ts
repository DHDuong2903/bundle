import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

type Line = RunInput["cart"]["lines"][number];

interface RelatedBundleInfo {
  bundleId: string;
  bundleName: string;
  discountValue: number;
  discountType: "percentage" | "fixed";
  active: boolean;
  items: { productId: string }[];
}

const EMPTY: FunctionRunResult = {
  discounts: [],
  discountApplicationStrategy: DiscountApplicationStrategy.All,
};

export function run(input: RunInput): FunctionRunResult {
  const lines = input.cart?.lines;
  if (!lines?.length) return EMPTY;

  const discounts: FunctionRunResult["discounts"] = [];
  const bundleCandidates = new Map<string, { info: RelatedBundleInfo, matchedLines: Line[] }>();

  for (const line of lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;

    const rawMeta = line.merchandise.product.metafield?.value;
    if (!rawMeta) continue;

    try {
      const relatedBundles: RelatedBundleInfo[] = JSON.parse(rawMeta);
      for (const b of relatedBundles) {
        if (!b.active) continue;

        if (!bundleCandidates.has(b.bundleId)) {
          bundleCandidates.set(b.bundleId, { info: b, matchedLines: [] });
        }
        
        const isPart = b.items.some(item => item.productId === line.merchandise.product.id);
        if (isPart) {
          const group = bundleCandidates.get(b.bundleId)!;
          if (!group.matchedLines.some(l => l.id === line.id)) {
            group.matchedLines.push(line);
          }
        }
      }
    } catch {
      continue;
    }
  }

  for (const { info, matchedLines } of bundleCandidates.values()) {
    // Chỉ áp dụng khi hội đủ số lượng sản phẩm trong combo
    if (matchedLines.length >= info.items.length) {
      for (const line of matchedLines) {
        const qty = line.quantity || 1;
        const value = info.discountType === "percentage" 
          ? { percentage: { value: info.discountValue } }
          : { fixedAmount: { amount: (info.discountValue * qty).toFixed(2) } };

        discounts.push({
          targets: [{ cartLine: { id: line.id } }],
          value,
          message: info.bundleName
        });
      }
    }
  }

  return {
    discounts,
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}
