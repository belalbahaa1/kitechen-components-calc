'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const CURRENCY = 'ج.م'; // غيّر رمز العملة حسب الحاجة

const EMPTY_STATE = {
  materials: [],
  accessories: [],
  unitTypes: [],
  levels: {
    lower: { key: 'lower', label: 'القطع السفلية', totalArea: 0, totalCost: 0, unitCount: 0 },
    upper: { key: 'upper', label: 'القطع العلوية', totalArea: 0, totalCost: 0, unitCount: 0 },
    third: { key: 'third', label: 'المستوى الثالث', totalArea: 0, totalCost: 0, unitCount: 0 },
  },
  totalMaterials: 0,
  totalUnits: 0,
  grandTotalArea: 0,
  materialsTotalCost: 0,
  accessoriesCost: 0,
  grandTotalCost: 0,
};
const INITIAL_MATERIAL_FORM = { name: '', pricePerMeter: '' };
const INITIAL_UNIT_FORM = {
  materialId: '',
  measurementUnit: 'cm',
  level: 'lower',
  type: 'standard',
  name: '',
  width: '',
  height: '90', // Default height for lower cabinets in cm (sticky)
  length: '',
};

// Default sensible heights per cabinet level
const DEFAULT_HEIGHTS = {
  lower: { cm: 90, m: 0.9 },
  upper: { cm: 80, m: 0.8 },
  third: { cm: 40, m: 0.4 },
};

// Standard height presets for quick selection chips
const STANDARD_HEIGHT_PRESETS = {
  cm: [90, 85, 80, 70, 60, 40],
  m: [0.9, 0.85, 0.8, 0.7, 0.6, 0.4],
};

const getDefaultHeight = (level = 'lower', unit = 'cm') => {
  return DEFAULT_HEIGHTS[level]?.[unit] ?? (unit === 'cm' ? 90 : 0.9);
};

// Badge colors per unit type (UI only – the math lives on the server)
const TYPE_STYLES = {
  standard: 'border-cream-100/15 bg-cream-50/10 text-cream-100',
  drawer: 'border-amber-400/25 bg-amber-950/50 text-amber-200',
  glass: 'border-sky-400/25 bg-sky-950/50 text-sky-200',
  tall: 'border-violet-400/25 bg-violet-950/50 text-violet-200',
  lshape: 'border-emerald-400/25 bg-emerald-950/50 text-emerald-200',
  side: 'border-rose-400/25 bg-rose-950/50 text-rose-200',
};

// Configuration and styling for vertical levels
const LEVEL_CONFIG = {
  lower: {
    key: 'lower',
    label: 'القطع السفلية',
    shortLabel: 'سفلية',
    subtitle: 'Base Cabinets',
    badge: 'border-sky-400/30 bg-sky-950/60 text-sky-200',
    dot: 'bg-sky-400',
    bar: 'bg-sky-500',
    accentText: 'text-sky-300',
    cardBorder: 'border-sky-500/20 hover:border-sky-400/40',
    cardGlow: 'from-sky-950/50 via-wood-950/40 to-black/40',
    iconBg: 'from-sky-700/60 to-blue-900/60',
  },
  upper: {
    key: 'upper',
    label: 'القطع العلوية',
    shortLabel: 'علوية',
    subtitle: 'Wall Cabinets',
    badge: 'border-amber-400/30 bg-amber-950/60 text-amber-200',
    dot: 'bg-amber-400',
    bar: 'bg-amber-500',
    accentText: 'text-amber-300',
    cardBorder: 'border-amber-500/20 hover:border-amber-400/40',
    cardGlow: 'from-amber-950/50 via-wood-950/40 to-black/40',
    iconBg: 'from-amber-700/60 to-wood-900/60',
  },
  third: {
    key: 'third',
    label: 'المستوى الثالث',
    shortLabel: 'مستوى ثالث',
    subtitle: 'Loft Cabinets',
    badge: 'border-purple-400/30 bg-purple-950/60 text-purple-200',
    dot: 'bg-purple-400',
    bar: 'bg-purple-500',
    accentText: 'text-purple-300',
    cardBorder: 'border-purple-500/20 hover:border-purple-400/40',
    cardGlow: 'from-purple-950/50 via-indigo-950/40 to-black/40',
    iconBg: 'from-purple-700/60 to-indigo-900/60',
  },
};

// Accent palette used to visually distinguish each material section
const MATERIAL_ACCENTS = [
  { dot: 'bg-amber-400', text: 'text-amber-200', bar: 'bg-amber-400/80', border: 'border-amber-400/20', icon: 'from-amber-700/60 to-wood-900/60' },
  { dot: 'bg-emerald-400', text: 'text-emerald-200', bar: 'bg-emerald-400/80', border: 'border-emerald-400/20', icon: 'from-emerald-700/60 to-wood-900/60' },
  { dot: 'bg-sky-400', text: 'text-sky-200', bar: 'bg-sky-400/80', border: 'border-sky-400/20', icon: 'from-sky-700/60 to-wood-900/60' },
  { dot: 'bg-violet-400', text: 'text-violet-200', bar: 'bg-violet-400/80', border: 'border-violet-400/20', icon: 'from-violet-700/60 to-wood-900/60' },
  { dot: 'bg-rose-400', text: 'text-rose-200', bar: 'bg-rose-400/80', border: 'border-rose-400/20', icon: 'from-rose-700/60 to-wood-900/60' },
  { dot: 'bg-teal-400', text: 'text-teal-200', bar: 'bg-teal-400/80', border: 'border-teal-400/20', icon: 'from-teal-700/60 to-wood-900/60' },
];
const accentFor = (index) => MATERIAL_ACCENTS[index % MATERIAL_ACCENTS.length];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (value, digits = 2) =>
  new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: digits }).format(
    Number(value) || 0
  );

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options,
    });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم. تأكد من تشغيل الخادم على المنفذ 5000.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع، حاول مرة أخرى.');
  return data;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG – no extra dependencies)
// ---------------------------------------------------------------------------
const ICONS = {
  plus: 'M12 4.5v15m7.5-7.5h-15',
  trash:
    'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  layers:
    'M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3',
  cube: 'm21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  chart: 'M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6ZM13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z',
  ruler:
    'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
  chevron: 'm19.5 8.25-7.5 7.5-7.5-7.5',
  info: 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
  alert: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  check: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  close: 'M6 18 18 6M6 6l12 12',
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  edit: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
};

function Icon({ name, className = 'h-5 w-5', children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children || <path d={ICONS[name]} />}
    </svg>
  );
}

function CalculatorIcon({ className }) {
  return (
    <Icon className={className}>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2.5" />
      <rect x="8" y="6" width="8" height="3" rx="0.75" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" strokeWidth={2.4} />
    </Icon>
  );
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small UI building blocks
// ---------------------------------------------------------------------------
// Matte glass surfaces (no saturation boost / no gloss):
//  - dark glass  → text-heavy panels
//  - light glass → featured / chrome elements
const GLASS_DARK =
  'border border-cream-100/10 bg-black/25 backdrop-blur-md shadow-xl shadow-black/30';
const GLASS_LIGHT =
  'border border-cream-100/15 bg-cream-50/[0.07] backdrop-blur-md shadow-xl shadow-black/30';

const INPUT_BASE =
  'w-full rounded-xl border border-cream-100/10 bg-black/30 px-4 py-3 text-cream-50 outline-none backdrop-blur-md transition placeholder:text-cream-50/40 hover:border-cream-100/20 focus:border-cream-100/30 focus:bg-black/40 focus:ring-4 focus:ring-cream-50/10 disabled:cursor-not-allowed disabled:opacity-60';

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-3xl p-6 text-cream-50 transition-shadow duration-300 hover:shadow-2xl hover:shadow-black/40 ${GLASS_DARK} ${className}`}
    >
      {children}
    </section>
  );
}

function CardHeader({ icon, title, subtitle, step, accent = 'from-wood-800/60 to-wood-950/60' }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cream-100/10 bg-gradient-to-br ${accent} text-cream-50/90 shadow-lg shadow-black/30 backdrop-blur-md`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <h2 className="text-lg font-bold text-cream-50">{title}</h2>
        {subtitle && <p className="text-sm text-cream-50/70">{subtitle}</p>}
      </div>
      {step && (
        <span className="rounded-full border border-cream-100/10 bg-cream-50/5 px-2.5 py-0.5 text-xs font-bold text-cream-50/60">
          {step}
        </span>
      )}
    </div>
  );
}

