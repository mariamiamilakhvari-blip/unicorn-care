import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
  },
}));

import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicProfile } from '@/features/clinic/types/clinic.types';
import { CONSENT_VERSION, DPA_VERSION } from '@/shared/const/consent.const';

import {
  createStaffService,
  getClinicService,
  registerClinicService,
  updateClinicService,
} from './clinic.service';

const mockClinicRepo = vi.mocked(clinicRepository);
const mockUserRepo = vi.mocked(userRepository);

const USER_ID = '507f1f77bcf86cd799439011';
const CLINIC_ID = '507f1f77bcf86cd799439022';
/** Every register call carries the caller's address; the DPA record is stamped with it. */
const IP = '203.0.113.9';

const registerInput = {
  owner: { name: 'Nino Owner', email: 'nino@clinic.ge', password: 'password123' },
  clinic: {
    name: 'Unicorn Clinic!',
    country: 'Georgia',
    city: 'Tbilisi',
    addressLine: '12 Rustaveli',
    phone: '+995555000111',
    email: 'hello@clinic.ge',
    taxId: '204567891',
    locale: 'ka' as const,
    timezone: 'Asia/Tbilisi',
  },
  consents: {
    terms: true,
    privacy: true,
    patientConsents: true,
    accuracy: true,
    credentials: true,
    processingPurpose: true,
    remindersNotMedicalAdvice: true,
    regulatoryCompliance: true,
    // Ticked like the rest. It carried `false` while it was a US-only Business Associate
    // Agreement a Georgian clinic could decline; a body reaching this service with it unticked is
    // now rejected by the schema before it gets here, so a fixture claiming otherwise would
    // describe a request that cannot exist.
    dataProcessing: true,
  },
};

const fakeClinic = {
  _id: { toString: () => CLINIC_ID },
  name: 'Unicorn Clinic',
  slug: 'unicorn-clinic-abcd1234',
  country: 'Georgia',
  city: 'Tbilisi',
  addressLine: '12 Rustaveli',
  phone: '+995555000111',
  email: 'hello@clinic.ge',
  taxId: '204567891',
  logoUrl: '',
  locale: 'ka',
  timezone: 'Asia/Tbilisi',
  isActive: true,
};

describe('registerClinicService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 409 when the owner email is already taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce({ _id: USER_ID } as never);
    const result = await registerClinicService(registerInput, IP);
    expect(result.status).toBe(409);
    expect(result.data).toEqual({ error: 'EMAIL_TAKEN' });
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('creates the owner with role clinic_owner, then the clinic, then links them', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(true);

    const result = await registerClinicService(registerInput, IP);

    expect(result.status).toBe(201);
    expect(result.data).toEqual({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'clinic_owner', email: 'nino@clinic.ge', clinicId: null })
    );
    expect(mockUserRepo.updateById).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ clinicId: expect.anything() })
    );
  });

  it('never stores the plaintext owner password', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(true);

    await registerClinicService(registerInput, IP);

    const payload = mockUserRepo.create.mock.calls[0][0];
    expect(payload.passwordHash).not.toBe('password123');
    expect(payload.passwordHash).toHaveLength(64);
  });

  it('derives a slug from the clinic name: lowercased, non-alphanumerics to "-", random suffix', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(true);

    await registerClinicService(registerInput, IP);

    const payload = mockClinicRepo.create.mock.calls[0][0];
    expect(payload.slug).toMatch(/^unicorn-clinic-[0-9a-f]{8}$/);
  });

  it('gives two clinics with the same name distinct slugs', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue(USER_ID);
    mockClinicRepo.create.mockResolvedValue(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValue(true);

    await registerClinicService(registerInput, IP);
    await registerClinicService(registerInput, IP);

    const first = mockClinicRepo.create.mock.calls[0][0].slug;
    const second = mockClinicRepo.create.mock.calls[1][0].slug;
    expect(first).not.toBe(second);
  });

  /**
   * The DPA record is evidence of an executed contract, so what matters is that the service
   * writes it from its own clock, its own version constant and the request's address — never from
   * anything the body could have claimed.
   *
   * There is no "records a refusal" case any more, and there cannot be one. The agreement was a
   * US-only Business Associate Agreement that a clinic elsewhere could decline; under the Law of
   * Georgia on Personal Data Protection every controller engaging a processor needs it, so a
   * registration that declines it is rejected by the schema and never reaches this service. See
   * `clinic.validation.spec.ts`, which is where that refusal is now pinned.
   */
  describe('the DPA record', () => {
    const registerWith = async (country = 'Georgia') => {
      mockUserRepo.findByEmail.mockResolvedValueOnce(null);
      mockUserRepo.create.mockResolvedValueOnce(USER_ID);
      mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
      mockUserRepo.updateById.mockResolvedValueOnce(true);

      await registerClinicService(
        { ...registerInput, clinic: { ...registerInput.clinic, country } },
        IP
      );

      return mockClinicRepo.create.mock.calls[0][0];
    };

    it('stamps an acceptance with the version, the clock and the caller address', async () => {
      const payload = await registerWith();

      expect(payload.dpa?.version).toBe(DPA_VERSION);
      expect(payload.dpa?.ip).toBe(IP);
      expect(payload.dpa?.acceptedAt).toBeInstanceOf(Date);
    });

    it('stores no acceptance flag — it could only ever read true', async () => {
      const payload = await registerWith();

      // A field with one reachable value is not evidence; it invites a reader to write a branch
      // for a case the schema makes unreachable.
      expect(payload.dpa).not.toHaveProperty('accepted');
    });

    it('stamps it for a clinic outside Georgia too — the agreement is not country-conditional', async () => {
      const payload = await registerWith('Netherlands');

      expect(payload.dpa?.version).toBe(DPA_VERSION);
      expect(payload.dpa?.acceptedAt).toBeInstanceOf(Date);
    });

    it('keeps the DPA version apart from the consent version', async () => {
      const payload = await registerWith();

      expect(payload.consent?.version).toBe(CONSENT_VERSION);
      expect(payload.dpa?.version).toBe(DPA_VERSION);
    });
  });

  it('compensating delete: removes the owner when clinic creation throws', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockRejectedValueOnce(new Error('duplicate slug'));

    const result = await registerClinicService(registerInput, IP);

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ error: 'CLINIC_CREATE_FAILED' });
    expect(mockUserRepo.deleteById).toHaveBeenCalledWith(USER_ID);
  });

  it('compensating delete: removes both rows when the clinicId write-back does not match', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(false);

    const result = await registerClinicService(registerInput, IP);

    expect(result.status).toBe(500);
    expect(mockClinicRepo.deleteById).toHaveBeenCalledWith(CLINIC_ID);
    expect(mockUserRepo.deleteById).toHaveBeenCalledWith(USER_ID);
  });

  it('compensating delete: removes both rows when the write-back throws', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockRejectedValueOnce(new Error('connection lost'));

    const result = await registerClinicService(registerInput, IP);

    expect(result.status).toBe(500);
    expect(mockUserRepo.deleteById).toHaveBeenCalledWith(USER_ID);
  });
});

