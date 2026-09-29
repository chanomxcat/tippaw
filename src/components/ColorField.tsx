"use client";

import { useEffect, useId, useState } from "react";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

/**
 * A hex-color text field paired with a native `<input type="color">`
 * swatch, kept in sync with each other. Typing an invalid hex value shows an
 * error and does not call `onChange` — the parent's value is only updated
 * once the text is a valid `#RRGGBB` color.
 */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const errorId = useId();
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const invalid = !HEX_COLOR.test(text);

  function handleChange(next: string) {
    setText(next);
    if (HEX_COLOR.test(next)) onChange(next);
  }

  return (
    <div className="flex items-start gap-3">
      <label className="flex flex-col gap-1">
        <span>{label}</span>
        <input
          type="text"
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={errorId}
          className={`input input-sm ${invalid ? "input-error" : ""}`}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
        />
        <span id={errorId} className={`text-xs ${invalid ? "text-error" : "text-transparent"}`}>
          ต้องเป็นรหัสสี hex 6 หลัก เช่น #FFFFFF
        </span>
      </label>
      <input
        type="color"
        aria-label={`${label} (ตัวเลือกสี)`}
        className="mt-6 h-10 w-10 cursor-pointer border-0 bg-transparent p-0"
        value={HEX_COLOR.test(text) ? text : value}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
