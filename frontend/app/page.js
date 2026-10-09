'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Config & Constants
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const CURRENCY = 'ج.م';

// Predefined Materials Catalog
const DEFAULT_MATERIALS = [
  { id: 'mat-hpl', name: 'HPL', pricePerMeter: 5200, isDefault: true },
  { id: 'mat-poly-back', name: 'Poly back', pricePerMeter: 7500, isDefault: true },
  { id: 'mat-poly-lac', name: 'Poly lac', pricePerMeter: 7200, isDefault: true },
];

const DEFAULT_LEVEL_PRICING = {
  lower: 'mat-hpl',
  upper: 'mat-poly-back',
  third: 'mat-poly-lac',
};

const DEFAULT_HEIGHTS = {
  lower: { cm: 90, m: 0.9 },
  upper: { cm: 80, m: 0.8 },
  third: { cm: 40, m: 0.4 },
};

const STANDARD_HEIGHT_PRESETS = {
  cm: [90, 85, 80, 70, 60, 40],
  m: [0.9, 0.85, 0.8, 0.7, 0.6, 0.4],
};

const getDefaultHeight = (level = 'lower', unit = 'cm') => {
  return DEFAULT_HEIGHTS[level]?.[unit] ?? (unit === 'cm' ? 90 : 0.9);
};

const INITIAL_UNIT_FORM = {
  name: '',
  level: 'lower',
  type: 'standard',
  width: '',
  height: '90', // Default height for lower in cm (sticky)
  length: '',
  measurementUnit: 'cm',
};

const INITIAL_CUSTOM_MATERIAL_FORM = {
  name: '',
  pricePerMeter: '',
};

// Badges & styling per unit type
const TYPE_STYLES = {
  standard: 'border-cream-100/15 bg-cream-50/10 text-cream-100',
  drawer: 'border-amber-400/25 bg-amber-950/50 text-amber-200',
  glass: 'border-sky-400/25 bg-sky-950/50 text-sky-200',
  tall: 'border-violet-400/25 bg-violet-950/50 text-violet-200',
  lshape: 'border-emerald-400/25 bg-emerald-950/50 text-emerald-200',
  side: 'border-rose-400/25 bg-rose-950/50 text-rose-200',
};

// Visual config for the 3 vertical levels
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
    cardBorder: 'border-sky-500/25 hover:border-sky-400/50',
    cardGlow: 'from-sky-950/40 via-wood-950/30 to-black/40',
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
    cardBorder: 'border-amber-500/25 hover:border-amber-400/50',
    cardGlow: 'from-amber-950/40 via-wood-950/30 to-black/40',
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
    cardBorder: 'border-purple-500/25 hover:border-purple-400/50',
    cardGlow: 'from-purple-950/40 via-indigo-950/30 to-black/40',
    iconBg: 'from-purple-700/60 to-indigo-900/60',
  },
};

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
    throw new Error('تعذّر الاتصال بالخادم. يرجى التأكد من تشغيل الخادم.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع، حاول مرة أخرى.');
  return data;
}

// ---------------------------------------------------------------------------
// Icons
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
  tag: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z',
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
// UI Components
// ---------------------------------------------------------------------------
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
  tone = 'bg-wood-700/70 hover:bg-wood-600/70',
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

