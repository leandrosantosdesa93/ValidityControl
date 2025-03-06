export function generateProductCode(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PROD-${random}`;
}