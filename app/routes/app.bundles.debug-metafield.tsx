import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Get all bundles from DB
  const bundles = await db.bundle.findMany({
    where: { shopDomain: session.shop },
    include: { items: true },
  });

  // For each bundle, fetch the Shopify product and its metafield
  const bundlesWithMetafields = await Promise.all(
    bundles.map(async (bundle) => {
      if (!bundle.bundleProductGid) {
        return {
          ...bundle,
          shopifyProduct: null,
          metafieldData: null,
          error: "No bundleProductGid",
        };
      }

      try {
        const response = await admin.graphql(
          `#graphql
          query GetProductMetafield($id: ID!) {
            product(id: $id) {
              id
              title
              status
              productType
              metafields(first: 10, namespace: "custom") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }`,
          {
            variables: { id: bundle.bundleProductGid },
          },
        );

        const data = await response.json();
        const product = data.data?.product;

        if (!product) {
          return {
            ...bundle,
            shopifyProduct: null,
            metafieldData: null,
            error: "Product not found in Shopify",
          };
        }

        const bundleDataMetafield = product.metafields.edges.find(
          (edge: any) => edge.node.key === "bundle_data",
        );

        return {
          ...bundle,
          shopifyProduct: {
            id: product.id,
            title: product.title,
            status: product.status,
            productType: product.productType,
          },
          metafieldData: bundleDataMetafield
            ? JSON.parse(bundleDataMetafield.node.value)
            : null,
          allMetafields: product.metafields.edges.map((edge: any) => edge.node),
          error: null,
        };
      } catch (error) {
        return {
          ...bundle,
          shopifyProduct: null,
          metafieldData: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  return { bundles: bundlesWithMetafields };
};

export default function DebugMetafield() {
  const { bundles } = useLoaderData<typeof loader>();

  return (
    <s-page>
      <s-section heading="Bundle Metafield Debug">
        <s-stack direction="block" gap="large">
          {bundles.map((bundle) => (
            <s-box
              key={bundle.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="base">
                <s-heading>Bundle: {bundle.name}</s-heading>

                <s-stack direction="block" gap="small">
                  <s-paragraph>
                    <strong>Bundle ID:</strong> {bundle.id}
                  </s-paragraph>
                  <s-paragraph>
                    <strong>Bundle Product GID:</strong>{" "}
                    {bundle.bundleProductGid || "NULL"}
                  </s-paragraph>
                  <s-paragraph>
                    <strong>Active:</strong> {bundle.active ? "Yes" : "No"}
                  </s-paragraph>
                </s-stack>

                {bundle.error && (
                  <s-banner tone="critical">
                    <s-paragraph>Error: {bundle.error}</s-paragraph>
                  </s-banner>
                )}

                {bundle.shopifyProduct && (
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-heading>Shopify Product Info</s-heading>
                      <s-paragraph>
                        <strong>ID:</strong> {bundle.shopifyProduct.id}
                      </s-paragraph>
                      <s-paragraph>
                        <strong>Title:</strong> {bundle.shopifyProduct.title}
                      </s-paragraph>
                      <s-paragraph>
                        <strong>Status:</strong> {bundle.shopifyProduct.status}
                      </s-paragraph>
                      <s-paragraph>
                        <strong>Product Type:</strong>{" "}
                        {bundle.shopifyProduct.productType}
                      </s-paragraph>
                    </s-stack>
                  </s-box>
                )}

                {bundle.allMetafields && bundle.allMetafields.length > 0 && (
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-heading>All Metafields</s-heading>
                      {bundle.allMetafields.map((metafield: any) => (
                        <s-box
                          key={metafield.id}
                          padding="small"
                          borderWidth="base"
                          borderRadius="base"
                        >
                          <s-stack direction="block" gap="x-small">
                            <s-paragraph>
                              <strong>
                                {metafield.namespace}.{metafield.key}
                              </strong>{" "}
                              ({metafield.type})
                            </s-paragraph>
                            <pre
                              style={{
                                fontSize: "12px",
                                overflow: "auto",
                                maxHeight: "200px",
                              }}
                            >
                              {metafield.value}
                            </pre>
                          </s-stack>
                        </s-box>
                      ))}
                    </s-stack>
                  </s-box>
                )}

                {bundle.metafieldData ? (
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-heading>Bundle Data Metafield (Parsed)</s-heading>
                      <pre
                        style={{
                          fontSize: "12px",
                          overflow: "auto",
                          maxHeight: "300px",
                        }}
                      >
                        {JSON.stringify(bundle.metafieldData, null, 2)}
                      </pre>
                    </s-stack>
                  </s-box>
                ) : (
                  <s-banner tone="warning">
                    <s-paragraph>
                      No bundle_data metafield found! This bundle won't display
                      on storefront.
                    </s-paragraph>
                  </s-banner>
                )}
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}
