/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle preflight if necessary (though loaders typically handle GET)
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!shop) {
    return new Response(JSON.stringify({ error: "Shop parameter is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  // 1. Fetch active bundles with items and labels
  const now = new Date();
  
  const bundles = await db.bundle.findMany({
    where: {
      shopDomain: shop,
      active: true,
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } }
      ]
    },
    include: {
      items: {
        select: { productId: true, handle: true }
      },
      labels: {
        include: {
          label: true
        }
      }
    },
    orderBy: {
      priority: 'desc'
    }
  });

  // 2. Map products to labels with priority resolution
  const productLabelMap: Record<string, any[]> = {};

  for (const bundle of bundles) {
    if (!bundle.labels || bundle.labels.length === 0) continue;

    for (const item of bundle.items) {
      const key = item.handle;
      if (!key) continue;

      if (!productLabelMap[key]) {
        productLabelMap[key] = [];
      }

      for (const bundleLabel of bundle.labels) {
        const label = bundleLabel.label;
        productLabelMap[key].push({
          ...label,
          bundlePriority: bundle.priority,
          combinedPriority: bundle.priority + label.priority
        });
      }
    }
  }

  // 3. Finalize: Group by position and limit to 2 per position
  const finalMap: Record<string, any[]> = {};

  for (const [key, labels] of Object.entries(productLabelMap)) {
    // Sort all by combined priority first
    const sorted = labels.sort((a, b) => b.combinedPriority - a.combinedPriority);
    
    const uniqueByPosition: Record<string, any[]> = {};
    const seen = new Set();

    for (const l of sorted) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);

      const pos = l.position || 'top-left';
      if (!uniqueByPosition[pos]) {
        uniqueByPosition[pos] = [];
      }

      // Limit to 2 labels per specific position
      if (uniqueByPosition[pos].length < 2) {
        uniqueByPosition[pos].push({
          id: l.id,
          text: l.text,
          icon: l.icon,
          bgColor: l.bgColor,
          textColor: l.textColor,
          position: l.position,
          shape: l.shape,
          showOnPDP: l.showOnPDP,
          showOnCollection: l.showOnCollection,
        });
      }
    }

    // Flatten all positions back into a single array for the product
    finalMap[key] = Object.values(uniqueByPosition).flat();
  }

  return new Response(JSON.stringify({ products: finalMap }), {
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
};