function ConfirmModal({ isOpen, title, description, confirmText = 'حذف نهائي', cancelText = 'إلغاء', onConfirm, onCancel, loading }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={!loading ? onCancel : undefined} />
      <div className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl shadow-black border border-cream-100/10 bg-wood-900/95 backdrop-blur-xl animate-fade-in-up text-right">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-950/50 border border-rose-500/20 text-rose-400">
            <Icon name="alert" className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-cream-50">{title}</h3>
            <p className="text-xs text-cream-50/60 mt-0.5">عملية تتطلب التأكيد</p>
          </div>
        </div>
        <p className="mb-6 text-sm text-cream-50/75 leading-relaxed">{description}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-cream-100/10 bg-cream-50/5 px-4 py-2.5 font-bold text-cream-50 transition hover:bg-cream-50/10 focus:outline-none disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600/80 px-4 py-2.5 font-bold text-cream-50 shadow-lg shadow-rose-900/20 transition hover:bg-rose-500/90 focus:outline-none disabled:opacity-50"
          >
            {loading ? <Spinner /> : confirmText}
          </button>
        </div>
      </div>
    </div>
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

// ---------------------------------------------------------------------------
// Edit Unit Modal
// ---------------------------------------------------------------------------
function EditUnitModal({ unit, isOpen, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    name: '',
    level: 'lower',
    type: 'standard',
    width: '',
    height: '90',
    length: '',
    measurementUnit: 'cm',
  });

  useEffect(() => {
    if (unit) {
      setForm({
        name: unit.name || '',
        level: unit.level || 'lower',
        type: unit.type || 'standard',
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
  const needsLength = form.type === 'lshape';
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
            <h3 className="text-lg font-bold text-cream-50">تعديل أبعاد ومستوى الوحدة</h3>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="text-cream-50/50 hover:text-cream-50 transition p-1">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-right">
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

            <div className="rounded-xl border border-cream-100/10 bg-black/25 p-2.5 text-xs">
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-cream-50/75">الارتفاع الافتراضي لهذا المستوى:</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, height: String(editDefaultH) }))}
                  className="font-bold text-amber-200 hover:text-amber-100 underline decoration-dotted"
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

function EditMaterialModal({ material, isOpen, onClose, onSave, loading }) {
  const [form, setForm] = useState({ name: '', pricePerMeter: '' });

  useEffect(() => {
    if (material) {
      setForm({
        name: material.name || '',
        pricePerMeter: material.pricePerMeter !== undefined ? String(material.pricePerMeter) : '',
      });
    }
  }, [material]);

  if (!isOpen || !material) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl shadow-black border border-cream-100/10 bg-wood-900/95 backdrop-blur-xl animate-fade-in-up text-right">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-950/50 border border-sky-500/20 text-sky-400">
              <Icon name="edit" className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-cream-50">تعديل بيانات الخامة</h3>
              <p className="text-xs text-cream-50/60 mt-0.5">تحديث الاسم وسعر المتر المربع</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="text-cream-50/50 hover:text-cream-50 transition p-1">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="edit-mat-name"
            label="اسم الخامة"
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            maxLength={60}
            required
            disabled={loading}
          />
          <Field
            id="edit-mat-price"
            label="سعر المتر المربع"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            suffix={`${CURRENCY}/م²`}
            value={form.pricePerMeter}
            onChange={(e) => setForm((p) => ({ ...p, pricePerMeter: e.target.value }))}
            required
            disabled={loading}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-cream-100/10 bg-cream-50/5 px-4 py-2.5 font-bold text-cream-50 transition hover:bg-cream-50/10 focus:outline-none disabled:opacity-50"
            >
              إلغاء
            </button>
            <PrimaryButton type="submit" loading={loading} disabled={loading} className="flex-1">
              {loading ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accessories Card
// ---------------------------------------------------------------------------
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
        title="الإضافات والإكسسوارات"
        subtitle="المفصلات والمقابض وغيرها"
        accent="from-teal-700/60 to-wood-900/60"
      />

      <form onSubmit={handleSubmit} className="space-y-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="acc-name"
            label="اسم الإكسسوار"
            type="text"
            placeholder="مثال: مفصلات سوفت كلوز"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
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
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
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
// Grand Total Banner
// ---------------------------------------------------------------------------
function GrandTotalBanner({ grandTotalCost, grandTotalArea, totalUnits, lowerCost, upperCost, thirdCost, accessoriesCost, loading }) {
  const hasCost = grandTotalCost > 0;

  return (
    <section className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-cream-50 ${GLASS_LIGHT}`}>
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-amber-400/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-sky-400/[0.08] blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-wood-900/60 border border-amber-300/20 text-amber-300 shadow-md">
              <Icon name="chart" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-cream-50/80">إجمالي تكلفة المطبخ الشاملة</p>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight tabular-nums text-cream-50 drop-shadow-md">
                {loading ? '…' : fmt(grandTotalCost)}{' '}
                <span className="text-lg sm:text-2xl font-bold text-amber-200/90">{CURRENCY}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-cream-100/10 bg-black/30 px-4 py-2.5 text-xs sm:text-sm">
            <span className="text-cream-50/60">إجمالي المساحة:</span>
            <span className="font-extrabold text-amber-300 tabular-nums text-base">
              {loading ? '…' : fmt(grandTotalArea, 3)} م²
            </span>
            <span className="text-cream-50/30">·</span>
            <span className="text-cream-50/60">الوحدات:</span>
            <span className="font-extrabold text-cream-50 tabular-nums text-base">{loading ? '…' : totalUnits}</span>
          </div>
        </div>

        {/* Cost Distribution Progress Bar */}
        {!loading && hasCost && (
          <div className="mt-6 border-t border-cream-100/10 pt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-cream-50/70">
              <span>توزيع التكلفة حسب المستويات الرأسية:</span>
              <span className="font-bold text-cream-50">{fmt(grandTotalCost)} {CURRENCY}</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-cream-100/10 bg-black/30">
              {lowerCost > 0 && (
                <div
                  className="h-full bg-sky-500 transition-all duration-500"
                  style={{ width: `${(lowerCost / grandTotalCost) * 100}%` }}
                  title={`السفلي: ${fmt(lowerCost)} ${CURRENCY}`}
                />
              )}
              {upperCost > 0 && (
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${(upperCost / grandTotalCost) * 100}%` }}
                  title={`العلوي: ${fmt(upperCost)} ${CURRENCY}`}
                />
              )}
              {thirdCost > 0 && (
                <div
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${(thirdCost / grandTotalCost) * 100}%` }}
                  title={`المستوى الثالث: ${fmt(thirdCost)} ${CURRENCY}`}
                />
              )}
              {accessoriesCost > 0 && (
                <div
                  className="h-full bg-teal-500 transition-all duration-500"
                  style={{ width: `${(accessoriesCost / grandTotalCost) * 100}%` }}
                  title={`الإكسسوارات: ${fmt(accessoriesCost)} ${CURRENCY}`}
                />
              )}
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span className="text-cream-50/80">السفلي:</span>
                <span className="font-bold text-sky-200 tabular-nums">{fmt(lowerCost)} {CURRENCY}</span>
                <span className="text-[10px] text-cream-50/50">({fmt((lowerCost / grandTotalCost) * 100, 1)}%)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-cream-50/80">العلوي:</span>
                <span className="font-bold text-amber-200 tabular-nums">{fmt(upperCost)} {CURRENCY}</span>
                <span className="text-[10px] text-cream-50/50">({fmt((upperCost / grandTotalCost) * 100, 1)}%)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                <span className="text-cream-50/80">المستوى الثالث:</span>
                <span className="font-bold text-purple-200 tabular-nums">{fmt(thirdCost)} {CURRENCY}</span>
                <span className="text-[10px] text-cream-50/50">({fmt((thirdCost / grandTotalCost) * 100, 1)}%)</span>
              </li>
              {accessoriesCost > 0 && (
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
                  <span className="text-cream-50/80">الإكسسوارات:</span>
                  <span className="font-bold text-teal-200 tabular-nums">{fmt(accessoriesCost)} {CURRENCY}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function Home() {
  const [state, setState] = useState({
    units: [],
    materials: DEFAULT_MATERIALS,
    levelPricing: DEFAULT_LEVEL_PRICING,
    accessories: [],
    unitTypes: [],
    levels: {},
    lowerArea: 0,
    upperArea: 0,
    thirdArea: 0,
    grandTotalArea: 0,
    lowerCost: 0,
    upperCost: 0,
    thirdCost: 0,
    materialsTotalCost: 0,
    accessoriesCost: 0,
    grandTotalCost: 0,
    totalUnits: 0,
    totalMaterials: 3,
  });

  const [unitForm, setUnitForm] = useState(INITIAL_UNIT_FORM);
  const [customMaterialForm, setCustomMaterialForm] = useState(INITIAL_CUSTOM_MATERIAL_FORM);
  const [levelPricingState, setLevelPricingState] = useState(DEFAULT_LEVEL_PRICING);

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [unitToEdit, setUnitToEdit] = useState(null);
  const [materialToEdit, setMaterialToEdit] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(false);
  const [levelFilter, setLevelFilter] = useState('all');

  const [confirmClearAllOpen, setConfirmClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const widthInputRef = useRef(null);

  // ---- Initial Fetch -------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/state');
      setState(data);
      if (data.levelPricing) {
        setLevelPricingState(data.levelPricing);
      }
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

  // Auto-focus Width input on initial load or once data is ready
  useEffect(() => {
    if (!loading) {
      widthInputRef.current?.focus();
    }
  }, [loading]);

  // Refocus Width input when an addition finishes
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

  // ---- Real-time Level Pricing Calculation --------------------------------
  const materialsMap = useMemo(() => {
    const map = new Map();
    state.materials.forEach((m) => map.set(m.id, m));
    return map;
  }, [state.materials]);

  // Real-time calculated costs based on current dropdown selections
  const {
    lowerArea,
    upperArea,
    thirdArea,
    grandTotalArea,
    lowerMaterial,
    upperMaterial,
    thirdMaterial,
    lowerCost,
    upperCost,
    thirdCost,
    materialsTotalCost,
    accessoriesCost,
    grandTotalCost,
  } = useMemo(() => {
    const units = state.units || [];

    const lArea = units.filter((u) => u.level === 'lower').reduce((sum, u) => sum + (u.area || 0), 0);
    const uArea = units.filter((u) => u.level === 'upper').reduce((sum, u) => sum + (u.area || 0), 0);
    const tArea = units.filter((u) => u.level === 'third').reduce((sum, u) => sum + (u.area || 0), 0);
    const gArea = lArea + uArea + tArea;

    const lMat = materialsMap.get(levelPricingState.lower) || state.materials[0] || DEFAULT_MATERIALS[0];
    const uMat = materialsMap.get(levelPricingState.upper) || state.materials[1] || DEFAULT_MATERIALS[1];
    const tMat = materialsMap.get(levelPricingState.third) || state.materials[2] || DEFAULT_MATERIALS[2];

    const lCost = lArea * (lMat?.pricePerMeter || 0);
    const uCost = uArea * (uMat?.pricePerMeter || 0);
    const tCost = tArea * (tMat?.pricePerMeter || 0);

    const mCost = lCost + uCost + tCost;
    const aCost = (state.accessories || []).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const gCost = mCost + aCost;

    return {
      lowerArea: lArea,
      upperArea: uArea,
      thirdArea: tArea,
      grandTotalArea: gArea,
      lowerMaterial: lMat,
      upperMaterial: uMat,
      thirdMaterial: tMat,
      lowerCost: lCost,
      upperCost: uCost,
      thirdCost: tCost,
      materialsTotalCost: mCost,
      accessoriesCost: aCost,
      grandTotalCost: gCost,
    };
  }, [state.units, state.materials, state.accessories, levelPricingState, materialsMap]);

  // Unit Types
  const unitTypes = useMemo(() => {
    if (state.unitTypes && state.unitTypes.length > 0) return state.unitTypes;
    return [
      { key: 'standard', label: 'القطع العادية', multiplier: 1, rule: 'العرض × الارتفاع' },
      { key: 'drawer', label: 'الأدراج', multiplier: 2, rule: '(العرض × الارتفاع) × 2' },
      { key: 'glass', label: 'القطع الزجاجية', multiplier: 1.5, rule: '(العرض × الارتفاع) × 1.5' },
      { key: 'tall', label: 'الدواليب', multiplier: 1, rule: 'العرض × الارتفاع' },
      { key: 'lshape', label: 'القطعة حرف L', multiplier: 1, requiresLength: true, rule: '(العرض + الطول) × الارتفاع' },
      { key: 'side', label: 'الجوانب', multiplier: 0.7, rule: '(العرض × الارتفاع) × 0.70' },
    ];
  }, [state.unitTypes]);

  const selectedType = useMemo(
    () => unitTypes.find((t) => t.key === unitForm.type) || unitTypes[0],
    [unitTypes, unitForm.type]
  );
  const needsLength = Boolean(selectedType?.requiresLength);

  // Live preview for current input
  const preview = useMemo(() => {
    const rawW = parseFloat(unitForm.width);
    const rawH = parseFloat(unitForm.height);
    const rawL = parseFloat(unitForm.length);
    if (!selectedType || !(rawW > 0) || !(rawH > 0)) return null;
    if (needsLength && !(rawL > 0)) return null;

    const mFactor = unitForm.measurementUnit === 'cm' ? 0.01 : 1;
    const w = rawW * mFactor;
    const h = rawH * mFactor;
    const l = needsLength ? rawL * mFactor : 0;

    const baseArea = needsLength ? (w + l) * h : w * h;
    const area = baseArea * selectedType.multiplier;
    return { area };
  }, [unitForm.width, unitForm.height, unitForm.length, selectedType, needsLength, unitForm.measurementUnit]);

  // ---- Handlers ------------------------------------------------------------
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

  const handleTypeChange = (e) => {
    const type = e.target.value;
    const reqLength = unitTypes.find((t) => t.key === type)?.requiresLength;
    setUnitForm((prev) => ({ ...prev, type, length: reqLength ? prev.length : '' }));
  };

  const updateUnitForm = (field) => (e) =>
    setUnitForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Add Unit Handler (No Material Needed)
  const handleAddUnit = async (e) => {
    e?.preventDefault();
    if (addingUnit) return;

    const width = parseFloat(unitForm.width);
    const height = parseFloat(unitForm.height);
    const length = parseFloat(unitForm.length);

    if (!selectedType) return setError('يرجى اختيار نوع الوحدة.');
    if (!(width > 0) || !(height > 0)) return setError('يرجى إدخال عرض وارتفاع صحيحين أكبر من صفر.');
    if (needsLength && !(length > 0)) return setError('يرجى إدخال الطول للقطعة حرف L.');

    setAddingUnit(true);
    setError('');
    try {
      const data = await api('/api/units', {
        method: 'POST',
        body: JSON.stringify({
          name: unitForm.name.trim(),
          level: unitForm.level || 'lower',
          type: selectedType.key,
          width,
          height,
          ...(needsLength && { length }),
          measurementUnit: unitForm.measurementUnit,
        }),
      });

      setState(data.state);

      // Sticky height: keep height, reset width, name, and length
      setUnitForm((prev) => ({
        ...INITIAL_UNIT_FORM,
        level: prev.level,
        type: prev.type,
        measurementUnit: prev.measurementUnit,
        height: prev.height, // Sticky!
      }));
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingUnit(false);
      widthInputRef.current?.focus();
      setTimeout(() => widthInputRef.current?.focus(), 50);
    }
  };

  const handleDeleteUnit = async (unit) => {
    setDeletingKey(`unit-${unit.id}`);
    setError('');
    try {
      const data = await api(`/api/units/${unit.id}`, { method: 'DELETE' });
      setState(data.state);
      setSuccess(data.message || 'تم حذف الوحدة بنجاح');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleClearAllUnits = async () => {
    setClearingAll(true);
    setError('');
    try {
      const data = await api('/api/units', { method: 'DELETE' });
      setState(data.state);
      setSuccess(data.message || 'تم حذف جميع الوحدات بنجاح');
      setConfirmClearAllOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearingAll(false);
    }
  };

  const handleSaveEditUnit = async (form) => {
    const { id } = unitToEdit;
    setDeletingKey(`edit-unit-${id}`);
    setError('');
    try {
      const data = await api(`/api/units/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim(),
          level: form.level || 'lower',
          type: form.type,
          width: parseFloat(form.width),
          height: parseFloat(form.height),
          ...(form.type === 'lshape' && { length: parseFloat(form.length) }),
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

  // Add Custom Material
  const handleAddMaterial = async (e) => {
    e.preventDefault();
    const name = customMaterialForm.name.trim();
    const price = parseFloat(customMaterialForm.pricePerMeter);

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
      setCustomMaterialForm(INITIAL_CUSTOM_MATERIAL_FORM);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMaterial(false);
    }
  };

  // Edit Material
  const handleSaveEditMaterial = async (form) => {
    if (!materialToEdit) return;
    const name = form.name.trim();
    const price = parseFloat(form.pricePerMeter);

    if (!name) return setError('يرجى إدخال اسم الخامة.');
    if (!(price > 0)) return setError('يرجى إدخال سعر صحيح أكبر من صفر.');

    setEditingMaterial(true);
    setError('');
    try {
      const data = await api(`/api/materials/${materialToEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, pricePerMeter: price }),
      });
      setState(data.state);
      if (data.state.levelPricing) {
        setLevelPricingState(data.state.levelPricing);
      }
      setSuccess(data.message);
      setMaterialToEdit(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditingMaterial(false);
    }
  };

  // Delete Material
  const handleConfirmDeleteMaterial = async () => {
    if (!materialToDelete) return;
    setDeletingKey(`material-${materialToDelete.id}`);
    setError('');
    try {
      const data = await api(`/api/materials/${materialToDelete.id}`, { method: 'DELETE' });
      setState(data.state);
      if (data.state.levelPricing) {
        setLevelPricingState(data.state.levelPricing);
      }
      setSuccess(data.message);
      setMaterialToDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  // Change Level Material Assignment (Phase 3)
  const handleLevelMaterialChange = async (levelKey, materialId) => {
    // 1. Optimistic update for instant UI feedback
    const updatedPricing = { ...levelPricingState, [levelKey]: materialId };
    setLevelPricingState(updatedPricing);

    // 2. Persist to server
    try {
      const data = await api('/api/level-pricing', {
        method: 'PUT',
        body: JSON.stringify({ level: levelKey, materialId }),
      });
      setState(data.state);
    } catch (err) {
      setError(err.message);
    }
  };

  // Accessories
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

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!addingUnit) {
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  const defaultHeightForCurrentLevel = getDefaultHeight(unitForm.level, unitForm.measurementUnit);
  const heightPresets = STANDARD_HEIGHT_PRESETS[unitForm.measurementUnit] || STANDARD_HEIGHT_PRESETS.cm;
  const unitLabel = unitForm.measurementUnit === 'cm' ? 'سم' : 'م';

  // Filtered units
  const displayedUnits = useMemo(() => {
    const list = state.units || [];
    if (levelFilter === 'all') return list;
    return list.filter((u) => u.level === levelFilter);
  }, [state.units, levelFilter]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-wood-950 via-wood-900 to-wood-800 text-cream-50" dir="rtl">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-wood-800/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-40 h-[32rem] w-[32rem] rounded-full bg-wood-700/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[28rem] w-[28rem] rounded-full bg-amber-900/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-neutral-950/30" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-cream-50 ${GLASS_LIGHT}`}>
              <CalculatorIcon className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-cream-50 drop-shadow-sm sm:text-3xl">
                حاسبة تكلفة المطبخ
              </h1>
              <p className="text-sm text-cream-50/70 sm:text-base">
                إدخال حر للأبعاد والوحدات · تسعير مستقل وديناميكي لكل مستوى رأسي
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-cream-50 ${GLASS_LIGHT}`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            {loading ? 'جارٍ الاتصال…' : connected ? 'متصل' : 'غير متصل'}
            <span className="text-cream-50/40">·</span>
            <span className="text-amber-200/90 tabular-nums">
              {state.units.length} وحدة / {state.materials.length} خامة
            </span>
          </div>
        </header>

        {/* Alerts / Toasts */}
        <div className="mb-6 space-y-3" aria-live="polite">
          {error && (
            <div className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-950/50 px-4 py-3 text-cream-50 shadow-xl shadow-black/30 backdrop-blur-md">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
              <p className="flex-1 text-sm font-medium">{error}</p>
              <button onClick={() => setError('')} className="rounded-lg p-1 transition hover:bg-cream-50/15" aria-label="إغلاق">
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

        {/* =================================================================== */}
        {/* Top Feature: Grand Total Banner                                     */}
        {/* =================================================================== */}
        <div className="mb-8">
          <GrandTotalBanner
            grandTotalCost={grandTotalCost}
            grandTotalArea={grandTotalArea}
            totalUnits={state.units.length}
            lowerCost={lowerCost}
            upperCost={upperCost}
            thirdCost={thirdCost}
            accessoriesCost={accessoriesCost}
            loading={loading}
          />
        </div>

        {/* Main Grid: Sidebar (Right in RTL) + Main Content (Left in RTL) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ================================================================= */}
          {/* SIDEBAR: Rapid Unit Form + Materials Registry + Accessories       */}
          {/* ================================================================= */}
          <div className="space-y-6 lg:col-span-4">
            {/* 1. Rapid Unit Entry Form (Phase 1: No Material Needed) */}
            <Card>
              <CardHeader
                step="1"
                icon={<Icon name="cube" />}
                title="إضافة وحدة جديدة"
                subtitle="أدخل الأبعاد مباشرة دون الحاجة لاختيار خامة"
                accent="from-amber-700/60 to-wood-900/60"
              />

              <form onSubmit={handleAddUnit} className="space-y-4">
                {/* Level Selector */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-cream-50">مستوى الوحدة</label>
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

                {/* Measurement Unit Toggle */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-cream-50">وحدة القياس</label>
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

                {/* Unit Type Select */}
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

                {/* Unit Name Input */}
                <Field
                  id="unit-name"
                  label="اسم / وصف الوحدة"
                  type="text"
                  placeholder={selectedType ? `مثال: ${selectedType.label}` : 'وصف الوحدة'}
                  value={unitForm.name}
                  onChange={updateUnitForm('name')}
                  onKeyDown={handleInputKeyDown}
                  maxLength={60}
                />

                {/* Dimensions (Width + Height) */}
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

                  {/* Sticky / Default Height Helper + Quick Chips */}
                  <div className="rounded-2xl border border-cream-100/10 bg-black/25 p-3 text-xs backdrop-blur-md">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-cream-50/70">
                        الافتراضي لـ «{LEVEL_CONFIG[unitForm.level]?.label}»:
                      </span>
                      <button
                        type="button"
                        onClick={() => setUnitForm((p) => ({ ...p, height: String(defaultHeightForCurrentLevel) }))}
                        className="font-bold text-amber-200 hover:text-amber-100 underline decoration-dotted transition"
                        title="انقر لتطبيق الارتفاع الافتراضي"
                      >
                        {defaultHeightForCurrentLevel} {unitLabel}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-cream-100/10">
                      <span className="text-[11px] text-cream-50/60 font-medium">خيارات:</span>
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

                {/* L-Shape Length Input */}
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

                {/* Live Preview */}
                <div
                  className={`flex items-center justify-center gap-3 rounded-2xl border border-dashed p-3 text-center backdrop-blur-md transition-colors ${
                    preview ? 'border-cream-100/20 bg-cream-50/5' : 'border-cream-100/10 bg-black/20'
                  }`}
                >
                  <div>
                    <p className="text-xs text-cream-50/70">المساحة المتوقعة للوحدة</p>
                    <p className="font-bold text-cream-50 tabular-nums">
                      {preview ? fmt(preview.area, 4) : '—'} <span className="text-xs">م²</span>
                    </p>
                  </div>
                </div>

                <PrimaryButton id="add-unit-btn" type="submit" loading={addingUnit} disabled={loading || addingUnit}>
                  {!addingUnit && <Icon name="plus" className="h-5 w-5" />}
                  {addingUnit ? 'جارٍ الإضافة...' : 'إضافة الوحدة (Enter)'}
                </PrimaryButton>
              </form>
            </Card>

            {/* 2. Materials Registry & Custom Materials Management (Phase 2) */}
            <Card>
              <CardHeader
                step="2"
                icon={<Icon name="tag" />}
                title="كتالوج الخامات"
                subtitle="الخامات المتاحة وإضافة خامة مخصصة"
                accent="from-amber-600/60 to-wood-900/60"
              />

              {/* Predefined & Custom Catalog List */}
              <div className="mb-5 space-y-2">
                <p className="text-xs font-semibold text-cream-50/70">الخامات المتاحة في النظام:</p>
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-cream-100/10 bg-black/20 p-2">
                  {state.materials.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-cream-100/5 bg-black/25 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cream-50">{m.name}</span>
                          {m.isDefault ? (
                            <span className="rounded bg-cream-50/10 px-1.5 py-0.5 text-[10px] text-cream-50/60 font-medium">
                              افتراضية
                            </span>
                          ) : (
                            <span className="rounded bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 text-[10px] text-amber-200 font-semibold">
                              مخصصة
                            </span>
                          )}
                        </div>
                        <p className="text-amber-200/90 font-mono mt-0.5 tabular-nums">
                          {fmt(m.pricePerMeter)} {CURRENCY} / م²
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`تعديل الخامة ${m.name}`}
                          title={`تعديل الخامة ${m.name}`}
                          onClick={() => setMaterialToEdit(m)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-950/40 text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-900/60 hover:text-cream-50"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <DeleteButton
                          compact
                          label={`حذف الخامة ${m.name}`}
                          loading={deletingKey === `material-${m.id}`}
                          onClick={() => setMaterialToDelete(m)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Add Custom Material Form */}
              <form onSubmit={handleAddMaterial} className="space-y-3 border-t border-cream-100/10 pt-4">
                <p className="text-xs font-bold text-cream-50">إضافة خامة جديدة للكتالوج:</p>
                <Field
                  id="custom-mat-name"
                  label="اسم الخامة"
                  type="text"
                  placeholder="مثال: أكريليك تركي"
                  value={customMaterialForm.name}
                  onChange={(e) => setCustomMaterialForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={loading || addingMaterial}
                  maxLength={60}
                  required
                />
                <Field
                  id="custom-mat-price"
                  label="سعر المتر المربع"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="مثال: 6500"
                  suffix={`${CURRENCY} / م²`}
                  value={customMaterialForm.pricePerMeter}
                  onChange={(e) => setCustomMaterialForm((p) => ({ ...p, pricePerMeter: e.target.value }))}
                  disabled={loading || addingMaterial}
                  required
                />
                <PrimaryButton
                  type="submit"
                  loading={addingMaterial}
                  disabled={loading || addingMaterial}
                  tone="bg-amber-800/70 hover:bg-amber-700/70"
                >
                  {!addingMaterial && <Icon name="plus" className="h-4 w-4" />}
                  {addingMaterial ? 'جارٍ الحفظ...' : 'إضافة الخامة'}
                </PrimaryButton>
              </form>
            </Card>

            {/* 3. Accessories Card */}
            <AccessoriesCard
              state={state}
              loading={loading}
              onAdd={handleAddAccessory}
              onDelete={handleDeleteAccessory}
              deletingKey={deletingKey}
            />
          </div>

          {/* ================================================================= */}
          {/* MAIN CENTER: Summary Grid + Level Pricing Card + Units Table      */}
          {/* ================================================================= */}
          <div className="space-y-6 lg:col-span-8">
            {/* 1. Summary Grid (4 Cards: Lower, Upper, Third, Grand Total Area) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {/* Lower Area */}
              <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/40 via-black/30 to-black/40 p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="text-xs font-semibold text-sky-200">مساحة السفلي</span>
                </div>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-cream-50">
                  {fmt(lowerArea, 3)} <span className="text-xs font-medium text-cream-50/60">م²</span>
                </p>
                <span className="text-[11px] text-cream-50/50 block mt-1">
                  {state.units.filter((u) => u.level === 'lower').length} وحدة سفلية
                </span>
              </div>

              {/* Upper Area */}
              <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-black/30 to-black/40 p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-amber-200">مساحة العلوي</span>
                </div>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-cream-50">
                  {fmt(upperArea, 3)} <span className="text-xs font-medium text-cream-50/60">م²</span>
                </p>
                <span className="text-[11px] text-cream-50/50 block mt-1">
                  {state.units.filter((u) => u.level === 'upper').length} وحدة علوية
                </span>
              </div>

              {/* Third Area */}
              <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-950/40 via-black/30 to-black/40 p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-xs font-semibold text-purple-200">المستوى الثالث</span>
                </div>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-cream-50">
                  {fmt(thirdArea, 3)} <span className="text-xs font-medium text-cream-50/60">م²</span>
                </p>
                <span className="text-[11px] text-cream-50/50 block mt-1">
                  {state.units.filter((u) => u.level === 'third').length} وحدة ثالث
                </span>
              </div>

              {/* Grand Total Area */}
              <div className="rounded-2xl border border-cream-100/20 bg-gradient-to-br from-wood-800/50 via-black/40 to-black/50 p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-cream-50" />
                  <span className="text-xs font-bold text-cream-50">إجمالي المساحة</span>
                </div>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-amber-300">
                  {fmt(grandTotalArea, 3)} <span className="text-xs font-medium text-cream-50/60">م²</span>
                </p>
                <span className="text-[11px] text-cream-50/50 block mt-1">
                  إجمالي {state.units.length} وحدة
                </span>
              </div>
            </div>

            {/* 2. Level-Based Pricing & Cost Calculation (Phase 3: 3 Dedicated Cards) */}
            <Card>
              <CardHeader
                icon={<Icon name="layers" />}
                title="تسعير وتخصيص خامات المستويات"
                subtitle="حدد خامة وسعر المتر لكل مستوى رأسي لحساب التكلفة تلقائياً"
                accent="from-amber-700/60 to-wood-950/60"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 1. Lower Level Row/Card */}
                <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/30 to-black/35 p-4 shadow-md backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-900/60 text-sky-200">
                          <LevelIcon level="lower" className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-sky-200">المستوى السفلي</h3>
                          <span className="text-[10px] text-cream-50/50">Base Cabinets</span>
                        </div>
                      </div>
                      <span className="rounded-lg border border-sky-400/20 bg-sky-950/50 px-2 py-0.5 text-xs font-bold text-sky-200 tabular-nums">
                        {fmt(lowerArea, 3)} م²
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <label htmlFor="lower-material-select" className="text-xs text-cream-50/70 font-semibold block">
                        الخامة المخصصة للسفلي:
                      </label>
                      <select
                        id="lower-material-select"
                        value={levelPricingState.lower}
                        onChange={(e) => handleLevelMaterialChange('lower', e.target.value)}
                        className={`${INPUT_BASE} py-2 text-xs`}
                      >
                        {state.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {fmt(m.pricePerMeter)} {CURRENCY}/م²
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-400/10 bg-black/30 p-2.5 text-xs">
                    <div className="flex justify-between items-center text-cream-50/70 text-[11px] mb-1">
                      <span>حسبة السفلي:</span>
                      <span>{fmt(lowerArea, 2)} م² × {fmt(lowerMaterial?.pricePerMeter)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-cream-100/10 font-bold">
                      <span className="text-cream-50/80">المجموع الفرعي:</span>
                      <span className="text-base text-sky-300 tabular-nums font-black">
                        {fmt(lowerCost)} <span className="text-xs font-normal text-cream-50/60">{CURRENCY}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Upper Level Row/Card */}
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-black/35 p-4 shadow-md backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-900/60 text-amber-200">
                          <LevelIcon level="upper" className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-amber-200">المستوى العلوي</h3>
                          <span className="text-[10px] text-cream-50/50">Wall Cabinets</span>
                        </div>
                      </div>
                      <span className="rounded-lg border border-amber-400/20 bg-amber-950/50 px-2 py-0.5 text-xs font-bold text-amber-200 tabular-nums">
                        {fmt(upperArea, 3)} م²
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <label htmlFor="upper-material-select" className="text-xs text-cream-50/70 font-semibold block">
                        الخامة المخصصة للعلوي:
                      </label>
                      <select
                        id="upper-material-select"
                        value={levelPricingState.upper}
                        onChange={(e) => handleLevelMaterialChange('upper', e.target.value)}
                        className={`${INPUT_BASE} py-2 text-xs`}
                      >
                        {state.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {fmt(m.pricePerMeter)} {CURRENCY}/م²
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-400/10 bg-black/30 p-2.5 text-xs">
                    <div className="flex justify-between items-center text-cream-50/70 text-[11px] mb-1">
                      <span>حسبة العلوي:</span>
                      <span>{fmt(upperArea, 2)} م² × {fmt(upperMaterial?.pricePerMeter)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-cream-100/10 font-bold">
                      <span className="text-cream-50/80">المجموع الفرعي:</span>
                      <span className="text-base text-amber-300 tabular-nums font-black">
                        {fmt(upperCost)} <span className="text-xs font-normal text-cream-50/60">{CURRENCY}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Third Level Row/Card */}
                <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-950/30 to-black/35 p-4 shadow-md backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-900/60 text-purple-200">
                          <LevelIcon level="third" className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-purple-200">المستوى الثالث</h3>
                          <span className="text-[10px] text-cream-50/50">Loft Cabinets</span>
                        </div>
                      </div>
                      <span className="rounded-lg border border-purple-400/20 bg-purple-950/50 px-2 py-0.5 text-xs font-bold text-purple-200 tabular-nums">
                        {fmt(thirdArea, 3)} م²
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <label htmlFor="third-material-select" className="text-xs text-cream-50/70 font-semibold block">
                        الخامة المخصصة للثالث:
                      </label>
                      <select
                        id="third-material-select"
                        value={levelPricingState.third}
                        onChange={(e) => handleLevelMaterialChange('third', e.target.value)}
                        className={`${INPUT_BASE} py-2 text-xs`}
                      >
                        {state.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {fmt(m.pricePerMeter)} {CURRENCY}/م²
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-400/10 bg-black/30 p-2.5 text-xs">
                    <div className="flex justify-between items-center text-cream-50/70 text-[11px] mb-1">
                      <span>حسبة الثالث:</span>
                      <span>{fmt(thirdArea, 2)} م² × {fmt(thirdMaterial?.pricePerMeter)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-cream-100/10 font-bold">
                      <span className="text-cream-50/80">المجموع الفرعي:</span>
                      <span className="text-base text-purple-300 tabular-nums font-black">
                        {fmt(thirdCost)} <span className="text-xs font-normal text-cream-50/60">{CURRENCY}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. Units Table */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-wood-800/60 text-cream-50">
                    <Icon name="ruler" className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-cream-50">جدول وحدات المطبخ</h2>
                    <p className="text-xs text-cream-50/70">
                      قائمة القطع المضافة وإحصائياتها وتكلفتها التقديرية
                    </p>
                  </div>
                </div>

                {/* Actions & Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  {state.units.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAllOpen(true)}
                      disabled={clearingAll}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/20 bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-900/60 hover:text-cream-50 focus:outline-none disabled:opacity-50"
                      title="حذف جميع وحدات المطبخ دفعة واحدة"
                    >
                      {clearingAll ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="trash" className="h-3.5 w-3.5" />}
                      <span>حذف الكل</span>
                    </button>
                  )}

                  {/* Filter buttons */}
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
                      الكل ({state.units.length})
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
                      سفلية ({state.units.filter((u) => u.level === 'lower').length})
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
                      علوية ({state.units.filter((u) => u.level === 'upper').length})
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
                      مستوى ثالث ({state.units.filter((u) => u.level === 'third').length})
                    </button>
                  </div>
                </div>
              </div>

              {state.units.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cream-100/10 bg-black/10 py-12 text-center">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cream-100/10 bg-cream-50/5 text-cream-50/60 backdrop-blur-md">
                    <Icon name="cube" className="h-7 w-7" />
                  </span>
                  <p className="font-bold text-cream-50">لا توجد وحدات مضافة بعد</p>
                  <p className="mt-1 text-sm text-cream-50/60">
                    استخدم نموذج «إضافة وحدة جديدة» لبدء إدخال مقاسات المطبخ بسرعة
                  </p>
                </div>
              ) : displayedUnits.length === 0 ? (
                <div className="py-8 text-center text-sm text-cream-50/60">
                  لا توجد وحدات مضافة تحت مستوى «{LEVEL_CONFIG[levelFilter]?.label || levelFilter}».
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-cream-100/10 bg-black/15">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-cream-100/10 bg-black/20 text-xs text-cream-50/70">
                        <th className="px-3 py-3 text-right font-semibold">#</th>
                        <th className="px-3 py-3 text-right font-semibold">الوحدة والمستوى</th>
                        <th className="px-3 py-3 text-right font-semibold">الأبعاد</th>
                        <th className="px-3 py-3 text-right font-semibold">المعادلة</th>
                        <th className="px-3 py-3 text-right font-semibold">المساحة</th>
                        <th className="px-3 py-3 text-right font-semibold">الخامة والتكلفة المقدرة</th>
                        <th className="px-3 py-3" aria-label="إجراءات" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100/[0.06]">
                      {displayedUnits.map((unit, i) => {
                        const deletingUnit = deletingKey === `unit-${unit.id}`;
                        const unitLevel = unit.level || 'lower';
                        const assignedMat =
                          unitLevel === 'upper'
                            ? upperMaterial
                            : unitLevel === 'third'
                            ? thirdMaterial
                            : lowerMaterial;
                        const unitEstimatedCost = (unit.area || 0) * (assignedMat?.pricePerMeter || 0);

                        return (
                          <tr
                            key={unit.id}
                            className={`animate-fade-in-up transition-colors hover:bg-cream-50/[0.04] ${
                              deletingUnit ? 'pointer-events-none opacity-50' : ''
                            }`}
                          >
                            <td className="px-3 py-3 font-bold text-cream-50/50 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-3">
                              <p className="max-w-[12rem] truncate font-bold text-cream-50">{unit.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <LevelBadge level={unitLevel} />
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
                              <p dir="ltr" className="mt-1 text-right font-mono text-[11px] text-cream-50/50">
                                {unit.calculation}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className="rounded-lg border border-sky-400/15 bg-sky-950/40 px-2 py-1 text-xs font-bold text-sky-200 tabular-nums">
                                {fmt(unit.area, 4)} م²
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <p className="text-xs font-bold text-cream-50">{assignedMat?.name}</p>
                              <p className="text-[11px] text-amber-200 font-mono mt-0.5 tabular-nums">
                                {fmt(unitEstimatedCost)} {CURRENCY}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-left">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setUnitToEdit(unit)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-950/40 text-sky-200 hover:bg-sky-900/60 hover:text-cream-50 transition"
                                  title="تعديل"
                                >
                                  <Icon name="edit" className="h-4 w-4" />
                                </button>
                                <DeleteButton
                                  compact
                                  loading={deletingUnit}
                                  label={`حذف ${unit.name}`}
                                  onClick={() => handleDeleteUnit(unit)}
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
                          إجمالي الوحدات المعروضة ({displayedUnits.length} وحدة)
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sky-200 tabular-nums font-black">
                          {fmt(displayedUnits.reduce((s, u) => s + (u.area || 0), 0), 4)} م²
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {unitToEdit && (
        <EditUnitModal
          unit={unitToEdit}
          isOpen={Boolean(unitToEdit)}
          onClose={() => setUnitToEdit(null)}
          onSave={handleSaveEditUnit}
          loading={deletingKey === `edit-unit-${unitToEdit.id}`}
        />
      )}

      {/* Edit Material Modal */}
      {materialToEdit && (
        <EditMaterialModal
          material={materialToEdit}
          isOpen={Boolean(materialToEdit)}
          onClose={() => setMaterialToEdit(null)}
          onSave={handleSaveEditMaterial}
          loading={editingMaterial}
        />
      )}

      {/* Confirm Delete Material Modal */}
      <ConfirmModal
        isOpen={Boolean(materialToDelete)}
        title="حذف خامة من الكتالوج"
        description={`هل أنت متأكد من حذف خامة "${materialToDelete?.name}" (${fmt(materialToDelete?.pricePerMeter)} ${CURRENCY}/م²)؟ إذا كانت هذه الخامة مخصصة لأي مستوى من مستويات المطبخ، سيتم تحويله تلقائياً لأقرب خامة أخرى متاحة.`}
        confirmText="نعم، حذف الخامة"
        cancelText="إلغاء"
        loading={deletingKey === `material-${materialToDelete?.id}`}
        onConfirm={handleConfirmDeleteMaterial}
        onCancel={() => setMaterialToDelete(null)}
      />

      {/* Confirm Clear All Modal */}
      <ConfirmModal
        isOpen={confirmClearAllOpen}
        title="حذف جميع الوحدات"
        description="هل أنت متأكد من رغبتك في مسح كافة وحدات المطبخ دفعة واحدة؟ سيتم تصفير جدول المقاسات وتصفير حسابات المساحة بالكامل ولا يمكن التراجع عن هذا الإجراء."
        confirmText="نعم، حذف الكل"
        cancelText="إلغاء"
        loading={clearingAll}
        onConfirm={handleClearAllUnits}
        onCancel={() => setConfirmClearAllOpen(false)}
      />
    </main>
  );
}
