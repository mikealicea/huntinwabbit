import type { Company } from './companies.schemas.ts';
export function companyNameKey(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
export function companyDomain(website: string | null) {
  if (!website) return null;
  try {
    const url = new URL(website);
    return ['https:', 'http:'].includes(url.protocol)
      ? url.hostname.toLowerCase().replace(/^www\./, '')
      : null;
  } catch {
    return null;
  }
}
function tokens(name: string) {
  return companyNameKey(name)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(
      (v) =>
        v &&
        ![
          'inc',
          'incorporated',
          'llc',
          'ltd',
          'limited',
          'corp',
          'corporation',
          'company',
          'co',
        ].includes(v),
    );
}
export function compatibleNames(a: string, b: string) {
  const x = tokens(a).join(' ');
  return Boolean(x) && x === tokens(b).join(' ');
}
export function matchCompany(
  companies: Company[],
  name: string,
  website: string | null,
) {
  const domain = companyDomain(website);
  // Reuse a previously created ambiguous-name profile for identical evidence.
  // Otherwise repeated refreshes could create another empty-domain duplicate.
  const exact = companies.filter(
    (company) =>
      companyNameKey(company.name) === companyNameKey(name) &&
      companyDomain(company.website) === domain,
  );
  if (exact.length === 1) return exact[0];
  const matches = companies.filter((company) => {
    const other = companyDomain(company.website);
    if (domain && other && domain !== other) return false;
    return (
      companyNameKey(company.name) === companyNameKey(name) ||
      Boolean(domain && domain === other && compatibleNames(company.name, name))
    );
  });
  return matches.length === 1 ? matches[0] : undefined;
}
export function shortlistCompanies(companies: Company[], text: string) {
  const normalized = companyNameKey(text);
  return companies
    .map((company) => {
      const domain = companyDomain(company.website);
      const name = companyNameKey(company.name);
      const score =
        (domain && normalized.includes(domain) ? 100 : 0) +
        (normalized.includes(name) ? 50 : 0) +
        tokens(name).filter(
          (token) =>
            token.length > 2 &&
            new RegExp(
              `(?:^|[^\\p{L}\\p{N}])${token}(?:$|[^\\p{L}\\p{N}])`,
              'u',
            ).test(normalized),
        ).length;
      return { company, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.company.id.localeCompare(b.company.id),
    )
    .slice(0, 20)
    .map(({ company }) => company);
}
