import { CopyIcon } from "./icons";

export function WorkpackageDuplicateButton({ name, onDuplicate }: { name: string; onDuplicate?: () => void }) {
  if (!onDuplicate) return null;
  return <button type="button" draggable={false} data-workpackage-duplicate
    aria-label={`Duplicate ${name}`} title="Duplicate Workpackage"
    onClick={event => { event.stopPropagation(); onDuplicate(); }}
    className="inline-flex items-center justify-center p-0.5 text-gray-500 hover:text-gray-900 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shrink-0">
    <CopyIcon size={11} />
  </button>;
}
