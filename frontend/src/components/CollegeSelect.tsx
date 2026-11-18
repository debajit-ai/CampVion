"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, Sparkles, X } from "lucide-react";
import { apiClient } from "../lib/api";
import { CollegeOption } from "../types/api";

const DEFAULT_COLLEGE = "Lovely Professional University";
const OTHER_SENTINEL = "__OTHER__";

const FALLBACK_COLLEGES: CollegeOption[] = [
  {
    name: "Lovely Professional University",
    short: "LPU",
    city: "Phagwara",
    state: "Punjab",
    category: "Private University",
    featured: true,
  },
];

let cachedColleges: CollegeOption[] | null = null;
let inflightLoad: Promise<CollegeOption[]> | null = null;

async function fetchCollegesOnce(): Promise<CollegeOption[]> {
  if (cachedColleges) return cachedColleges;
  if (!inflightLoad) {
    inflightLoad = apiClient
      .listColleges()
      .then((res) => {
        cachedColleges = res.items.length > 0 ? res.items : FALLBACK_COLLEGES;
        return cachedColleges;
      })
      .catch(() => FALLBACK_COLLEGES)
      .finally(() => {
        inflightLoad = null;
      });
  }
  return inflightLoad;
}

export interface CollegeSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  variant?: "auth" | "workspace";
  isDark?: boolean;
  placeholder?: string;
}

