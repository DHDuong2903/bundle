import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export async function uploadImageToShopify(
  admin: AdminApiContext,
  file: { name: string; type: string; size: number; buffer: Buffer }
) {
  // 1. Khởi tạo Staged Upload
  const stagedResponse = await admin.graphql(
    `#graphql
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: [
          {
            filename: file.name,
            mimeType: file.type,
            resource: "IMAGE",
            fileSize: file.size.toString(),
          },
        ],
      },
    }
  );

  const stagedData = await stagedResponse.json();
  const target = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];

  if (!target) {
    throw new Error("Failed to create staged upload target");
  }

  // 2. Upload file lên Google Cloud Storage của Shopify
  const formData = new FormData();
  target.parameters.forEach(({ name, value }: { name: string; value: string }) => {
    formData.append(name, value);
  });
  
  const blob = new Blob([file.buffer], { type: file.type });
  formData.append("file", blob, file.name);

  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload file to Shopify: ${errorText}`);
  }

  // Trả về resourceUrl để dùng cho mutation productCreateMedia
  return target.resourceUrl;
}

export async function addMediaToProduct(
  admin: AdminApiContext,
  productId: string,
  resourceUrl: string
) {
  const mediaResponse = await admin.graphql(
    `#graphql
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
          status
        }
        mediaUserErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        productId,
        media: [
          {
            originalSource: resourceUrl,
            mediaContentType: "IMAGE",
          },
        ],
      },
    }
  );

  const mediaData = await mediaResponse.json();
  return mediaData.data?.productCreateMedia;
}
