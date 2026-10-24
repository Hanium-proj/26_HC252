"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "선택하세요",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const enabled = options.filter((item) => !item.disabled);
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      ref={root}
      className="custom-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => {
          setActive(
            Math.max(
              0,
              enabled.findIndex((o) => o.value === value),
            ),
          );
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(
              Math.max(
                0,
                enabled.findIndex((o) => o.value === value),
              ),
            );
            setOpen(true);
          }
        }}
      >
        <span className="truncate">
          {options.find((o) => o.value === value)?.label ?? placeholder}
        </span>
        <span
          className={`select-chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          tabIndex={0}
          role="listbox"
          aria-label={label}
          aria-activedescendant={
            enabled[active] ? `${id}-${active}` : undefined
          }
          className="select-menu"
          onKeyDown={(event) => {
            if (
              [
                "ArrowDown",
                "ArrowUp",
                "Home",
                "End",
                "Enter",
                " ",
                "Escape",
              ].includes(event.key)
            )
              event.preventDefault();
            if (event.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
            if (event.key === "ArrowDown")
              setActive((n) => Math.min(enabled.length - 1, n + 1));
            if (event.key === "ArrowUp") setActive((n) => Math.max(0, n - 1));
            if (event.key === "Home") setActive(0);
            if (event.key === "End") setActive(enabled.length - 1);
            if ((event.key === "Enter" || event.key === " ") && enabled[active])
              choose(enabled[active].value);
            if (event.key.length === 1 && event.key !== " ") {
              const next = enabled.findIndex((o) =>
                o.label.toLowerCase().startsWith(event.key.toLowerCase()),
              );
              if (next >= 0) setActive(next);
            }
          }}
        >
          {enabled.length ? (
            enabled.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={value === option.value}
                className={`select-option ${active === index ? "is-active" : ""}`}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {value === option.value && <span aria-hidden="true">✓</span>}
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-ink-2">
              선택 가능한 항목이 없습니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="toggle-row"
    >
      <span>{label}</span>
      <span
        className={`toggle-track ${checked ? "is-on" : ""}`}
        aria-hidden="true"
      >
        <span />
      </span>
    </button>
  );
}
export function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="disclosure">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span className={open ? "rotate-180" : ""} aria-hidden="true">
          ⌄
        </span>
      </button>
      <div
        id={id}
        className={`disclosure-body ${open ? "is-open" : ""}`}
        inert={!open}
      >
        <div>
          <div className="py-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </header>
  );
}
export function Loading({ label }: { label: string }) {
  return (
    <div className="loading-panel" role="status">
      <span className="loading-orbit" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>완료되면 결과가 여기에 표시됩니다.</p>
      </div>
    </div>
  );
}
