function cleanReview(body) {
  const source = body && typeof body === 'object' ? body : {};
  if (String(source.website || '').trim()) return { ignored: true };
  const authorName = String(source.authorName || '').trim().slice(0, 80);
  const company = String(source.company || '').trim().slice(0, 100);
  const role = String(source.role || '').trim().slice(0, 80);
  const message = String(source.message || '').trim().slice(0, 1000);
  const rating = Number(source.rating);
  if (authorName.length < 2 || company.length < 2 || message.length < 20 || !Number.isInteger(rating) || rating < 1 || rating > 5 || source.consent !== true) return null;
  return { authorName, company, role, message, rating };
}

module.exports = { cleanReview };
