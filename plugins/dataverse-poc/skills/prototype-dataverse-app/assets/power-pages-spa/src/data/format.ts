// Formattazione dei valori come nel prototipo: etichette delle choice, valuta, numeri, date.
import type { Field } from '../generated/screens';

const LOCALE = 'it-IT';

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
