import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClinicTaxIdField } from '@/features/clinic/components/clinic-tax-id-field';
import { http } from '@/shared/lib/http';

vi.mock('@/shared/lib/http', () => ({ http: { get: vi.fn() } }));

/** Copy is asserted elsewhere; here the key itself is the stable thing to query on. */
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const httpGet = vi.mocked(http.get);

const COMPANY = {
  taxId: '204378869',
  legalName: 'სს საქართველოს ბანკი',
  address: '',
  city: '',
  status: 'active' as const,
};

type Fields = { taxId: string; name: string; addressLine: string; city: string };

/** The smallest form that satisfies the component: a provider, a control and the four fields. */
function Harness() {
  const form = useForm<Fields>({
    defaultValues: { taxId: '', name: '', addressLine: '', city: '' },
  });

  return (
    <FormProvider {...form}>
      <ClinicTaxIdField
        control={form.control}
        taxIdField="taxId"
        legalNameField="name"
        addressField="addressLine"
        cityField="city"
      />
      {/* Mirrors what the lookup writes, so the assertions can read it back out of the DOM. */}
      <input aria-label="name-mirror" {...form.register('name')} />
      <input aria-label="address-mirror" {...form.register('addressLine')} />
      <input aria-label="city-mirror" {...form.register('city')} />
    </FormProvider>
  );
}

const taxIdInput = () => screen.getByRole('textbox', { name: 'taxId' });
const type = (value: string) => fireEvent.change(taxIdInput(), { target: { value } });

describe('ClinicTaxIdField', () => {
  beforeEach(() => {
    // `shouldAdvanceTime` keeps `waitFor` usable while the debounce stays under our control.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    httpGet.mockReset();
    httpGet.mockResolvedValue({ success: true, data: COMPANY });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not search until the code is nine digits long', async () => {
    render(<Harness />);

    type('20437');
    await vi.advanceTimersByTimeAsync(1000);

    expect(httpGet).not.toHaveBeenCalled();
  });

  it('searches once the ninth digit lands, after the debounce', async () => {
    render(<Harness />);

    type('204378869');
    expect(httpGet).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(httpGet).toHaveBeenCalledWith('/company/lookup', {
      params: { taxId: '204378869' },
    });
  });

  /** The whole point of the debounce: typing a 9-digit code is 9 changes, not 9 requests. */
  it('collapses a burst of keystrokes into a single request', async () => {
    render(<Harness />);

    for (const value of ['2', '20', '204', '2043', '20437', '204378', '2043788', '20437886']) {
      type(value);
      await vi.advanceTimersByTimeAsync(50);
    }
    type('204378869');
    await vi.advanceTimersByTimeAsync(500);

    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('fills the legal name into the name field', async () => {
    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(screen.getByLabelText('name-mirror')).toHaveValue('სს საქართველოს ბანკი');
    });
  });

  /** Autofilled, not locked — a clinic must be able to correct what the registry gave it. */
  it('leaves the filled name editable', async () => {
    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByLabelText('name-mirror')).toHaveValue(COMPANY.legalName));

    fireEvent.change(screen.getByLabelText('name-mirror'), { target: { value: 'My Clinic' } });

    expect(screen.getByLabelText('name-mirror')).toHaveValue('My Clinic');
    expect(taxIdInput()).not.toBeDisabled();
  });

  /**
   * The registry serves no address without a CAPTCHA, so `address` and `city` come back empty.
   * Writing those empties over what the clinic has typed would make the lookup destructive.
   */
  it('does not clear an address the clinic has already typed', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('address-mirror'), { target: { value: '12 Rustaveli' } });
    fireEvent.change(screen.getByLabelText('city-mirror'), { target: { value: 'Tbilisi' } });

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByLabelText('name-mirror')).toHaveValue(COMPANY.legalName));

    expect(screen.getByLabelText('address-mirror')).toHaveValue('12 Rustaveli');
    expect(screen.getByLabelText('city-mirror')).toHaveValue('Tbilisi');
  });

  it('searches immediately on blur rather than waiting out the debounce', async () => {
    render(<Harness />);

    type('204378869');
    fireEvent.blur(taxIdInput());

    await waitFor(() => expect(httpGet).toHaveBeenCalledTimes(1));
  });

  /** Blur lands right after the debounce fires for the same code — that must not be two requests. */
  it('does not search twice when blur follows the debounce', async () => {
    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);
    fireEvent.blur(taxIdInput());
    await vi.advanceTimersByTimeAsync(500);

    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner while the lookup is in flight', async () => {
    let release: (value: unknown) => void = () => {};
    httpGet.mockReturnValue(new Promise(resolve => {
      release = resolve;
    }));

    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    release({ success: true, data: COMPANY });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('shows the registry miss under the field', async () => {
    httpGet.mockRejectedValue(new Error('NOT_FOUND'));
    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => expect(screen.getByText('companyNotFound')).toBeInTheDocument());
    expect(screen.getByLabelText('name-mirror')).toHaveValue('');
  });

  /** An outage must not read as "your company is not registered". */
  it('distinguishes an unreachable registry from a miss', async () => {
    httpGet.mockRejectedValue(new Error('REGISTRY_UNAVAILABLE'));
    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(screen.getByText('companyRegistryUnavailable')).toBeInTheDocument();
    });
  });

  it('clears a stale result once the code stops being nine digits', async () => {
    render(<Harness />);

    type('204378869');
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByText(COMPANY.legalName)).toBeInTheDocument());

    type('20437886');

    await waitFor(() => expect(screen.queryByText(COMPANY.legalName)).not.toBeInTheDocument());
  });
});
