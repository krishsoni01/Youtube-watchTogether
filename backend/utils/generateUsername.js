const generateUsername = (user) => {
  let name =
    user.name?.givenName ||
    user.displayName ||
    user.emails[0].value.split("@")[0];

  // Remove any non-ASCII characters and special characters
  let sanitized = name
    .normalize("NFD") // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
    .replace(/[^a-zA-Z0-9]/g, "") // Keep only alphanumeric
    .toLowerCase()
    .trim();

  // If sanitization results in empty string, use fallback
  if (!sanitized || sanitized.length === 0) {
    sanitized = "user";
  }

  // Limit length to reasonable size
  if (sanitized.length > 20) {
    sanitized = sanitized.substring(0, 20);
  }

  // Generate 4 random digits
  const randomDigits = Math.floor(1000 + Math.random() * 9000);

  return `${sanitized}-${randomDigits}`;
};

module.exports = generateUsername;