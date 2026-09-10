import { PageHeader } from '@/components/PageHeader';
import { QaBox } from '@/components/QaBox';

export const dynamic = 'force-dynamic';

export default function AskPage() {
  return (
    <>
      <PageHeader
        title="Ask"
        subtitle="Questions answered only from the rule texts held here, always with the citation."
      />
      <div className="p-6">
        <div className="max-w-3xl">
          <QaBox />
        </div>
      </div>
    </>
  );
}
