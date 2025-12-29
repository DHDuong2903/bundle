import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

type Line = RunInput["cart"]["lines"][number];

interface BundleGroup {
  bundleId: string;
  discountAmount: number;
  discountType: "fixed" | "percentage";
  lines: Line[];
}

const EMPTY: FunctionRunResult = {
  discounts: [],
  discountApplicationStrategy: DiscountApplicationStrategy.All,
};

export function run(input: RunInput): FunctionRunResult {
  if (!input.cart?.lines?.length) return EMPTY;

  const discounts: FunctionRunResult["discounts"] = [];
  const bundleGroups = new Map<string, BundleGroup>();

  // STEP 1: Gom line theo _bundle_id

  for (const line of input.cart.lines) {
    if (!isBundleLine(line)) continue;

    let bundleId =
      getAttribute(line, "_bundle_id") ?? getAttribute(line, "bundle_id");
    if (!bundleId) {
      const meta = getMerchBundleMeta(line);
      bundleId =
        getAttribute(line, "bundle_name") ??
        getAttribute(line, "_bundle_name") ??
        meta?.bundleId ??
        meta?.bundle_id ??
        meta?.bundleName ??
        meta?.bundle_name ??
        null;
    }
    if (!bundleId) continue;

    const perLineDiscountAmount = Number(
      getAttribute(line, "_bundle_discount_value") ?? 0,
    );
    const perLineDiscountType =
      getAttribute(line, "_bundle_discount_type") === "fixed"
        ? "fixed"
        : "percentage";

    if (!bundleGroups.has(bundleId)) {
      bundleGroups.set(bundleId, {
        bundleId,
        discountAmount: perLineDiscountAmount,
        discountType: perLineDiscountType,
        lines: [],
      });
    } else {
      const bg = bundleGroups.get(bundleId)!;
      if (bg.discountType === perLineDiscountType) {
        bg.discountAmount = Math.max(bg.discountAmount, perLineDiscountAmount);
      } else if (perLineDiscountType === "percentage") {
        bg.discountType = "percentage";
        bg.discountAmount = Math.max(bg.discountAmount, perLineDiscountAmount);
      }
    }

    bundleGroups.get(bundleId)!.lines.push(line);
  }

  // STEP 2: Áp discount

  for (const bundle of bundleGroups.values()) {
    if (bundle.discountAmount <= 0) continue;

    for (const line of bundle.lines) {
      let value;

      if (bundle.discountType === "percentage") {
        value = {
          percentage: {
            value: bundle.discountAmount,
          },
        };
      } else {
        const quantity = line.quantity ?? 1;
        const discountValue = bundle.discountAmount * quantity;

        if (discountValue <= 0) continue;

        value = {
          fixedAmount: {
            amount: discountValue.toFixed(2),
          },
        };
      }

      discounts.push({
        targets: [{ cartLine: { id: line.id } }],
        value,
      });
    }
  }

  return {
    discounts,
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}

/* ---------------- helpers ---------------- */

function isBundleLine(line: Line): boolean {
  // Check both underscored and plain properties set by Liquid (e.g., properties.is_bundle)
  const attr =
    getAttribute(line, "_is_bundle") ?? getAttribute(line, "is_bundle");
  if (attr === "true") return true;

  // Also accept bundle_name marker on item properties
  const bundleNameAttr =
    getAttribute(line, "bundle_name") ?? getAttribute(line, "_bundle_name");
  if (bundleNameAttr) return true;

  // Check if bundle_id attribute is present
  const bundleIdAttr =
    getAttribute(line, "bundle_id") ?? getAttribute(line, "_bundle_id");
  if (bundleIdAttr) return true;

  const meta = getMerchBundleMeta(line);
  return !!(
    meta &&
    (meta.bundleId || meta.bundle_id || meta.bundleName || meta.bundle_name)
  );
}

function getAttribute(line: Line, key: string): string | null {
  try {
    const asPlain = key.replace(/^_/, "");
    const camel = asPlain.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    const tryKeys = [key, asPlain, camel];
    for (const k of tryKeys) {
      const v = (line as any)[k];
      if (v != null) {
        if (typeof v === "object" && v.value != null) return String(v.value);
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        )
          return String(v);
      }
    }

    const attr = line.attribute?.(key)?.value ?? null;
    if (attr != null) return attr;

    // Check specific aliases from run.graphql
    if (key === "_bundle_name" || key === "bundle_name") {
      if ((line as any).bundleName?.value) return (line as any).bundleName.value;
    }
    if (key === "_bundle_discount_value" || key === "bundle_discount_value") {
      if ((line as any).bundleDiscountValue?.value) return (line as any).bundleDiscountValue.value;
    }
    if (key === "_bundle_discount_type" || key === "bundle_discount_type") {
      if ((line as any).bundleDiscountType?.value) return (line as any).bundleDiscountType.value;
    }

    const meta = getMerchBundleMeta(line);
    if (!meta) return null;

    switch (key) {
      case "_is_bundle":
      case "is_bundle":
        return meta.bundleId || meta.bundle_id ? "true" : null;
      case "_bundle_id":
      case "bundle_id":
        return meta.bundleId ?? meta.bundle_id ?? null;
      case "_bundle_name":
      case "bundle_name":
        return meta.bundleName ?? meta.bundle_name ?? null;
      case "_bundle_discount_value":
      case "bundle_discount_value":
        return meta.discountValue != null
          ? String(meta.discountValue)
          : meta.discount_value != null
            ? String(meta.discount_value)
            : null;
      case "_bundle_discount_type":
      case "bundle_discount_type":
        return meta.discountType ?? meta.discount_type ?? null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function getMerchBundleMeta(line: Line): any | null {
  try {
    const raw = (line as any).merchandise?.metafield?.value;
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}
