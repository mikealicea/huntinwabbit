import { jobSchema } from '../job-parsing/job-parsing.index.ts';
import {
  applicationSchema,
  type EditableFields,
  editableFieldsSchema,
  type FieldName,
  postingFieldsSchema,
  type SavedPosting,
} from './job-postings.schemas.ts';

export function effectiveFields(item: SavedPosting): EditableFields {
  const empty = jobSchema.parse({
    company: { name: null, website: null },
    title: null,
    locations: [],
    workArrangement: null,
    employmentType: null,
    description: null,
    responsibilities: [],
    requirements: [],
    preferredQualifications: [],
    benefits: [],
    compensation: [],
    postingId: null,
    publishedDate: null,
    closingDate: null,
  });
  const { company, ...job } = item.parsedPosting?.job ?? empty;
  return editableFieldsSchema.parse({
    ...job,
    companyName: company.name,
    companyWebsite: company.website,
    ...item.edits?.overrides,
    ...item.application,
    sourceUrl: item.sourceUrl,
  });
}
export function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function writeField(
  item: SavedPosting,
  field: FieldName,
  value: unknown,
) {
  const valid = editableFieldsSchema.shape[field].parse(value);
  const edits = item.edits ?? { overrides: {}, revisions: {}, pending: null };
  item.edits = edits;
  if (field === 'sourceUrl') {
    item.sourceUrl = String(valid);
    item.extraction = {
      status: 'not-requested',
      generation: null,
      error: null,
    };
  } else if (field in applicationSchema.shape) {
    item.application = applicationSchema.parse({
      ...item.application,
      [field]: valid,
    });
  } else {
    edits.overrides = postingFieldsSchema
      .partial()
      .parse({ ...edits.overrides, [field]: valid });
  }
  edits.revisions[field] = item.recordVersion + 1;
}
