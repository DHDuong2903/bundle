import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

/**
 * Upload file to Shopify Files API and return CDN URL
 */
export async function uploadFileToShopify(
  admin: AdminApiContext,
  file: File,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log("[Upload] Starting upload for file:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[Upload] File converted to buffer, size:", buffer.length);

    // Step 1: Create staged upload
    console.log("[Upload] Step 1: Creating staged upload...");
    const stagedUploadResponse = await admin.graphql(
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
              resource: "IMAGE",
              filename: file.name,
              mimeType: file.type,
              httpMethod: "POST",
            },
          ],
        },
      },
    );

    const stagedData = await stagedUploadResponse.json();
    console.log(
      "[Upload] Staged upload response:",
      JSON.stringify(stagedData, null, 2),
    );

    if (
      stagedData.data?.stagedUploadsCreate?.userErrors?.length > 0 ||
      !stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0]
    ) {
      const error =
        stagedData.data?.stagedUploadsCreate?.userErrors?.[0]?.message ||
        "Failed to create staged upload";
      console.error("[Upload] ❌ Staged upload failed:", error);
      return {
        success: false,
        error,
      };
    }

    const stagedTarget = stagedData.data.stagedUploadsCreate.stagedTargets[0];
    console.log(
      "[Upload] ✅ Staged upload created, target URL:",
      stagedTarget.url,
    );

    // Step 2: Upload file to staged URL
    console.log("[Upload] Step 2: Uploading file to S3...");
    const formData = new FormData();

    // Add parameters from staged upload
    stagedTarget.parameters.forEach(
      (param: { name: string; value: string }) => {
        formData.append(param.name, param.value);
      },
    );

    // Add file as blob
    const blob = new Blob([buffer], { type: file.type });
    formData.append("file", blob, file.name);

    const uploadResponse = await fetch(stagedTarget.url, {
      method: "POST",
      body: formData,
    });

    console.log("[Upload] S3 upload response:", {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok,
    });

    if (!uploadResponse.ok) {
      const error = `Upload failed: ${uploadResponse.statusText}`;
      console.error("[Upload] ❌ S3 upload failed:", error);
      return {
        success: false,
        error,
      };
    }

    console.log("[Upload] ✅ File uploaded to S3");

    // Step 3: Create file in Shopify
    console.log(
      "[Upload] Step 3: Creating file in Shopify with resourceUrl:",
      stagedTarget.resourceUrl,
    );
    const createFileResponse = await admin.graphql(
      `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on MediaImage {
              id
              image {
                url
              }
              alt
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
          files: [
            {
              alt: file.name,
              contentType: "IMAGE",
              originalSource: stagedTarget.resourceUrl,
            },
          ],
        },
      },
    );

    const createData = await createFileResponse.json();
    console.log(
      "[Upload] File create response:",
      JSON.stringify(createData, null, 2),
    );

    if (
      createData.data?.fileCreate?.userErrors?.length > 0 ||
      !createData.data?.fileCreate?.files?.[0]
    ) {
      const error =
        createData.data?.fileCreate?.userErrors?.[0]?.message ||
        "Failed to create file";
      console.error("[Upload] ❌ File creation failed:", error);
      return {
        success: false,
        error,
      };
    }

    const fileData = createData.data.fileCreate.files[0];
    const fileUrl = fileData.url || fileData.image?.url;

    if (!fileUrl) {
      console.error("[Upload] ❌ No URL returned from file creation");
      return {
        success: false,
        error: "No URL returned from file creation",
      };
    }

    console.log("[Upload] ✅✅✅ Upload complete! CDN URL:", fileUrl);
    return {
      success: true,
      url: fileUrl,
    };
  } catch (error) {
    console.error("[Upload] ❌ Exception during upload:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
