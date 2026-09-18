'use client';

import {
  type Opportunity,
  selectCompany,
  selectCompanyRoleCount,
} from '@/features/job-search/job-search.index';

import { useAppSelector } from '@/state/state.index';

export function CompanyContext({ role }: { role: Opportunity }) {
  const company = useAppSelector((state) =>
    selectCompany(state, role.companyId),
  );
  const roleCount = useAppSelector((state) =>
    selectCompanyRoleCount(state, role.companyId),
  );
  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm"
      aria-labelledby="company-title"
    >
      <div className="card-body gap-4 p-5 sm:p-6">
        <div>
          <h2 id="company-title" className="card-title">
            {company ? `${company.name} · Company` : 'Company context'}
          </h2>
          <p className="mt-1 text-sm text-base-content/75">
            Shared research & contacts
          </p>
        </div>
        {!company ? (
          <p className="text-sm text-base-content/75">
            Company unknown. A source hostname does not identify the employer.
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed">
              {company.research || 'Company research not started.'}
            </p>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Contacts</h3>
              {company.contacts.length ? (
                <ul className="space-y-2">
                  {company.contacts.map((contact) => (
                    <li key={contact.id} className="text-sm">
                      {contact.name}
                      <span className="text-base-content/75">
                        {' '}
                        · {contact.relationship}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-base-content/75">
                  No contacts saved yet.
                </p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Interview loop</h3>
              <p className="text-sm text-base-content/75">
                {company.interviewLoop || 'Interview loop not recorded.'}
              </p>
            </div>
            <p className="border-t border-base-300 pt-3 text-sm text-base-content/75">
              {roleCount} saved roles at this company
            </p>
          </>
        )}
      </div>
    </section>
  );
}
