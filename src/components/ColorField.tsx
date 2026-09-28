"use client";

import { useEffect, useState } from "react";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

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
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <TextField
        label={label}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        error={invalid}
        helperText={invalid ? "ต้องเป็นรหัสสี hex 6 หลัก เช่น #FFFFFF" : " "}
        size="small"
      />
      <input
        type="color"
        aria-label={`${label} (ตัวเลือกสี)`}
        value={HEX_COLOR.test(text) ? text : value}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: 40,
          height: 40,
          marginTop: 8,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
    </Stack>
  );
}
