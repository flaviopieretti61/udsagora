interface Props {
  title: string;
  phase: string;
}

export function PlaceholderPage({ title, phase }: Props) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">In arrivo nella {phase}.</p>
    </div>
  );
}
