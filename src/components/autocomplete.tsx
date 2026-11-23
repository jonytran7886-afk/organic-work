"use client";
import { useId, useState } from "react";
type Option = { value: string; label: string };
export default function Autocomplete({
  name,
  label: accessibleLabel,
  options,
  value,
  defaultValue = "",
  onChange,
  disabled = false,
}: {
  name: string;
  label: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = value ?? selected;
  const label = options.find((o) => o.value === current)?.label || "";
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLocaleLowerCase("vi");
  const filtered = options.filter((o) =>
    normalize(o.label).includes(normalize(query ?? "")),
  );
  function choose(option: Option) {
    setSelected(option.value);
    onChange?.(option.value);
    setQuery(null);
    setOpen(false);
  }
  return (
    <div
      className="autocomplete"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setQuery(null);
        }
      }}
    >
      <input type="hidden" name={name} value={current} disabled={disabled} />
      <input
        aria-label={accessibleLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={
          open && filtered[active] ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        value={query ?? label}
        placeholder="Gõ để tìm kiếm…"
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  i + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (filtered[active]) choose(filtered[active]);
          }
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setQuery(null);
          }
        }}
      />
      {open && (
        <div id={id} role="listbox" className="autocomplete-options">
          {filtered.length ? (
            filtered.map((o, i) => (
              <div
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === current}
                className={i === active ? "active" : ""}
                key={o.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                {o.label}
              </div>
            ))
          ) : (
            <div className="hint">Không có kết quả</div>
          )}
        </div>
      )}
    </div>
  );
}
