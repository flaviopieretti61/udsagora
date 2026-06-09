import { useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '../../components/PageHeader';
import { CategoriesPanel } from './CategoriesPanel';
import { AcademicYearsPanel } from './AcademicYearsPanel';
import { FeesPanel } from './FeesPanel';

type Tab = 'categorie' | 'anni' | 'quote';

export function ConfigurationPage() {
  const [tab, setTab] = useState<Tab>('categorie');
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Configurazione" subtitle="Categorie, anni accademici e quote" />
      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <TabButton current={tab} value="categorie" onClick={setTab}>
          Categorie socio
        </TabButton>
        <TabButton current={tab} value="anni" onClick={setTab}>
          Anni accademici
        </TabButton>
        <TabButton current={tab} value="quote" onClick={setTab}>
          Quote tessera
        </TabButton>
      </div>
      {tab === 'categorie' && <CategoriesPanel />}
      {tab === 'anni' && <AcademicYearsPanel />}
      {tab === 'quote' && <FeesPanel />}
    </div>
  );
}

function TabButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Tab;
  value: Tab;
  onClick: (t: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className={clsx(
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
        current === value
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-slate-500 hover:text-slate-800',
      )}
    >
      {children}
    </button>
  );
}
