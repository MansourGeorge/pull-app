export const LEBANON_PHONE_PATTERN = '^\\+961[1-9]\\d{6,7}$';

export const normalizeLebanesePhone = (value) => String(value || '').trim().replace(/[\s()-]/g, '');

export const isValidLebanesePhone = (value) => /^\+961[1-9]\d{6,7}$/.test(normalizeLebanesePhone(value));
