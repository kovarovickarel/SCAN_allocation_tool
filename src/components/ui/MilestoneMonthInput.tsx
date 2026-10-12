import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onFocus" | "onBlur" | "onKeyDown"> & {
  value: number | string;
  onCommit: (value: string) => void;
};

// Keep incomplete numbers local; apply linked duration/milestone checks only after editing.
export function MilestoneMonthInput({ value, onCommit, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input {...props} value={draft ?? String(value)}
    onFocus={() => setDraft(String(value))}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => {
      if (draft !== null && draft !== String(value)) onCommit(draft);
      setDraft(null);
    }}
    onKeyDown={event => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.blur();
      }
    }} />;
}