const Field = forwardRef(function Field({ id, label, suffix, hint, ...props }, ref) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-cream-50">
        {label}
      </label>
      <div className="relative">
        <input ref={ref} id={id} className={`${INPUT_BASE} ${suffix ? 'pl-16' : ''}`} {...props} />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-cream-50/60">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-cream-50/60">{hint}</p>}
    </div>
  );
});

function SelectField({ id, label, children, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-cream-50">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={`${INPUT_BASE} cursor-pointer appearance-none pl-10`} {...props}>
          {children}
        </select>
        <Icon
          name="chevron"
          className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-cream-50/60"
        />
      </div>
    </div>
  );
}

function PrimaryButton({
  loading,
  disabled,
  children,
  tone = 'bg-wood-700/70 hover:bg-wood-600/70', // muted matte fill – cream-50 text stays ≥ 7:1
  ...props
}) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cream-100/10 px-5 py-3 font-bold text-cream-50 shadow-xl shadow-black/30 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-cream-50/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${tone}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function DeleteButton({ loading, label, compact = false, ...props }) {
  return (
    <button
      type="button"
      disabled={loading}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-400/15 bg-rose-950/40 font-bold text-rose-200 backdrop-blur-md transition-all duration-200 hover:border-rose-400/30 hover:bg-rose-900/70 hover:text-cream-50 hover:shadow-lg hover:shadow-black/30 disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'h-8 w-8' : 'px-3 py-2 text-sm'
      }`}
      {...props}
    >
      {loading ? <Spinner /> : <Icon name="trash" className="h-4 w-4" />}
      {!compact && 'حذف'}
    </button>
  );
}

function TypeBadge({ type, label }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-lg border px-2 py-0.5 text-xs font-bold ${
        TYPE_STYLES[type] || TYPE_STYLES.standard
      }`}
    >
      {label}
    </span>
  );
}

function LevelIcon({ level, className = 'h-5 w-5' }) {
  if (level === 'lower') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="3" y="3" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
        <rect x="3" y="9.75" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
        <rect x="3" y="16.5" width="18" height="4.5" rx="1.2" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="18.75" r="0.75" fill="#1b120b" />
      </svg>
    );
  }
  if (level === 'upper') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="3" y="3" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
        <rect x="3" y="9.75" width="18" height="4.5" rx="1.2" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="0.75" fill="#1b120b" />
        <rect x="3" y="16.5" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="4.5" rx="1.2" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="5.25" r="0.75" fill="#1b120b" />
      <rect x="3" y="9.75" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
      <rect x="3" y="16.5" width="18" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
    </svg>
  );
}

function LevelBadge({ level, compact = false }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.lower;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-0.5 text-xs font-bold ${config.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span>{compact ? config.shortLabel : config.label}</span>
    </span>
  );
}