describe('getClinicService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when the clinic is missing', async () => {
    mockClinicRepo.findById.mockResolvedValueOnce(null);
    expect((await getClinicService(CLINIC_ID)).status).toBe(404);
  });

  it('maps the document onto the wire shape', async () => {
    mockClinicRepo.findById.mockResolvedValueOnce(fakeClinic as never);
    const result = await getClinicService(CLINIC_ID);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      id: CLINIC_ID,
      name: 'Unicorn Clinic',
      slug: 'unicorn-clinic-abcd1234',
      country: 'Georgia',
      city: 'Tbilisi',
      addressLine: '12 Rustaveli',
      phone: '+995555000111',
      email: 'hello@clinic.ge',
      taxId: '204567891',
      logoUrl: '',
      locale: 'ka',
      timezone: 'Asia/Tbilisi',
      isActive: true,
    });
  });

  it('returns an empty contact address for a clinic that predates the field', async () => {
    // The column is optional and was added after clinics existed, so the document may simply not
    // carry it. The wire shape promises a string either way — the form binds to it directly.
    const withoutEmail = { ...fakeClinic };
    delete (withoutEmail as Partial<typeof fakeClinic>).email;
    mockClinicRepo.findById.mockResolvedValueOnce(withoutEmail as never);

    const result = await getClinicService(CLINIC_ID);

    expect((result.data as ClinicProfile).email).toBe('');
  });
});

describe('updateClinicService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when nothing matched', async () => {
    mockClinicRepo.updateById.mockResolvedValueOnce(false);
    const result = await updateClinicService(CLINIC_ID, { city: 'Batumi' });
    expect(result.status).toBe(404);
    expect(mockClinicRepo.findById).not.toHaveBeenCalled();
  });

  it('returns the refreshed clinic after a successful update', async () => {
    mockClinicRepo.updateById.mockResolvedValueOnce(true);
    mockClinicRepo.findById.mockResolvedValueOnce({ ...fakeClinic, city: 'Batumi' } as never);
    const result = await updateClinicService(CLINIC_ID, { city: 'Batumi' });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ city: 'Batumi' });
    expect(mockClinicRepo.updateById).toHaveBeenCalledWith(CLINIC_ID, { city: 'Batumi' });
  });
});

describe('createStaffService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 409 when the email is already taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce({ _id: USER_ID } as never);
    const result = await createStaffService(CLINIC_ID, {
      name: 'Data Staff',
      email: 'data@clinic.ge',
      jobTitle: 'Nurse',
    });
    expect(result.status).toBe(409);
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('creates a clinic_staff user scoped to the session clinic and returns the temp password once', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);

    const result = await createStaffService(CLINIC_ID, {
      name: 'Data Staff',
      email: 'data@clinic.ge',
      jobTitle: 'Nurse',
    });

    expect(result.status).toBe(201);
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'clinic_staff', jobTitle: 'Nurse' })
    );
    const data = result.data as { temporaryPassword: string; userId: string };
    expect(data.userId).toBe(USER_ID);
    expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(20);
  });

  it('stores only the hash of the temporary password', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);

    const result = await createStaffService(CLINIC_ID, {
      name: 'Data Staff',
      email: 'data@clinic.ge',
      jobTitle: 'Nurse',
    });

    const data = result.data as { temporaryPassword: string };
    const payload = mockUserRepo.create.mock.calls[0][0];
    expect(payload.passwordHash).not.toBe(data.temporaryPassword);
    expect(payload.passwordHash).toHaveLength(64);
  });

  it('generates a different temporary password each time', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue(USER_ID);

    const input = { name: 'Data Staff', email: 'data@clinic.ge', jobTitle: 'Nurse' };
    const first = (await createStaffService(CLINIC_ID, input)).data as { temporaryPassword: string };
    const second = (await createStaffService(CLINIC_ID, input)).data as { temporaryPassword: string };
    expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
  });
});
