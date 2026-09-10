import { EMPLOYEE_CSV_TEMPLATE } from '@/lib/bundled-text';

/** Serves the blank-ish CSV template so a company knows the expected columns. */
export async function GET() {
  return new Response(EMPLOYEE_CSV_TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="compass-ifsc-employee-template.csv"',
    },
  });
}