export function CollegeSelect({
  value,
  onChange,
  id,
  required = false,
  disabled = false,
  variant = "workspace",
  isDark = true,
  placeholder = "Search Indian colleges & universities (e.g., LPU, IIT, NIT)...",
}: CollegeSelectProps) {
  const autoId = useId();
  const inputId = id || `college-select-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [colleges, setColleges] = useState<CollegeOption[]>(
    () => cachedColleges || FALLBACK_COLLEGES
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedOther, setPickedOther] = useState(false);
  const [draftCustomText, setDraftCustomText] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchCollegesOnce().then((items) => {
      if (active) setColleges(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const existsInDirectory = useMemo(
    () =>
      Boolean(value?.trim()) &&
      colleges.some((c) => c.name.toLowerCase() === value.trim().toLowerCase()),
    [colleges, value]
  );

  const customMode =
    pickedOther || (Boolean(value?.trim()) && colleges.length > 1 && !existsInDirectory);
  const customText = draftCustomText !== null ? draftCustomText : !existsInDirectory ? value : "";

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colleges;
    const prefix: CollegeOption[] = [];
    const contains: CollegeOption[] = [];
    for (const c of colleges) {
      const hay = `${c.name} ${c.short || ""} ${c.city || ""} ${c.state || ""}`.toLowerCase();
      if (hay.includes(q)) {
        if (
          c.name.toLowerCase().startsWith(q) ||
          (c.short || "").toLowerCase().startsWith(q)
        ) {
          prefix.push(c);
        } else {
          contains.push(c);
        }
      }
    }
    return [...prefix, ...contains];
  }, [colleges, query]);

  const optionsWithOther = useMemo(
    () => [
      ...filtered.map((c) => ({ type: "college" as const, data: c })),
      { type: "other" as const, name: OTHER_SENTINEL },
    ],
    [filtered]
  );

  const selectOption = (index: number) => {
    const opt = optionsWithOther[index];
    if (!opt) return;
    if (opt.type === "other") {
      setPickedOther(true);
      setDraftCustomText((prev) => prev ?? (existsInDirectory ? "" : value));
      if (existsInDirectory) onChange("");
      setOpen(false);
      setQuery("");
      return;
    }
    setPickedOther(false);
    setDraftCustomText("");
    onChange(opt.data.name);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setActiveIndex(0);
      e.preventDefault();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, optionsWithOther.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(optionsWithOther.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectOption(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-idx="${activeIndex}"]`
    ) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const isAuth = variant === "auth";
  const triggerClass = isAuth
    ? `w-full pl-10 pr-9 py-2.5 rounded-2xl border text-xs font-medium text-left transition flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 ${
        isDark
          ? "bg-white/[0.04] border-white/10 text-[#F5F7FF] focus:bg-[#0B1020] focus:border-[#38BDF8] focus:ring-[#38BDF8]/15"
          : "bg-slate-50/90 border-slate-200 text-[#0F172A] focus:bg-white focus:border-[#0E7490] focus:ring-[#0E7490]/15"
      }`
    : "w-full pl-9 pr-8 py-2 rounded-xl bg-cv-inset border border-cv-line text-xs font-medium text-cv-fg text-left flex items-center justify-between cursor-pointer focus:outline-none focus:border-cv-accent-line";

  const panelClass = isAuth
    ? `absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border shadow-2xl overflow-hidden ${
        isDark
          ? "bg-[#0B1020] border-white/15 text-[#F5F7FF]"
          : "bg-white border-slate-200 text-slate-900"
      }`
    : "absolute z-50 left-0 right-0 mt-1.5 rounded-xl bg-cv-surface border border-cv-line shadow-2xl overflow-hidden text-cv-fg";

  const subInputClass = isAuth
    ? `w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 ${
        isDark
          ? "bg-white/[0.04] border-white/10 text-[#F5F7FF] placeholder-[#8B95B0] focus:border-[#38BDF8] focus:ring-[#38BDF8]/20"
          : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0E7490] focus:ring-[#0E7490]/20"
      }`
    : "w-full px-3 py-1.5 rounded-lg bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line";

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Building2
          className={`h-4 w-4 pointer-events-none absolute ${
            isAuth ? "left-3.5 text-[#38BDF8]" : "left-3 text-cv-accent-ink"
          } top-1/2 -translate-y-1/2`}
        />
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-required={required}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => {
              const next = !prev;
              if (next) {
                setActiveIndex(0);
                setTimeout(() => searchInputRef.current?.focus(), 10);
              }
              return next;
            });
          }}
          className={`${triggerClass} disabled:opacity-60`}
        >
          <span className="truncate">
            {customMode
              ? customText.trim()
                ? `Other: ${customText.trim()}`
                : "Other (type your college name)"
              : value || DEFAULT_COLLEGE}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            } ${isAuth ? (isDark ? "text-[#8B95B0]" : "text-slate-400") : "text-cv-fg-3"}`}
          />
        </button>

        {open && (
          <div className={panelClass}>
            {/* Search Input */}
            <div
              className={`p-2 border-b ${
                isAuth
                  ? isDark
                    ? "border-white/10"
                    : "border-slate-200"
                  : "border-cv-line"
              }`}
            >
              <div className="relative flex items-center">
                <Search
                  className={`h-3.5 w-3.5 absolute left-2.5 pointer-events-none ${
                    isAuth ? (isDark ? "text-[#8B95B0]" : "text-slate-400") : "text-cv-fg-3"
                  }`}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  aria-label="Filter colleges"
                  aria-activedescendant={`${listboxId}-opt-${activeIndex}`}
                  className={`${subInputClass} pl-8 pr-7`}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveIndex(0);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 opacity-60 hover:opacity-100 cursor-pointer"
                    aria-label="Clear filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Options List */}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              className="max-h-60 overflow-y-auto p-1 space-y-0.5"
            >
              {optionsWithOther.map((opt, idx) => {
                const isActive = idx === activeIndex;
                if (opt.type === "other") {
                  return (
                    <button
                      key="__other__"
                      id={`${listboxId}-opt-${idx}`}
                      data-idx={idx}
                      type="button"
                      role="option"
                      aria-selected={customMode}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectOption(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        isActive
                          ? isAuth
                            ? isDark
                              ? "bg-[#6366F1]/25 text-white"
                              : "bg-sky-50 text-slate-900"
                            : "bg-cv-accent-soft text-cv-accent-ink"
                          : isAuth
                          ? isDark
                            ? "text-[#A5B4FC] hover:bg-white/[0.06]"
                            : "text-cyan-700 hover:bg-slate-50"
                          : "text-cv-accent-ink hover:bg-cv-inset"
                      }`}
                    >
                      <span className="font-semibold">Other (type your college name)</span>
                      {customMode && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                }

                const col = opt.data;
                const isSelected = !customMode && value === col.name;
                return (
                  <button
                    key={col.name}
                    id={`${listboxId}-opt-${idx}`}
                    data-idx={idx}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectOption(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                      isActive
                        ? isAuth
                          ? isDark
                            ? "bg-white/10 text-white"
                            : "bg-slate-100 text-slate-900"
                          : "bg-cv-raised text-cv-fg"
                        : isAuth
                        ? isDark
                          ? "text-[#E2E8F0] hover:bg-white/[0.05]"
                          : "text-slate-700 hover:bg-slate-50"
                        : "text-cv-fg hover:bg-cv-inset"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{col.name}</span>
                        {col.featured && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                            <Sparkles className="h-2.5 w-2.5" />
                            Default
                          </span>
                        )}
                      </div>
                      {(col.short || col.city || col.state) && (
                        <div
                          className={`text-[10px] truncate ${
                            isAuth
                              ? isDark
                                ? "text-[#8B95B0]"
                                : "text-slate-400"
                              : "text-cv-fg-3"
                          }`}
                        >
                          {[col.short, col.city, col.state].filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-cv-accent-ink shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom 'Other' free-text input */}
      {customMode && (
        <div className="space-y-1">
          <input
            type="text"
            maxLength={120}
            required={required}
            disabled={disabled}
            value={customText}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/[<>]/g, "");
              setDraftCustomText(sanitized);
              onChange(sanitized.trim().slice(0, 120));
            }}
            placeholder="Enter your college or university full name (max 120 chars)"
            className={subInputClass}
          />
          <p
            className={`text-[10px] ${
              isAuth ? (isDark ? "text-[#8B95B0]" : "text-slate-500") : "text-cv-fg-3"
            }`}
          >
            Enter official institution name as shown on your student ID card.
          </p>
        </div>
      )}
    </div>
  );
}
