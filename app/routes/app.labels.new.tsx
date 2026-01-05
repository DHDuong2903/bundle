import { useEffect, useRef, useCallback, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigate, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { LabelForm } from "../components/labels/LabelForm";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = await request.json();

  try {
    await db.label.create({
      data: {
        ...data,
        shopDomain: session.shop,
      },
    });
    return redirect("/app/labels");
  } catch (error) {
    console.error("Error creating label:", error);
    return { error: "Failed to create label" };
  }
};

export default function NewLabel() {
  const actionData = useActionData<typeof action>() as any;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";
  
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const saveButtonRef = useRef<any>(null);
  const discardButtonRef = useRef<any>(null);

  // Show toast on success (handled after redirect)
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
    // Toast will be shown by the listing page after redirect, or we can use a clever trick:
    // Because we are redirecting, we'll store a flag in session or just show it here if we don't redirect
  };

  // Logic to show toast after redirect can be complex in Remix, 
  // but since we are redirecting to /app/labels, I'll add the toast there.

  return (
    <s-page heading="Create Bundle Label" back-action="/app/labels">
      <s-button
        ref={saveButtonRef}
        slot="primary-action"
        variant="primary"
        disabled={isSubmitting ? true : undefined}
      >
        {isSubmitting ? "Creating..." : "Create Label"}
      </s-button>
      <s-button
        ref={discardButtonRef}
        slot="secondary-actions"
        disabled={isSubmitting ? true : undefined}
      >
        Discard
      </s-button>

      <LabelForm onSubmit={handleSubmit} onSubmitRef={submitRef} isSubmitting={isSubmitting} />
    </s-page>
  );
}