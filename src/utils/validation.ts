// Validation utilities placeholder

export const validateMobileNumber = (mobileNumber: string): boolean => {
  // TODO: Implement mobile number validation
  return /^\+[1-9]\d{1,14}$/.test(mobileNumber);
};

export const validateAlias = (alias: string): boolean => {
  // TODO: Implement alias validation
  return alias.length >= 3 && /^[a-zA-Z0-9_]+$/.test(alias);
};

export const validateAmount = (amount: number): boolean => {
  // TODO: Implement amount validation
  return amount > 0 && amount <= 500;
};
