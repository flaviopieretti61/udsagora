import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { MemberForm } from './MemberForm';
import { useCreateMember } from '../../hooks/useMembers';

export function NewMemberPage() {
  const create = useCreateMember();
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Nuovo socio" subtitle="Compila l'anagrafica del nuovo socio" />
      <MemberForm
        submitLabel="Crea socio"
        onCancel={() => navigate(-1)}
        onSubmit={async (data) => {
          const created = await create.mutateAsync(data);
          navigate(`/soci/${created.id}`, { replace: true });
        }}
      />
    </div>
  );
}
