import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { CourseForm } from './CourseForm';
import { useCreateCourse } from '../../hooks/useCourses';

export function NewCoursePage() {
  const navigate = useNavigate();
  const create = useCreateCourse();
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Nuovo corso" subtitle="Compila i dati del corso accademico" />
      <CourseForm
        submitLabel="Crea corso"
        onCancel={() => navigate(-1)}
        onSubmit={async (data) => {
          const c = await create.mutateAsync(data);
          navigate(`/corsi/${c.id}`, { replace: true });
        }}
      />
    </div>
  );
}
