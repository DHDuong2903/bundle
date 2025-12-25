import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    if (action === "create_metafield_definitions") {
      // Check if metafield definition already exists
      const checkResponse = await admin.graphql(
        `#graphql
        query CheckMetafieldDefinition {
          metafieldDefinitions(first: 1, ownerType: PRODUCT, namespace: "custom", key: "bundle_data") {
            edges {
              node {
                id
                name
                namespace
                key
                type {
                  name
                }
              }
            }
          }
        }`,
      );

      const checkData = await checkResponse.json();
      const existingDefinition =
        checkData.data?.metafieldDefinitions?.edges?.[0]?.node;

      if (existingDefinition) {
        return {
          success: true,
          message: "Metafield definition already exists! You're all set.",
          data: existingDefinition,
          alreadyExists: true,
        };
      }

      // Tạo metafield definition mới
      const createResponse = await admin.graphql(
        `#graphql
        mutation CreateBundleMetafieldDefinition {
          metafieldDefinitionCreate(
            definition: {
              name: "Bundle Data"
              namespace: "custom"
              key: "bundle_data"
              description: "Bundle information including items, pricing, and discount details"
              type: "json"
              ownerType: PRODUCT
              validations: []
            }
          ) {
            createdDefinition {
              id
              name
              namespace
              key
              description
              type {
                name
              }
            }
            userErrors {
              field
              message
              code
            }
          }
        }`,
      );

      const createData = await createResponse.json();

      if (
        createData.errors ||
        createData.data?.metafieldDefinitionCreate?.userErrors?.length > 0
      ) {
        return {
          success: false,
          error:
            createData.errors?.[0]?.message ||
            createData.data?.metafieldDefinitionCreate?.userErrors?.[0]
              ?.message ||
            "Failed to create metafield definition",
        };
      }

      return {
        success: true,
        message:
          "Metafield definition created successfully! Note: You may need to manually enable Storefront API access in Shopify Admin > Settings > Custom Data if needed.",
        data: createData.data?.metafieldDefinitionCreate?.createdDefinition,
      };
    }

    return { success: false, error: "Invalid action" };
  } catch (error) {
    console.error("Error in setup-metafields action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export default function SetupMetafields() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const handleCreateMetafields = () => {
    const formData = new FormData();
    formData.append("action", "create_metafield_definitions");
    submit(formData, { method: "post" });
  };

  return (
    <s-page>
      <s-section heading="Setup Storefront Metafields">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Để hiển thị bundles trên storefront, bạn cần tạo metafield
            definitions. Metafields cho phép lưu trữ bundle data và expose ra
            Storefront API.
          </s-paragraph>

          <s-button onClick={handleCreateMetafields}>
            Create Metafield Definitions
          </s-button>

          {actionData?.success && (
            <s-banner tone={actionData.alreadyExists ? "info" : "success"}>
              <s-paragraph>{actionData.message}</s-paragraph>
            </s-banner>
          )}

          {actionData?.error && (
            <s-banner tone="critical">
              <s-paragraph>Error: {actionData.error}</s-paragraph>
            </s-banner>
          )}

          {actionData?.data && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-heading>Result:</s-heading>
                <pre>{JSON.stringify(actionData.data, null, 2)}</pre>
              </s-stack>
            </s-box>
          )}

          <s-divider />

          <s-stack direction="block" gap="small">
            <s-heading>Bước tiếp theo:</s-heading>
            <s-ordered-list>
              <s-list-item>
                Tạo metafield definitions (click button bên trên)
              </s-list-item>
              <s-list-item>
                Cập nhật code để lưu bundle data vào metafields khi tạo/sửa
                bundle
              </s-list-item>
              <s-list-item>Tạo Theme Extension để hiển thị bundles</s-list-item>
              <s-list-item>Test trên storefront</s-list-item>
            </s-ordered-list>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
