import { useState, useMemo, useCallback, useEffect } from "react";
import type { Label } from "@prisma/client";
import React from "react";
import { ICONS, BUNDLE_ICONS } from "../../constants/iconConst";
import { POSITIONS, SHAPES } from "../../constants/labelConstants";

interface LabelFormProps {
  initialData?: Partial<Label>;
  onSubmit: (data: any) => Promise<void>;
  onSubmitRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  isSubmitting?: boolean;
}

export function LabelForm({
  initialData,
  onSubmit,
  onSubmitRef,
  isSubmitting,
}: LabelFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [priority, setPriority] = useState(initialData?.priority || 0);
  const [nameError, setNameError] = useState("");
  const [text, setText] = useState(initialData?.text || "BUNDLE SAVE");
  const [textError, setTextError] = useState("");
  const [icon, setIcon] = useState(initialData?.icon || "");
  const [bgColor, setBgColor] = useState(initialData?.bgColor || "#000000");
  const [textColor, setTextColor] = useState(
    initialData?.textColor || "#ffffff",
  );
  const [position, setPosition] = useState(initialData?.position || "top-left");
  const [shape, setShape] = useState(initialData?.shape || "rounded");
  const [showOnPDP, setShowOnPDP] = useState(initialData?.showOnPDP ?? true);
  const [showOnCollection, setShowOnCollection] = useState(
    initialData?.showOnCollection ?? true,
  );

  const validateName = (val: string) => {
    if (!val.trim()) return "Label name is required";
    return "";
  };

  const validateText = (val: string) => {
    if (!val.trim()) return "Label text is required";
    if (val.length > 30) return "Label text must be 30 characters or less";
    return "";
  };

  const handleSubmitForm = useCallback(async () => {
    const nameErr = validateName(name);
    const textErr = validateText(text);

    if (nameErr || textErr) {
      setNameError(nameErr);
      setTextError(textErr);
      return;
    }

    await onSubmit({
      name,
      priority,
      text,
      icon,
      bgColor,
      textColor,
      position,
      shape,
      showOnPDP,
      showOnCollection,
    });
  }, [
    name,
    priority,
    text,
    icon,
    bgColor,
    textColor,
    position,
    shape,
    showOnPDP,
    showOnCollection,
    onSubmit,
  ]);

  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmitForm;
    }
  }, [handleSubmitForm, onSubmitRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitForm();
  };

  const labelStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: "absolute",
      backgroundColor: bgColor,
      color: textColor,
      padding: shape === "pill" ? "4px 12px" : "4px 8px",
      fontSize: "12px",
      fontWeight: "bold",
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: "4px",
      textTransform: "uppercase",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    };

    if (shape === "rounded") styles.borderRadius = "4px";
    if (shape === "pill") styles.borderRadius = "20px";
    if (shape === "square") styles.borderRadius = "0";
    if (position === "top-left") {
      styles.top = "10px";
      styles.left = "10px";
    }
    if (position === "top-right") {
      styles.top = "10px";
      styles.right = "10px";
    }
    if (position === "bottom-left") {
      styles.bottom = "10px";
      styles.left = "10px";
    }
    if (position === "bottom-right") {
      styles.bottom = "10px";
      styles.right = "10px";
    }
    return styles;
  }, [bgColor, textColor, position, shape]);

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}
      >
        {/* Left Column: Settings */}

        <s-stack gap="large">
          <s-section>
            <s-stack gap="base">
              <s-heading>General Info</s-heading>

              <s-text-field
                label="Label Name (Internal)"
                value={name}
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  setName(val);
                  setNameError(validateName(val));
                }}
                placeholder="e.g., Summer Deal Label"
                required
                error={nameError}
              />

              <s-text-field
                label="Priority"
                type="number"
                value={priority.toString()}
                onInput={(e) => setPriority(parseInt((e.target as HTMLInputElement).value) || 0)}
                helpText="Higher number means higher priority. Used when multiple labels apply."
              />
            </s-stack>
          </s-section>

          <s-section>
            <s-stack gap="base">
              <s-heading>Label Content</s-heading>

              <s-text-field
                label="Label Text"
                value={text}
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  setText(val);
                  setTextError(validateText(val));
                }}
                placeholder="e.g., SAVE 20%"
                required
                error={textError}
              />

              <s-select
                label="Icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              >
                {ICONS.map((i) => (
                  <s-option key={i.value} value={i.value}>
                    {i.label}
                  </s-option>
                ))}
              </s-select>
            </s-stack>
          </s-section>

          <s-section>
            <s-stack gap="base">
              <s-heading>Appearance</s-heading>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <s-color-field
                  label="Background Color"
                  value={bgColor}
                  onInput={(e) =>
                    setBgColor((e.target as HTMLInputElement).value)
                  }
                />
                <s-color-field
                  label="Text Color"
                  value={textColor}
                  onInput={(e) =>
                    setTextColor((e.target as HTMLInputElement).value)
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <s-select
                  label="Position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  {POSITIONS.map((p) => (
                    <s-option key={p.value} value={p.value}>
                      {p.label}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="Shape"
                  value={shape}
                  onChange={(e) => setShape(e.target.value)}
                >
                  {SHAPES.map((s) => (
                    <s-option key={s.value} value={s.value}>
                      {s.label}
                    </s-option>
                  ))}
                </s-select>
              </div>
            </s-stack>
          </s-section>

          <s-section>
            <s-stack gap="base">
              <s-heading>Visibility Rules</s-heading>
              <s-stack gap="small">
                <s-checkbox
                  label="Show on Product Pages"
                  checked={showOnPDP}
                  onChange={(e) =>
                    setShowOnPDP((e.target as HTMLInputElement).checked)
                  }
                />
                <s-checkbox
                  label="Show on Collection Pages"
                  checked={showOnCollection}
                  onChange={(e) =>
                    setShowOnCollection((e.target as HTMLInputElement).checked)
                  }
                />
              </s-stack>
            </s-stack>
          </s-section>
        </s-stack>

        {/* Right Column: Live Preview */}
        <div style={{ position: "sticky", top: "20px", alignSelf: "start" }}>
          <s-section>
            <s-stack gap="base">
              <s-heading>Live Preview</s-heading>
              <div
                style={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1/1",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <s-icon type="image" size="base" />

                  {/* The actual label preview */}
                  <div style={labelStyles}>
                    {icon && icon !== 'none' && (
                      <span 
                        style={{ display: 'flex', alignItems: 'center', width: '14px', height: '14px' }}
                        dangerouslySetInnerHTML={{ __html: BUNDLE_ICONS[icon as keyof typeof BUNDLE_ICONS]?.svg || '' }} 
                      />
                    )}
                    {text}
                  </div>
                </div>
                <div style={{ marginTop: "15px", textAlign: "left" }}>
                  <div
                    style={{
                      height: "10px",
                      width: "70%",
                      backgroundColor: "#e5e7eb",
                      borderRadius: "2px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <div
                    style={{
                      height: "10px",
                      width: "40%",
                      backgroundColor: "#e5e7eb",
                      borderRadius: "2px",
                    }}
                  ></div>
                </div>
              </div>
              <s-text tone="neutral">
                This is how your bundle label will appear on your store's
                collection page
              </s-text>
            </s-stack>
          </s-section>

          <button
            type="submit"
            id="label-form-submit"
            style={{ display: "none" }}
          ></button>
        </div>
      </div>
    </form>
  );
}
