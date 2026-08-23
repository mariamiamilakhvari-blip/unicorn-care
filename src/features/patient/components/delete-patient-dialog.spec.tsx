import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DeletePatientDialog } from '@/features/patient/components/delete-patient-dialog';

/** Copy is asserted elsewhere; here the key itself is the stable thing to query on. */
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const PATIENT = '65f1a2b3c4d5e6f7a8b9c0d1';

function open(patientName: string, onDelete = vi.fn().mockResolvedValue(undefined)) {
  render(
    <DeletePatientDialog patientId={PATIENT} patientName={patientName} onDelete={onDelete} />
  );
  fireEvent.click(screen.getByRole('button', { name: /delete/ }));
  return onDelete;
}

const confirmButton = () =>
  screen.getAllByRole('button', { name: /delete/ }).at(-1) as HTMLButtonElement;

function type(value: string) {
  fireEvent.change(screen.getByLabelText('deleteConfirmLabel'), { target: { value } });
}

describe('DeletePatientDialog', () => {
  it('stays disabled until the name is typed', () => {
    open('Lika Beridze');

    expect(confirmButton()).toBeDisabled();
    type('Lika');
    expect(confirmButton()).toBeDisabled();
  });

  it('enables and sends the confirmation once the name matches', async () => {
    const onDelete = open('Lika Beridze');

    type('Lika Beridze');
    expect(confirmButton()).not.toBeDisabled();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(PATIENT, 'Lika Beridze'));
  });

  /*
    The reported failure. A stored `"Lika "` renders identically to `"Lika"`, so the clinic types
    what the screen shows and an exact comparison rejects it — leaving a disabled button, which
    `disabled:pointer-events-none` makes silently unclickable.
  */
  it('accepts the visible name when the record carries a doubled space', () => {
    open('Lika  Beridze');

    type('Lika Beridze');
    expect(confirmButton()).not.toBeDisabled();
  });

  it('still refuses a different case', () => {
    open('Lika Beridze');

    type('lika beridze');
    expect(confirmButton()).toBeDisabled();
  });

  /* A refused delete used to reject into nothing, which looks exactly like a broken button. */
  it('names a refusal from the API instead of failing silently', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('CONFIRMATION_MISMATCH'));
    open('Lika Beridze', onDelete);

    type('Lika Beridze');
    fireEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'deleteError.CONFIRMATION_MISMATCH'
    );
  });

  it('falls back to a generic message for anything unrecognised', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('INTERNAL_ERROR'));
    open('Lika Beridze', onDelete);

    type('Lika Beridze');
    fireEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('deleteError.GENERIC');
  });

  it('closes on success, so the reloaded list is what the clinic sees next', async () => {
    open('Lika Beridze');

    type('Lika Beridze');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