function Stat({ label, value, unit, id, highlight = '' }) {
  return (
    <div className="rounded-2xl border border-cream-100/10 bg-black/25 p-3 shadow-lg shadow-black/20 backdrop-blur-md transition hover:bg-black/35">
      <p className="text-xs text-cream-50/70">{label}</p>
      <p id={id} className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${highlight}`}>
        {value} <span className="text-xs font-medium text-cream-50/70">{unit}</span>
      </p>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cream-100/10 bg-black/10 py-12 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cream-100/10 bg-cream-50/5 text-cream-50/60 backdrop-blur-md">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="font-bold text-cream-50">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-cream-50/70">{subtitle}</p>}
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className={`animate-pulse rounded-3xl p-6 ${GLASS_DARK}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-cream-50/15" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/4 rounded bg-cream-50/20" />
              <div className="h-3 w-1/3 rounded bg-cream-50/10" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-16 rounded-2xl bg-cream-50/10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ isOpen, title, description, onConfirm, onCancel, loading }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={!loading ? onCancel : undefined}
      />
      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl shadow-black border border-cream-100/10 bg-wood-900/95 backdrop-blur-xl animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-950/50 border border-rose-500/20 text-rose-400">
            <Icon name="alert" className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-cream-50">{title}</h3>
        </div>
        <p className="mb-6 text-sm text-cream-50/70">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-cream-100/10 bg-cream-50/5 px-4 py-2.5 font-bold text-cream-50 transition hover:bg-cream-50/10 focus:outline-none disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600/80 px-4 py-2.5 font-bold text-cream-50 shadow-lg shadow-rose-900/20 transition hover:bg-rose-500/90 focus:outline-none disabled:opacity-50"
          >
            {loading ? <Spinner /> : 'حذف نهائي'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditButton({ loading, label, compact = false, ...props }) {
  return (
    <button
      type="button"
      disabled={loading}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky-400/15 bg-sky-950/40 font-bold text-sky-200 backdrop-blur-md transition-all duration-200 hover:border-sky-400/30 hover:bg-sky-900/70 hover:text-cream-50 hover:shadow-lg hover:shadow-black/30 disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'h-8 w-8' : 'px-3 py-2 text-sm'
      }`}
      {...props}
    >
      {loading ? <Spinner /> : <Icon name="edit" className="h-4 w-4" />}
      {!compact && 'تعديل'}
    </button>
  );
}

function EditUnitModal({ unit, isOpen, onClose, onSave, loading }) {
  const [form, setForm] = useState({ name: '', level: 'lower', width: '', height: '90', length: '', measurementUnit: 'cm' });

  useEffect(() => {
    if (unit) {
      setForm({
        name: unit.name || '',
        level: unit.level || 'lower',
        width: unit.width || '',
        height: unit.height || '',
        length: unit.length || '',
        measurementUnit: unit.measurementUnit || 'cm',
      });
    }
  }, [unit]);

  if (!isOpen || !unit) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const needsLength = unit.type === 'lshape';
  const unitLabel = form.measurementUnit === 'cm' ? 'سم' : 'م';
  const editDefaultH = getDefaultHeight(form.level, form.measurementUnit);
  const editPresets = STANDARD_HEIGHT_PRESETS[form.measurementUnit] || STANDARD_HEIGHT_PRESETS.cm;

  const handleEditUnitMeasurementChange = (newUnit) => {
    setForm((prev) => {
      if (prev.measurementUnit === newUnit) return prev;
      let newHeight = prev.height;
      if (prev.height && !isNaN(Number(prev.height))) {
        const num = Number(prev.height);
        if (newUnit === 'm' && prev.measurementUnit === 'cm') {
          newHeight = String(Math.round((num / 100) * 1000) / 1000);
        } else if (newUnit === 'cm' && prev.measurementUnit === 'm') {
          newHeight = String(Math.round(num * 100));
        }
      } else {
        newHeight = String(getDefaultHeight(prev.level, newUnit));
      }
      return { ...prev, measurementUnit: newUnit, height: newHeight };
    });
  };

  const handleEditLevelChange = (newLevel) => {
    setForm((prev) => ({
      ...prev,
      level: newLevel,
      height: String(getDefaultHeight(newLevel, prev.measurementUnit)),
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-black border border-cream-100/10 bg-wood-900/95 backdrop-blur-xl animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-950/50 border border-sky-500/20 text-sky-400">
              <Icon name="edit" className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-cream-50">تعديل أبعاد الوحدة</h3>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="text-cream-50/50 hover:text-cream-50 transition p-1">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          {/* Level Selector */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-cream-50">مستوى الوحدة</label>
            <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-black/20 border border-cream-100/5">
              {Object.values(LEVEL_CONFIG).map((lvl) => {
                const isSelected = form.level === lvl.key;
                return (
                  <button
                    key={lvl.key}
                    type="button"
                    onClick={() => handleEditLevelChange(lvl.key)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-bold transition ${
                      isSelected
                        ? `${lvl.badge} shadow ring-1 ring-cream-50/20`
                        : 'text-cream-50/60 hover:text-cream-50 hover:bg-cream-50/5'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? lvl.dot : 'bg-cream-50/30'}`} />
                      <span>{lvl.label}</span>
                    </div>
                    <span className="text-[9px] opacity-70 font-normal">{lvl.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-cream-50">وحدة القياس</label>
            <div className="flex gap-4 p-1 rounded-xl bg-black/20 border border-cream-100/5">
              <label className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold cursor-pointer rounded-lg transition ${form.measurementUnit === 'cm' ? 'bg-cream-50/10 text-cream-50 shadow' : 'text-cream-50/50 hover:text-cream-50/80'}`}>
                <input type="radio" name="edit_measurementUnit" value="cm" checked={form.measurementUnit === 'cm'} onChange={() => handleEditUnitMeasurementChange('cm')} className="hidden" />
                سنتيمتر (cm)
              </label>
              <label className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold cursor-pointer rounded-lg transition ${form.measurementUnit === 'm' ? 'bg-cream-50/10 text-cream-50 shadow' : 'text-cream-50/50 hover:text-cream-50/80'}`}>
                <input type="radio" name="edit_measurementUnit" value="m" checked={form.measurementUnit === 'm'} onChange={() => handleEditUnitMeasurementChange('m')} className="hidden" />
                متر (m)
              </label>
            </div>
          </div>
          
          <Field id="edit-unit-name" label="اسم الوحدة" type="text" value={form.name} onChange={update('name')} maxLength={60} />
          
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <Field id="edit-unit-width" label="العرض" type="number" inputMode="decimal" min="0" step="any" suffix={unitLabel} value={form.width} onChange={update('width')} required />
              <Field id="edit-unit-height" label="الارتفاع" type="number" inputMode="decimal" min="0" step="any" suffix={unitLabel} value={form.height} onChange={update('height')} required />
            </div>

            {/* Quick Height Chips & Default Indicator */}
            <div className="rounded-xl border border-cream-100/10 bg-black/25 p-2.5 text-xs">
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-cream-50/75">الارتفاع الافتراضي لهذا المستوى:</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, height: String(editDefaultH) }))}
                  className="font-bold text-amber-200 hover:text-amber-100 underline decoration-dotted"
                  title="انقر لتطبيق الارتفاع الافتراضي"
                >
                  {editDefaultH} {unitLabel}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-cream-100/5">
                <span className="text-[10px] text-cream-50/50 font-medium">خيارات سريعة:</span>
                {editPresets.map((hVal) => (
                  <button
                    key={hVal}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, height: String(hVal) }))}
                    className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums transition ${
                      String(form.height) === String(hVal)
                        ? 'bg-amber-400 text-wood-950 shadow ring-1 ring-amber-300'
                        : 'bg-black/30 border border-cream-100/10 text-cream-50/70 hover:text-cream-50 hover:bg-cream-50/10'
                    }`}
                  >
                    {hVal} {unitLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {needsLength && (
            <Field id="edit-unit-length" label="الطول (الضلع الثاني)" type="number" inputMode="decimal" min="0" step="any" suffix={unitLabel} value={form.length} onChange={update('length')} required />
          )}
          
          <div className="pt-2">
            <PrimaryButton type="submit" loading={loading} tone="bg-sky-600/80 hover:bg-sky-500/80">
              حفظ التعديلات
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccessoriesCard({ state, loading, onAdd, onDelete, deletingKey }) {
  const [form, setForm] = useState({ name: '', price: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onAdd(form.name, parseFloat(form.price));
    setSaving(false);
    setForm({ name: '', price: '' });
  };

  return (
    <Card>
      <CardHeader
        icon={<Icon name="plus" />}
        title="الإضافات الأخرى"
        subtitle="إدارة الإكسسوارات والمفصلات"
        accent="from-teal-700/60 to-wood-900/60"
      />
      
      <form onSubmit={handleSubmit} className="space-y-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="acc-name"
            label="اسم الإكسسوار"
            type="text"
            placeholder="مثال: مفصلات"
            value={form.name}
            onChange={(e) => setForm(p => ({...p, name: e.target.value}))}
            disabled={loading || saving}
            required
          />
          <Field
            id="acc-price"
            label="السعر"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="500"
            suffix={CURRENCY}
            value={form.price}
            onChange={(e) => setForm(p => ({...p, price: e.target.value}))}
            disabled={loading || saving}
            required
          />
        </div>
        <PrimaryButton type="submit" disabled={loading || saving} loading={saving} tone="bg-teal-700/70 hover:bg-teal-600/70">
          إضافة إكسسوار
        </PrimaryButton>
      </form>

      {state.accessories?.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-cream-100/10 pt-4">
          {state.accessories.map((acc) => (
            <li
              key={acc.id}
              className="animate-fade-in-up flex items-center gap-3 rounded-xl border border-cream-100/10 bg-black/15 px-3 py-2 transition hover:bg-cream-50/5"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-cream-50">{acc.name}</p>
                <p className="text-xs text-cream-50/60 tabular-nums">
                  {fmt(acc.price)} {CURRENCY}
                </p>
              </div>
              <DeleteButton
                compact
                id={`delete-acc-${acc.id}`}
                loading={deletingKey === `acc-${acc.id}`}
                label={`حذف ${acc.name}`}
                onClick={() => onDelete(acc)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Results: Grand total
// ---------------------------------------------------------------------------
function GrandTotalCard({ state, loading }) {
  const { materials, grandTotalCost, materialsTotalCost, accessoriesCost, grandTotalArea, totalUnits } = state;
  const hasCost = grandTotalCost > 0;

  return (
    <section className={`relative overflow-hidden rounded-3xl p-7 text-cream-50 ${GLASS_LIGHT}`}>
      {/* Very soft inner glow (kept subtle for a matte finish) */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-amber-200/[0.05] blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-2">
          <Icon name="chart" className="h-5 w-5 text-amber-200/90" />
          <p className="text-sm font-semibold text-cream-50 drop-shadow-sm">
            التكلفة الإجمالية للمطبخ
          </p>
        </div>

        <p className="mt-2 flex items-baseline gap-2">
          {loading ? (
            <span className="inline-block h-12 w-48 animate-pulse rounded-xl bg-cream-50/20" />
          ) : (
            <>
              <span
                id="grand-total-cost"
                className="text-4xl font-extrabold tracking-tight tabular-nums drop-shadow-md sm:text-5xl"
              >
                {fmt(grandTotalCost)}
              </span>
              <span className="text-lg font-semibold text-cream-50 drop-shadow-sm">{CURRENCY}</span>
            </>
          )}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat
            id="grand-total-area"
            label="إجمالي المساحة"
            value={loading ? '…' : fmt(grandTotalArea, 4)}
            unit="م²"
          />
          <Stat
            id="materials-count"
            label="عدد الخامات"
            value={loading ? '…' : materials.length}
            unit="خامة"
          />
          <Stat id="units-count" label="عدد الوحدات" value={loading ? '…' : totalUnits} unit="وحدة" />
        </div>

        {/* Cost distribution per material */}
        {!loading && hasCost && (
          <div className="mt-6 border-t border-cream-100/10 pt-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-cream-50/70">إجمالي الخامات:</span>
              <span className="font-bold text-cream-50">{fmt(materialsTotalCost)} {CURRENCY}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-cream-50/70">الإكسسوارات:</span>
              <span className="font-bold text-teal-200/90">{fmt(accessoriesCost)} {CURRENCY}</span>
            </div>
            <p className="mb-2 text-xs font-semibold text-cream-50/70">توزيع التكلفة الكلية</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-cream-100/10 bg-black/30">
              {materials.map((m, i) =>
                m.totalCost > 0 ? (
                  <div
                    key={m.id}
                    className={`h-full transition-all duration-500 ${accentFor(i).bar}`}
                    style={{ width: `${(m.totalCost / grandTotalCost) * 100}%` }}
                    title={`${m.name}: ${fmt(m.totalCost)} ${CURRENCY}`}
                  />
                ) : null
              )}
              {accessoriesCost > 0 && (
                <div 
                  className="h-full transition-all duration-500 bg-teal-500/80" 
                  style={{ width: `${(accessoriesCost / grandTotalCost) * 100}%` }} 
                  title={`الإكسسوارات: ${fmt(accessoriesCost)} ${CURRENCY}`}
                />
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {materials.map((m, i) => (
                <li key={m.id} className="flex items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${accentFor(i).dot}`} />
                  <span className="font-semibold text-cream-50">{m.name}</span>
                  <span className="tabular-nums text-cream-50/60">
                    {fmt((m.totalCost / grandTotalCost) * 100, 1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Results: One material section
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Results: Levels breakdown (3-column stats grid)
// ---------------------------------------------------------------------------
function LevelCard({ levelKey, levelData, grandTotalCost, grandTotalArea, loading }) {
  const config = LEVEL_CONFIG[levelKey] || LEVEL_CONFIG.lower;
  const area = levelData?.totalArea || 0;
  const cost = levelData?.totalCost || 0;
  const count = levelData?.unitCount || 0;
  const costShare = grandTotalCost > 0 ? (cost / grandTotalCost) * 100 : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${config.cardBorder} bg-gradient-to-br ${config.cardGlow} p-5 text-cream-50 shadow-xl shadow-black/30 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50`}
    >
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-1.5 ${config.bar}`} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cream-100/10 bg-gradient-to-br ${config.iconBg} text-cream-50 shadow-md`}
          >
            <LevelIcon level={levelKey} className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-extrabold text-base text-cream-50 leading-tight">
              {config.label}
            </h3>
            <p className="text-[11px] text-cream-50/60 font-medium">{config.subtitle}</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${config.badge}`}
        >
          {loading ? '…' : `${count} قطعة`}
        </span>
      </div>

      {/* Main Stat: Cost */}
      <div className="rounded-2xl border border-cream-100/10 bg-black/30 p-3.5 mb-3.5 backdrop-blur-md">
        <span className="text-[11px] font-semibold text-cream-50/70 block">
          التكلفة الإجمالية
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          {loading ? (
            <span className="h-8 w-28 animate-pulse rounded-lg bg-cream-50/20" />
          ) : (
            <>
              <span className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${config.accentText}`}>
                {fmt(cost)}
              </span>
              <span className="text-xs font-bold text-cream-50/70">{CURRENCY}</span>
            </>
          )}
        </div>
      </div>

      {/* Sub Stats: Area & Cost Share */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-cream-100/5 bg-black/25 p-2.5">
          <span className="text-cream-50/60 block text-[11px]">المساحة الإجمالية</span>
          <span className="font-bold text-cream-50 tabular-nums text-sm mt-0.5 block">
            {loading ? '…' : `${fmt(area, 3)} م²`}
          </span>
        </div>
        <div className="rounded-xl border border-cream-100/5 bg-black/25 p-2.5">
          <span className="text-cream-50/60 block text-[11px]">نسبة التكلفة</span>
          <span className="font-bold text-cream-50 tabular-nums text-sm mt-0.5 block">
            {loading ? '…' : `${fmt(costShare, 1)}%`}
          </span>
        </div>
      </div>

      {/* Visual mini progress bar for cost share */}
      <div className="mt-3.5">
        <div className="flex justify-between items-center text-[10px] text-cream-50/50 mb-1">
          <span>الحصة من إجمالي تكلفة المطبخ</span>
          <span className="tabular-nums font-semibold">{loading ? '…' : `${fmt(costShare, 1)}%`}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 border border-cream-100/5">
          <div
            className={`h-full transition-all duration-500 rounded-full ${config.bar}`}
            style={{ width: `${Math.min(costShare, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LevelsSummarySection({ levels, grandTotalCost, grandTotalArea, loading }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-cream-50">
          <Icon name="layers" className="h-5 w-5 text-amber-200/90" />
          <span>ملخص المستويات الرأسية للمطبخ</span>
        </h2>
        <span className="text-xs text-cream-50/60 hidden sm:inline">
          سفلي · علوي · مستوى ثالث
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <LevelCard
          levelKey="lower"
          levelData={levels?.lower}
          grandTotalCost={grandTotalCost}
          grandTotalArea={grandTotalArea}
          loading={loading}
        />
        <LevelCard
          levelKey="upper"
          levelData={levels?.upper}
          grandTotalCost={grandTotalCost}
          grandTotalArea={grandTotalArea}
          loading={loading}
        />
        <LevelCard
          levelKey="third"
          levelData={levels?.third}
          grandTotalCost={grandTotalCost}
          grandTotalArea={grandTotalArea}
          loading={loading}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Results: One material section
// ---------------------------------------------------------------------------
function MaterialSection({ material, index, deletingKey, onDeleteMaterial, onDeleteUnit, onEditUnit }) {
  const accent = accentFor(index);
  const deletingMaterial = deletingKey === `material-${material.id}`;
  const [levelFilter, setLevelFilter] = useState('all');

  const counts = {
    all: material.units.length,
    lower: material.units.filter((u) => (u.level || 'lower') === 'lower').length,
    upper: material.units.filter((u) => u.level === 'upper').length,
    third: material.units.filter((u) => u.level === 'third').length,
  };

  const displayedUnits = useMemo(() => {
    if (levelFilter === 'all') return material.units;
    return material.units.filter((u) => (u.level || 'lower') === levelFilter);
  }, [material.units, levelFilter]);

  const displayedArea = useMemo(() => {
    return displayedUnits.reduce((sum, u) => sum + u.area, 0);
  }, [displayedUnits]);

  const displayedCost = useMemo(() => {
    return displayedArea * material.pricePerMeter;
  }, [displayedArea, material.pricePerMeter]);

  return (
    <section
      id={`material-${material.id}`}
      className={`animate-fade-in-up relative overflow-hidden rounded-3xl text-cream-50 transition-shadow duration-300 hover:shadow-2xl hover:shadow-black/40 ${GLASS_DARK} ${
        deletingMaterial ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      {/* Accent strip */}
      <div className={`absolute inset-x-0 top-0 h-1 ${accent.bar}`} />

      <div className="p-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cream-100/10 bg-gradient-to-br ${accent.icon} text-cream-50/90 shadow-lg shadow-black/30`}
          >
            <Icon name="layers" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-extrabold text-cream-50">{material.name}</h3>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full border bg-black/20 px-2.5 py-0.5 text-xs font-bold ${accent.border} ${accent.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
              <span className="tabular-nums">{fmt(material.pricePerMeter)}</span> {CURRENCY} / م²
            </span>
          </div>
          <DeleteButton
            id={`delete-material-${material.id}`}
            loading={deletingMaterial}
            label={`حذف الخامة ${material.name}`}
            onClick={() => onDeleteMaterial(material)}
          />
        </div>

        {/* Material totals */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat label="إجمالي المساحة" value={fmt(material.totalArea, 3)} unit="م²" />
          <Stat
            label="إجمالي التكلفة"
            value={fmt(material.totalCost)}
            unit={CURRENCY}
            highlight={accent.text}
          />
          <Stat label="عدد الوحدات" value={material.unitsCount} unit="وحدة" />
        </div>

        {/* Units table */}
        {material.units.length === 0 ? (
          <EmptyState
            icon="cube"
            title="لا توجد وحدات تحت هذه الخامة بعد"
            subtitle="اختر هذه الخامة من نموذج «إضافة وحدة جديدة»"
          />
        ) : (
          <div className="space-y-3">
            {/* Filter buttons bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-100/10 bg-black/20 p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-cream-50/70">تصفية حسب المستوى:</span>
                <div className="inline-flex rounded-xl bg-black/30 p-1 border border-cream-100/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setLevelFilter('all')}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      levelFilter === 'all'
                        ? 'bg-cream-50/15 text-cream-50 shadow'
                        : 'text-cream-50/60 hover:text-cream-50'
                    }`}
                  >
                    الكل ({counts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevelFilter('lower')}
                    className={`rounded-lg px-2.5 py-1 transition flex items-center gap-1.5 ${
                      levelFilter === 'lower'
                        ? 'bg-sky-950/80 text-sky-200 border border-sky-400/30 shadow'
                        : 'text-cream-50/60 hover:text-sky-200'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    سفلية ({counts.lower})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevelFilter('upper')}
                    className={`rounded-lg px-2.5 py-1 transition flex items-center gap-1.5 ${
                      levelFilter === 'upper'
                        ? 'bg-amber-950/80 text-amber-200 border border-amber-400/30 shadow'
                        : 'text-cream-50/60 hover:text-amber-200'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    علوية ({counts.upper})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevelFilter('third')}
                    className={`rounded-lg px-2.5 py-1 transition flex items-center gap-1.5 ${
                      levelFilter === 'third'
                        ? 'bg-purple-950/80 text-purple-200 border border-purple-400/30 shadow'
                        : 'text-cream-50/60 hover:text-purple-200'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                    مستوى ثالث ({counts.third})
                  </button>
                </div>
              </div>

              {levelFilter !== 'all' && (
                <span className="text-xs text-cream-50/70 font-medium">
                  عرض {displayedUnits.length} من {material.units.length} وحدة
                </span>
              )}
            </div>

            {/* Table or Empty filter message */}
            {displayedUnits.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-100/10 bg-black/15 py-8 text-center">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cream-50/5 text-cream-50/60">
                  <Icon name="info" className="h-5 w-5" />
                </span>
                <p className="text-sm font-bold text-cream-50">
                  لا توجد قطع «{LEVEL_CONFIG[levelFilter]?.label || levelFilter}» في هذه الخامة
                </p>
                <button
                  type="button"
                  onClick={() => setLevelFilter('all')}
                  className="mt-2 text-xs font-semibold text-amber-300 hover:underline"
                >
                  عرض جميع الوحدات ({material.units.length})
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-cream-100/10 bg-black/15">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-cream-100/10 bg-black/20 text-xs text-cream-50/70">
                      <th className="px-3 py-3 text-right font-semibold">#</th>
                      <th className="px-3 py-3 text-right font-semibold">الوحدة والمستوى</th>
                      <th className="px-3 py-3 text-right font-semibold">الأبعاد</th>
                      <th className="px-3 py-3 text-right font-semibold">القاعدة المطبقة</th>
                      <th className="px-3 py-3 text-right font-semibold">المساحة</th>
                      <th className="px-3 py-3" aria-label="إجراءات" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100/[0.06]">
                    {displayedUnits.map((unit, i) => {
                      const deletingUnit = deletingKey === `unit-${unit.id}`;
                      return (
                        <tr
                          key={unit.id}
                          className={`animate-fade-in-up transition-colors hover:bg-cream-50/[0.04] ${
                            deletingUnit ? 'pointer-events-none opacity-50' : ''
                          }`}
                        >
                          <td className="px-3 py-3 font-bold text-cream-50/50 tabular-nums">{i + 1}</td>
                          <td className="px-3 py-3">
                            <p className="max-w-[11rem] truncate font-bold text-cream-50">{unit.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <LevelBadge level={unit.level || 'lower'} />
                              <TypeBadge type={unit.type} label={unit.typeLabel} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-cream-50/80">
                            <div className="space-y-0.5 text-xs tabular-nums">
                              <p>
                                العرض: <span className="font-semibold text-cream-50">{fmt(unit.width)} {unit.measurementUnit === 'cm' ? 'سم' : 'م'}</span>
                              </p>
                              <p>
                                الارتفاع: <span className="font-semibold text-cream-50">{fmt(unit.height)} {unit.measurementUnit === 'cm' ? 'سم' : 'م'}</span>
                              </p>
                              {unit.length != null && (
                                <p>
                                  الطول: <span className="font-semibold text-emerald-200">{fmt(unit.length)} {unit.measurementUnit === 'cm' ? 'سم' : 'م'}</span>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-xs font-semibold text-cream-50/80">{unit.rule}</p>
                            <p
                              dir="ltr"
                              className="mt-1 text-right font-mono text-[11px] text-cream-50/50"
                            >
                              {unit.calculation}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className="rounded-lg border border-sky-400/15 bg-sky-950/40 px-2 py-1 text-xs font-bold text-sky-200/90 tabular-nums">
                              {fmt(unit.area, 4)} م²
                            </span>
                          </td>
                          <td className="px-3 py-3 text-left">
                            <div className="flex items-center gap-2 justify-end">
                              <EditButton
                                compact
                                id={`edit-unit-${unit.id}`}
                                loading={deletingKey === `edit-unit-${unit.id}`}
                                label={`تعديل ${unit.name}`}
                                onClick={() => onEditUnit(material.id, unit)}
                              />
                              <DeleteButton
                                compact
                                id={`delete-unit-${unit.id}`}
                                loading={deletingUnit}
                                label={`حذف ${unit.name}`}
                                onClick={() => onDeleteUnit(material.id, unit)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-cream-100/10 bg-black/25 font-bold">
                      <td colSpan={4} className="px-3 py-3 text-cream-50/80">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            {levelFilter === 'all'
                              ? `إجمالي ${material.name}`
                              : `إجمالي ${LEVEL_CONFIG[levelFilter]?.label || ''} في ${material.name}`}
                          </span>
                          <span className="font-normal text-xs text-cream-50/50 bg-black/20 px-2 py-0.5 rounded-full border border-cream-100/5">
                            التكلفة = {fmt(displayedArea, 4)} م² × {fmt(material.pricePerMeter)} ={' '}
                            <span className={accent.text}>{fmt(displayedCost)} {CURRENCY}</span>
                            {levelFilter !== 'all' && (
                              <span className="text-cream-50/50 mr-1.5">
                                (من أصل إجمالي الخامة: {fmt(material.totalCost)} {CURRENCY})
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sky-200/90 tabular-nums">
                        {fmt(displayedArea, 4)} م²
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const [state, setState] = useState(EMPTY_STATE);
  const [materialForm, setMaterialForm] = useState(INITIAL_MATERIAL_FORM);
  const [unitForm, setUnitForm] = useState(INITIAL_UNIT_FORM);

  const widthInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null); // `material-<id>` | `unit-<id>` | `edit-unit-<id>`
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [unitToEdit, setUnitToEdit] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { materials, unitTypes } = state;
  const hasMaterials = materials.length > 0;

  // ---- Initial fetch -------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/state');
      setState(data);
      setConnected(true);
    } catch (err) {
      setConnected(false);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-hide success toast
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 2500);
    return () => clearTimeout(t);
  }, [success]);

  // Auto-focus Width input on initial load or once materials are available
  useEffect(() => {
    if (!loading && hasMaterials) {
      widthInputRef.current?.focus();
    }
  }, [loading, hasMaterials]);

  // Keep focus on Width input when an addition completes
  const prevAddingUnit = useRef(addingUnit);
  useEffect(() => {
    if (prevAddingUnit.current && !addingUnit) {
      widthInputRef.current?.focus();
      const t = setTimeout(() => {
        widthInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
    prevAddingUnit.current = addingUnit;
  }, [addingUnit]);

  // Keep the selected material valid (e.g. after it gets deleted)
  useEffect(() => {
    setUnitForm((prev) =>
      materials.some((m) => m.id === prev.materialId)
        ? prev
        : { ...prev, materialId: materials[0]?.id ?? '' }
    );
  }, [materials]);

  // ---- Derived values ------------------------------------------------------
  const selectedType = useMemo(
    () => unitTypes.find((t) => t.key === unitForm.type) || unitTypes[0],
    [unitTypes, unitForm.type]
  );
  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === unitForm.materialId),
    [materials, unitForm.materialId]
  );
  const needsLength = Boolean(selectedType?.requiresLength);

  // Live preview – mirrors the server formula using the server-provided multiplier
  const preview = useMemo(() => {
    const rawW = parseFloat(unitForm.width);
    const rawH = parseFloat(unitForm.height);
    const rawL = parseFloat(unitForm.length);
    if (!selectedType || !(rawW > 0) || !(rawH > 0)) return null;
    if (needsLength && !(rawL > 0)) return null;

    const mFactor = unitForm.measurementUnit === 'cm' ? 0.01 : 1;
    const w = rawW * mFactor;
    const h = rawH * mFactor;
    const l = needsLength ? (rawL * mFactor) : 0;

    const baseArea = needsLength ? (w + l) * h : w * h;
    const area = baseArea * selectedType.multiplier;
    return { area };
  }, [unitForm.width, unitForm.height, unitForm.length, selectedType, needsLength, unitForm.measurementUnit]);

  // ---- Handlers ------------------------------------------------------------
  const handleAddMaterial = async (e) => {
    e.preventDefault();
    const name = materialForm.name.trim();
    const price = parseFloat(materialForm.pricePerMeter);

    if (!name) return setError('يرجى إدخال اسم الخامة.');
    if (!(price > 0)) return setError('يرجى إدخال سعر صحيح أكبر من صفر.');

    setAddingMaterial(true);
    setError('');
    try {
      const data = await api('/api/materials', {
        method: 'POST',
        body: JSON.stringify({ name, pricePerMeter: price }),
      });
      setState(data.state);
      setMaterialForm(INITIAL_MATERIAL_FORM);
      // Auto-select the new material so the user can start adding units right away
      setUnitForm((prev) => ({ ...prev, materialId: data.item.id }));
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMaterial(false);
    }
  };

  const confirmDeleteMaterial = (material) => {
    setMaterialToDelete(material);
  };

  const executeDeleteMaterial = async () => {
    const material = materialToDelete;
    if (!material) return;
    setMaterialToDelete(null);

    setDeletingKey(`material-${material.id}`);
    setError('');
    try {
      const data = await api(`/api/materials/${material.id}`, { method: 'DELETE' });
      setState(data.state);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleAddUnit = async (e) => {
    e?.preventDefault();
    if (addingUnit) return;
    const width = parseFloat(unitForm.width);
    const height = parseFloat(unitForm.height);
    const length = parseFloat(unitForm.length);

    if (!selectedMaterial) return setError('يرجى اختيار الخامة أولاً.');
    if (!selectedType) return setError('يرجى اختيار نوع الوحدة.');
    if (!(width > 0) || !(height > 0)) return setError('يرجى إدخال عرض وارتفاع صحيحين أكبر من صفر.');
    if (needsLength && !(length > 0)) return setError('يرجى إدخال الطول للقطعة حرف L.');

    setAddingUnit(true);
    setError('');
    try {
      const data = await api(`/api/materials/${selectedMaterial.id}/units`, {
        method: 'POST',
        body: JSON.stringify({
          type: selectedType.key,
          level: unitForm.level || 'lower',
          name: unitForm.name.trim(),
          width,
          height,
          ...(needsLength && { length }),
          measurementUnit: unitForm.measurementUnit,
        }),
      });
      setState(data.state);
      // Keep material, level, type, measurementUnit, AND sticky height for fast consecutive entries
      setUnitForm((prev) => ({
        ...INITIAL_UNIT_FORM,
        materialId: prev.materialId,
        level: prev.level,
        type: prev.type,
        measurementUnit: prev.measurementUnit,
        height: prev.height, // Sticky height: retained for consecutive additions
      }));
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingUnit(false);
      // Auto-focus back to width input immediately for seamless rapid entry
      widthInputRef.current?.focus();
      setTimeout(() => {
        widthInputRef.current?.focus();
      }, 50);
    }
  };

  const handleDeleteUnit = async (materialId, unit) => {
    setDeletingKey(`unit-${unit.id}`);
    setError('');
    try {
      const data = await api(`/api/materials/${materialId}/units/${unit.id}`, { method: 'DELETE' });
      setState(data.state);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const updateMaterialForm = (field) => (e) =>
    setMaterialForm((prev) => ({ ...prev, [field]: e.target.value }));

  const updateUnitForm = (field) => (e) =>
    setUnitForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSaveEditUnit = async (form) => {
    const { unit, materialId } = unitToEdit;
    
    setDeletingKey(`edit-unit-${unit.id}`);
    setError('');
    
    try {
      const data = await api(`/api/materials/${materialId}/units/${unit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim(),
          level: form.level || unit.level || 'lower',
          width: parseFloat(form.width),
          height: parseFloat(form.height),
          ...(unit.type === 'lshape' && { length: parseFloat(form.length) }),
          measurementUnit: form.measurementUnit,
        }),
      });
      setState(data.state);
      setSuccess(data.message);
      setUnitToEdit(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleAddAccessory = async (name, price) => {
    setError('');
    try {
      const data = await api('/api/accessories', {
        method: 'POST',
        body: JSON.stringify({ name, price }),
      });
      setState(data.state);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAccessory = async (acc) => {
    setDeletingKey(`acc-${acc.id}`);
    setError('');
    try {
      const data = await api(`/api/accessories/${acc.id}`, { method: 'DELETE' });
      setState(data.state);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleTypeChange = (e) => {
    const type = e.target.value;
    const requiresLength = unitTypes.find((t) => t.key === type)?.requiresLength;
    // Clear the length when switching away from L-Shape so stale values are never sent
    setUnitForm((prev) => ({ ...prev, type, length: requiresLength ? prev.length : '' }));
  };

  const handleLevelChange = (newLevel) => {
    setUnitForm((prev) => ({
      ...prev,
      level: newLevel,
      height: String(getDefaultHeight(newLevel, prev.measurementUnit)),
    }));
  };

  const handleMeasurementUnitChange = (newUnit) => {
    setUnitForm((prev) => {
      if (prev.measurementUnit === newUnit) return prev;
      let newHeight = prev.height;
      if (prev.height && !isNaN(Number(prev.height))) {
        const num = Number(prev.height);
        if (newUnit === 'm' && prev.measurementUnit === 'cm') {
          newHeight = String(Math.round((num / 100) * 1000) / 1000);
        } else if (newUnit === 'cm' && prev.measurementUnit === 'm') {
          newHeight = String(Math.round(num * 100));
        }
      } else {
        newHeight = String(getDefaultHeight(prev.level, newUnit));
      }
      return { ...prev, measurementUnit: newUnit, height: newHeight };
    });
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !addingUnit) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const defaultHeightForCurrentLevel = getDefaultHeight(unitForm.level, unitForm.measurementUnit);
  const heightPresets = STANDARD_HEIGHT_PRESETS[unitForm.measurementUnit] || STANDARD_HEIGHT_PRESETS.cm;
  const unitLabel = unitForm.measurementUnit === 'cm' ? 'سم' : 'م';

  // ---- Render --------------------------------------------------------------
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-wood-950 via-wood-900 to-wood-800 text-cream-50">
      {/* Mesh-gradient blobs (deep, muted tones) */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-wood-800/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-40 h-[32rem] w-[32rem] rounded-full bg-wood-700/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[28rem] w-[28rem] rounded-full bg-amber-900/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-20 h-80 w-80 rounded-full bg-wood-900/40 blur-3xl" />
      {/* Matte scrim – neutral overlay that desaturates the gradient for a flat, non-glossy finish */}
      <div className="pointer-events-none absolute inset-0 bg-neutral-950/30" />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-cream-50 ${GLASS_LIGHT}`}>
              <CalculatorIcon className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-cream-50 drop-shadow-sm sm:text-3xl">
                حاسبة تكلفة المطبخ
              </h1>
              <p className="text-sm text-cream-50/70 drop-shadow-sm sm:text-base">
                إدارة الخامات وحساب المساحات تلقائياً حسب نوع كل وحدة
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-cream-50 ${GLASS_LIGHT}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  connected ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  connected ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </span>
            {loading ? 'جارٍ الاتصال…' : connected ? 'متصل بالخادم' : 'غير متصل'}
            <span className="text-cream-50/40">·</span>
            <span className="text-amber-200/90 tabular-nums">
              {materials.length} خامة / {state.totalUnits} وحدة
            </span>
          </div>
        </header>

        {/* Alerts */}
        <div className="mb-6 space-y-3" aria-live="polite">
          {error && (
            <div className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-950/50 px-4 py-3 text-cream-50 shadow-xl shadow-black/30 backdrop-blur-md">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
              <p className="flex-1 text-sm font-medium">{error}</p>
              {!loading && !connected && (
                <button
                  id="retry-btn"
                  onClick={loadData}
                  className="inline-flex items-center gap-1 rounded-lg border border-cream-100/20 bg-cream-50/10 px-3 py-1 text-xs font-bold transition hover:bg-cream-50/20"
                >
                  <Icon name="refresh" className="h-4 w-4" />
                  إعادة المحاولة
                </button>
              )}
              <button
               id="dismiss-error-btn"
                onClick={() => setError('')}
                className="rounded-lg p-1 transition hover:bg-cream-50/15"
                aria-label="إغلاق"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="animate-fade-in-up flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-950/50 px-4 py-3 text-cream-50 shadow-xl shadow-black/30 backdrop-blur-md">
              <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-300" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}
        </div>

        {/* Main grid — first column renders on the RIGHT in RTL */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ================= RIGHT: Inputs ================= */}
          <div className="space-y-6 lg:col-span-4">
            {/* ---------- Section 1: Manage materials ---------- */}
            <Card>
              <CardHeader
                step="1"
                icon={<Icon name="layers" />}
                title="إدارة الخامات"
                subtitle="أضف الخامة وسعر المتر المربع"
                accent="from-amber-700/60 to-wood-900/60"
              />
              <form onSubmit={handleAddMaterial} className="space-y-4">
                <Field
                  id="material-name"
                  label="اسم الخامة"
                  type="text"
                  placeholder="مثال: HPL"
                  value={materialForm.name}
                  onChange={updateMaterialForm('name')}
                  disabled={loading || addingMaterial}
                  maxLength={60}
                  required
                />
                <Field
                  id="material-price"
                  label="سعر المتر المربع"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="مثال: 5200"
                  suffix={`${CURRENCY} / م²`}
                  value={materialForm.pricePerMeter}
                  onChange={updateMaterialForm('pricePerMeter')}
                  disabled={loading || addingMaterial}
                  required
                />
                <PrimaryButton
                  id="add-material-btn"
                  type="submit"
                  loading={addingMaterial}
                  disabled={loading}
                  tone="bg-amber-800/70 hover:bg-amber-700/70"
                >
                  {!addingMaterial && <Icon name="plus" className="h-5 w-5" />}
                  {addingMaterial ? 'جارٍ الإضافة...' : 'إضافة خامة'}
                </PrimaryButton>
              </form>

              {/* Materials quick list */}
              {hasMaterials && (
                <ul className="mt-5 max-h-64 space-y-2 overflow-y-auto border-t border-cream-100/10 pt-4">
                  {materials.map((m, i) => {
                    const accent = accentFor(i);
                    return (
                      <li
                        key={m.id}
                        className="animate-fade-in-up flex items-center gap-3 rounded-xl border border-cream-100/10 bg-black/15 px-3 py-2 transition hover:bg-cream-50/5"
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-cream-50">{m.name}</p>
                          <p className="text-xs text-cream-50/60 tabular-nums">
                            {fmt(m.pricePerMeter)} {CURRENCY} / م² · {m.unitsCount} وحدة
                          </p>
                        </div>
                        <DeleteButton
                          compact
                          id={`quick-delete-material-${m.id}`}
                          loading={deletingKey === `material-${m.id}`}
                          label={`حذف الخامة ${m.name}`}
                          onClick={() => confirmDeleteMaterial(m)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* ---------- Section 2: Add unit ---------- */}
            <Card>
              <CardHeader
                step="2"
                icon={<Icon name="cube" />}
                title="إضافة وحدة جديدة"
                subtitle="حدد الأبعاد ونوع الوحدة"
              />

              {!loading && !hasMaterials && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-950/40 px-3 py-2.5 text-sm text-amber-100">
                  <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                  أضف خامة واحدة على الأقل لتتمكن من إضافة الوحدات.
                </div>
              )}

              <form onSubmit={handleAddUnit}>
                <fieldset disabled={loading || !hasMaterials} className="space-y-4">
                  <SelectField
                    id="unit-material"
                    label="الخامة"
                    value={unitForm.materialId}
                    onChange={updateUnitForm('materialId')}
                    required
                  >
                    {!hasMaterials && <option value="">— لا توجد خامات —</option>}
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {/* \u200F (RLM) keeps Latin names like "HPL" from scrambling the RTL order */}
                        {`${m.name}\u200F — ${fmt(m.pricePerMeter)} ${CURRENCY}/م²`}
                      </option>
                    ))}
                  </SelectField>
                  
                  {/* Measurement Unit Toggle */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-cream-50">
                      وحدة القياس
                    </label>
                    <div className="flex gap-4 p-1 rounded-xl bg-black/20 border border-cream-100/5">
                      <label className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold cursor-pointer rounded-lg transition ${unitForm.measurementUnit === 'cm' ? 'bg-cream-50/10 text-cream-50 shadow' : 'text-cream-50/50 hover:text-cream-50/80'}`}>
                        <input
                          type="radio"
                          name="measurementUnit"
                          value="cm"
                          checked={unitForm.measurementUnit === 'cm'}
                          onChange={() => handleMeasurementUnitChange('cm')}
                          className="hidden"
                        />
                        سنتيمتر (cm)
                      </label>
                      <label className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold cursor-pointer rounded-lg transition ${unitForm.measurementUnit === 'm' ? 'bg-cream-50/10 text-cream-50 shadow' : 'text-cream-50/50 hover:text-cream-50/80'}`}>
                        <input
                          type="radio"
                          name="measurementUnit"
                          value="m"
                          checked={unitForm.measurementUnit === 'm'}
                          onChange={() => handleMeasurementUnitChange('m')}
                          className="hidden"
                        />
                        متر (m)
                      </label>
                    </div>
                  </div>

                  {/* Vertical Level Selector */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-semibold text-cream-50">
                        مستوى الوحدة (المستوى الرأسي)
                      </label>
                      <span className="text-[11px] text-cream-50/60 font-medium">سفلي · علوي · ثالث</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-black/25 border border-cream-100/10 backdrop-blur-md">
                      {Object.values(LEVEL_CONFIG).map((lvl) => {
                        const isSelected = unitForm.level === lvl.key;
                        return (
                          <button
                            key={lvl.key}
                            type="button"
                            onClick={() => handleLevelChange(lvl.key)}
                            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                              isSelected
                                ? `${lvl.badge} shadow-lg ring-1 ring-cream-50/20 scale-[1.02]`
                                : 'text-cream-50/60 hover:text-cream-50 hover:bg-cream-50/5'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${isSelected ? lvl.dot : 'bg-cream-50/30'}`} />
                              <span>{lvl.label}</span>
                            </div>
                            <span className="text-[10px] opacity-70 mt-0.5 font-normal">{lvl.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <SelectField
                      id="unit-type"
                      label="نوع الوحدة"
                      value={unitForm.type}
                      onChange={handleTypeChange}
                      required
                    >
                      {unitTypes.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </SelectField>
                    {selectedType && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-cream-100/10 bg-black/20 px-3 py-2 text-xs">
                        <TypeBadge type={selectedType.key} label={selectedType.label} />
                        <span className="text-cream-50/60">المعادلة:</span>
                        <span className="font-bold text-cream-50">{selectedType.rule}</span>
                      </div>
                    )}
                  </div>

                  <Field
                    id="unit-name"
                    label="اسم / وصف الوحدة"
                    type="text"
                    placeholder={selectedType ? `مثال: ${selectedType.label} فوق الحوض` : 'وصف الوحدة'}
                    value={unitForm.name}
                    onChange={updateUnitForm('name')}
                    onKeyDown={handleInputKeyDown}
                    maxLength={60}
                  />

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        ref={widthInputRef}
                        id="unit-width"
                        label="العرض"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="60"
                        suffix={unitLabel}
                        value={unitForm.width}
                        onChange={updateUnitForm('width')}
                        onKeyDown={handleInputKeyDown}
                        autoFocus
                        required
                      />
                      <Field
                        id="unit-height"
                        label="الارتفاع"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder={String(defaultHeightForCurrentLevel)}
                        suffix={unitLabel}
                        value={unitForm.height}
                        onChange={updateUnitForm('height')}
                        onKeyDown={handleInputKeyDown}
                        required
                      />
                    </div>

                    {/* Default & Sticky Height helper with quick selection chips */}
                    <div className="rounded-2xl border border-cream-100/10 bg-black/25 p-3 text-xs backdrop-blur-md">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-cream-50/70">
                          الارتفاع الافتراضي لـ «{LEVEL_CONFIG[unitForm.level]?.label || 'هذا المستوى'}»:
                        </span>
                        <button
                          type="button"
                          onClick={() => setUnitForm((p) => ({ ...p, height: String(defaultHeightForCurrentLevel) }))}
                          className="font-bold text-amber-200 hover:text-amber-100 underline decoration-dotted transition"
                          title="انقر لتطبيق الارتفاع الافتراضي لهذا المستوى"
                        >
                          {defaultHeightForCurrentLevel} {unitLabel}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-cream-100/10">
                        <span className="text-[11px] text-cream-50/60 font-medium">خيارات سريعة:</span>
                        {heightPresets.map((hVal) => (
                          <button
                            key={hVal}
                            type="button"
                            onClick={() => setUnitForm((p) => ({ ...p, height: String(hVal) }))}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums transition ${
                              String(unitForm.height) === String(hVal)
                                ? 'bg-amber-400 text-wood-950 shadow ring-1 ring-amber-300 font-extrabold'
                                : 'bg-black/30 border border-cream-100/10 text-cream-50/70 hover:text-cream-50 hover:bg-cream-50/10'
                            }`}
                          >
                            {hVal} {unitLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* L-Shape only: extra length input */}
                  {needsLength && (
                    <div className="animate-fade-in-up rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-3">
                      <Field
                        id="unit-length"
                        label="الطول (الضلع الثاني)"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="90"
                        suffix={unitLabel}
                        value={unitForm.length}
                        onChange={updateUnitForm('length')}
                        onKeyDown={handleInputKeyDown}
                        hint="مطلوب للقطعة حرف L: المساحة = (العرض + الطول) × الارتفاع"
                        required
                      />
                    </div>
                  )}

                  {/* Live preview */}
                  <div
                    className={`flex items-center justify-center gap-3 rounded-2xl border border-dashed p-3 text-center backdrop-blur-md transition-colors ${
                      preview ? 'border-cream-100/20 bg-cream-50/5' : 'border-cream-100/10 bg-black/20'
                    }`}
                  >
                    <div>
                      <p className="text-xs text-cream-50/70">المساحة المتوقعة</p>
                      <p className="font-bold text-cream-50 tabular-nums">
                        {preview ? fmt(preview.area, 4) : '—'} <span className="text-xs">م²</span>
                      </p>
                    </div>
                  </div>

                  <PrimaryButton id="add-unit-btn" type="submit" loading={addingUnit} disabled={loading || addingUnit}>
                    {!addingUnit && <Icon name="plus" className="h-5 w-5" />}
                    {addingUnit
                      ? 'جارٍ الإضافة...'
                      : selectedMaterial
                        ? `إضافة إلى ${selectedMaterial.name}`
                        : 'إضافة الوحدة'}
                  </PrimaryButton>
                </fieldset>
              </form>
            </Card>

            <AccessoriesCard state={state} loading={loading} onAdd={handleAddAccessory} onDelete={handleDeleteAccessory} deletingKey={deletingKey} />
          </div>

          {/* ================= LEFT: Results ================= */}
          <div className="space-y-6 lg:col-span-8">
            {/* ---------- Section 3: Grand total ---------- */}
            <GrandTotalCard state={state} loading={loading} />

            {/* ---------- Dedicated 3-column stats grid for Levels ---------- */}
            <LevelsSummarySection
              levels={state.levels}
              grandTotalCost={state.grandTotalCost}
              grandTotalArea={state.grandTotalArea}
              loading={loading}
            />

            {/* ---------- Section 3: Per-material breakdown ---------- */}
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-cream-50">
                <Icon name="ruler" className="h-5 w-5 text-cream-50/70" />
                تفاصيل الخامات
              </h2>
              <span className="rounded-full border border-cream-100/10 bg-cream-50/5 px-3 py-1 text-sm font-bold text-cream-50/80 backdrop-blur-md tabular-nums">
                {materials.length}
              </span>
            </div>

            {loading ? (
              <SkeletonBlock />
            ) : !hasMaterials ? (
              <Card>
                <EmptyState
                  icon="layers"
                  title="لا توجد خامات بعد"
                  subtitle="ابدأ بإضافة خامة (مثل HPL) وسعر المتر من القسم الأول"
                />
              </Card>
            ) : (
              <div className="space-y-6">
                {materials.map((material, index) => (
                  <MaterialSection
                    key={material.id}
                    material={material}
                    index={index}
                    deletingKey={deletingKey}
                    onDeleteMaterial={confirmDeleteMaterial}
                    onDeleteUnit={handleDeleteUnit}
                    onEditUnit={(materialId, unit) => setUnitToEdit({ materialId, unit })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center">
          <span className="inline-block rounded-full border border-cream-100/10 bg-black/25 px-4 py-2 text-xs font-medium text-cream-50/60 shadow-xl shadow-black/30 backdrop-blur-md">
            جميع الحسابات تتم على الخادم · يتم تطبيق القواعد تلقائياً لحساب المساحة الإجمالية والتكلفة
          </span>
        </footer>

        <ConfirmModal
          isOpen={!!materialToDelete}
          title="تأكيد الحذف"
          description={materialToDelete ? `هل أنت متأكد من حذف الخامة "${materialToDelete.name}" نهائياً؟ سيتم حذف جميع الوحدات التابعة لها ولا يمكن التراجع عن هذا الإجراء.` : ''}
          onConfirm={executeDeleteMaterial}
          onCancel={() => setMaterialToDelete(null)}
          loading={deletingKey === `material-${materialToDelete?.id}`}
        />

        <EditUnitModal
          isOpen={!!unitToEdit}
          unit={unitToEdit?.unit}
          onClose={() => setUnitToEdit(null)}
          onSave={handleSaveEditUnit}
          loading={deletingKey === `edit-unit-${unitToEdit?.unit?.id}`}
        />
      </div>
    </main>
  );
}
