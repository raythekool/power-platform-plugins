// Formattazione dei valori come nel prototipo: etichette delle choice, valuta, numeri, date.
import type { Field } from '../generated/screens';

const LOCALE = 'it-IT';

export function datetimeInputValue(value: unknown, field: Field): string {
  if (!value) return '';
  if (field.format === 'DateOnly' || field.behavior === 'DateOnly') return String(value).slice(0, 10);
  if (field.behavior === 'TimeZoneIndependent') return String(value).replace(/(Z|[+-]\d{2}:\d{2})$/, '');
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
}

export function datetimePatch(value: string, field: Field): string | null {
  if (!value) return null;
  if (field.format === 'DateOnly' || field.behavior === 'DateOnly') return value;
  // TimeZoneIndependent conserva l'ora di calendario; UserLocal converte l'ora locale in UTC.
  return field.behavior === 'TimeZoneIndependent' ? `${value}Z` : new Date(value).toISOString();
}

export function fmt(value: unknown, field?: Field): string {
  if (value === undefined || value === null || value === '') return '';
  const option = field?.options?.find((o) => String(o.value) === String(value));
  if (option) return option.label;
  if (field?.control === 'boolean' || typeof value === 'boolean') return value === true || value === 'true' ? 'Sì' : 'No';
  if (field?.control === 'money' && typeof value === 'number') return value.toLocaleString(LOCALE, { style: 'currency', currency: 'EUR' });
  if (typeof value === 'number') return value.toLocaleString(LOCALE);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(LOCALE);
  }
  return String(value);
}
