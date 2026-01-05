import { useEffect, useRef, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { LabelForm } from "../components/labels/LabelForm";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const label = await db.label.findUnique({
    where: { id: params.labelId, shopDomain: session.shop },
  });
  if (!label) throw new Response("Not Found", { status: 404 });
  return { label };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = await request.json();

  try {
    await db.label.update({
      where: { id: params.labelId, shopDomain: session.shop },
      data,
    });
    return redirect("/app/labels?action=updated");
  } catch (error) {
    console.error("Error updating label:", error);
    return { error: "Failed to update label" };
  }
};

export default function EditLabel() {
  const { label } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const saveButtonRef = useRef<any>(null);
  const discardButtonRef = useRef<any>(null);

  useEffect(() => {
    if (actionData?.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const handleSave = useCallback(async () => {
    if (submitRef.current) {
      await submitRef.current();
    }
  }, []);

  const handleDiscard = useCallback(() => {
    navigate("/app/labels");
  }, [navigate]);

  useEffect(() => {
    const saveButton = saveButtonRef.current;
    const discardButton = discardButtonRef.current;

    if (saveButton) {
      saveButton.addEventListener("click", handleSave);
    }
    if (discardButton) {
      discardButton.addEventListener("click", handleDiscard);
    }

    return () => {
      if (saveButton) {
        saveButton.removeEventListener("click", handleSave);
      }
      if (discardButton) {
        discardButton.removeEventListener("click", handleDiscard);
      }
    };
  }, [handleSave, handleDiscard]);

  const handleSubmit = async (data: any) => {
    submit(data, { method: "post", encType: "application/json" });
  };

  return (
    <s-page heading="Edit Bundle Label" back-action="/app/labels">
      <s-button
        ref={saveButtonRef}
        slot="primary-action"
        variant="primary"
        disabled={isSubmitting ? true : undefined}
      >
        {isSubmitting ? "Saving..." : "Save Label"}
      </s-button>
      <s-button
        ref={discardButtonRef}
        slot="secondary-actions"
        disabled={isSubmitting ? true : undefined}
      >
        Discard
      </s-button>

      <LabelForm initialData={label} onSubmit={handleSubmit} onSubmitRef={submitRef} isSubmitting={isSubmitting} />
    </s-page>
  );
}