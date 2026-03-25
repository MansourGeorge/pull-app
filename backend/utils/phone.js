const LEBANON_PHONE_REGEX = /^\+961[1-9]\d{6,7}$/;

const normalizeLebanesePhone = (value) => String(value || '').trim().replace(/[\s()-]/g, '');

const isValidLebanesePhone = (value) => LEBANON_PHONE_REGEX.test(normalizeLebanesePhone(value));

module.exports = {
  LEBANON_PHONE_REGEX,
  normalizeLebanesePhone,
  isValidLebanesePhone
};
