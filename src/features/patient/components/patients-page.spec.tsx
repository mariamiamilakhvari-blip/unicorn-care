import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/** Copy is asserted elsewhere; here the key itself is the stable thing to query on. */
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/features/patient/hooks/use-patients', () => ({ usePatients: vi.fn() }));
vi.mock('@/features/clinic/hooks/use-subscription', () => ({ useSubscription: vi.fn() }));

/*
  The real form is a dozen fields and seven consent boxes, and none of that is what these
  assertions are about — they are about where the clinic lands once it submits. The probe stands
  in for a filled-in, consented form: one button that hands the page a valid payload.
*/
vi.mock('@/features/patient/components/patient-form', () => ({
  PatientForm: ({
    onSubmit,
    isPending,
  }: {
    onSubmit: (values: CreatePatientType) => void;
    isPending: boolean;
  }) => (
    <button type="button" disabled={isPending} onClick={() => onSubmit(INTAKE)}>
      submitIntake
    </button>
  ),
}));

vi.mock('@/features/patient/components/patient-list', () => ({
  PatientList: () => <div data-testid="list" />,
}));

import { useSubscription } from '@/features/clinic/hooks/use-subscription';
import { PatientsPage } from '@/features/patient/components/patients-page';
import { usePatients } from '@/features/patient/hooks/use-patients';
import { PatientSummary } from '@/features/patient/types/patient.types';
import { CreatePatientType } from '@/features/patient/validations/patient.validation';

const patientsHook = vi.mocked(usePatients);
const subscriptionHook = vi.mocked(useSubscription);

const NEW_ID = '65f1a2b3c4d5e6f7a8b9c0d1';

const INTAKE = { firstName: 'Lika', lastName: 'Beridze' } as CreatePatientType;

const CREATED = { id: NEW_ID, firstName: 'Lika', lastName: 'Beridze' } as PatientSummary;

function open(create = vi.fn().mockResolvedValue(CREATED)) {
  push.mockClear();
  patientsHook.mockReturnValue({
    patients: [],
    isLoading: false,
    hasError: false,
    reload: vi.fn(),
    create,
    remove: vi.fn(),
  });
  subscriptionHook.mockReturnValue({ subscription: null } as ReturnType<typeof useSubscription>);

  render(<PatientsPage />);
  // The form is behind the "add patient" toggle, exactly as a clinician finds it.
  fireEvent.click(screen.getByRole('button', { name: 'createPatient' }));
  return create;
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'submitIntake' }));

/**
 * Registering a patient is the first half of a job. The procedure and the care plan are the rest,
 * and they live on that patient's own page — so intake ends there rather than back on the list,
 * where the clinic had to find the row it had just created.
 */
describe('PatientsPage — where intake ends', () => {
  it('goes to the new patient’s page once the server has created them', async () => {
    open();

    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/dashboard/patients/${NEW_ID}`));
  });

  /* The id comes from the response body, so it has to be the server's and not the form's. */
  it('navigates to the id the server returned', async () => {
    const other = '65f1a2b3c4d5e6f7a8b9c0ff';
    open(vi.fn().mockResolvedValue({ ...CREATED, id: other }));

    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/dashboard/patients/${other}`));
  });

  it('sends what the form collected to the server', async () => {
    const create = open();

    submit();

    await waitFor(() => expect(create).toHaveBeenCalledWith(INTAKE));
  });
});

/**
 * A refused write is an answer, not a crash. The clinic stays put with the typed details intact,
 * because there is no patient to navigate to and the form is the thing that needs correcting.
 */
describe('PatientsPage — when the write is refused', () => {
  const refuse = () => open(vi.fn().mockRejectedValue(new Error('SUBSCRIPTION_INACTIVE')));

  it('does not navigate', async () => {
    const create = refuse();

    submit();

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it('reports the refusal and leaves the form open', async () => {
    refuse();

    submit();

    await screen.findByText('writeError.SUBSCRIPTION_INACTIVE.title');
    expect(screen.getByRole('button', { name: 'submitIntake' })).toBeInTheDocument();
  });

  /*
    The submit button comes back only on a refusal. On success it stays disabled through the push:
    re-enabling it for the moment the next route takes to load is long enough for a second click,
    and a second click there registers a second patient.
  */
  it('re-enables submitting so the clinic can correct and retry', async () => {
    refuse();

    submit();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'submitIntake' })).not.toBeDisabled()
    );
  });

  it('keeps the submit button disabled after a successful create', async () => {
    open();

    submit();

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'submitIntake' })).not.toBeInTheDocument();
  });
});
