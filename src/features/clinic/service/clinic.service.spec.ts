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

const registerInput = {
  owner: { name: 'Nino Owner', email: 'nino@clinic.ge', password: 'password123' },
  clinic: {
    name: 'Unicorn Clinic!',
    country: 'Georgia',
    city: 'Tbilisi',
    addressLine: '12 Rustaveli',
    phone: '+995555000111',
    locale: 'ka' as const,
    timezone: 'Asia/Tbilisi',
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
  logoUrl: '',
  locale: 'ka',
  timezone: 'Asia/Tbilisi',
  isActive: true,
};

describe('registerClinicService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 409 when the owner email is already taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce({ _id: USER_ID } as never);
    const result = await registerClinicService(registerInput);
    expect(result.status).toBe(409);
    expect(result.data).toEqual({ error: 'EMAIL_TAKEN' });
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('creates the owner with role clinic_owner, then the clinic, then links them', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(true);

    const result = await registerClinicService(registerInput);

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

    await registerClinicService(registerInput);

    const payload = mockUserRepo.create.mock.calls[0][0];
    expect(payload.passwordHash).not.toBe('password123');
    expect(payload.passwordHash).toHaveLength(64);
  });

  it('derives a slug from the clinic name: lowercased, non-alphanumerics to "-", random suffix', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(true);

    await registerClinicService(registerInput);

    const payload = mockClinicRepo.create.mock.calls[0][0];
    expect(payload.slug).toMatch(/^unicorn-clinic-[0-9a-f]{8}$/);
  });

  it('gives two clinics with the same name distinct slugs', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue(USER_ID);
    mockClinicRepo.create.mockResolvedValue(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValue(true);

    await registerClinicService(registerInput);
    await registerClinicService(registerInput);

    const first = mockClinicRepo.create.mock.calls[0][0].slug;
    const second = mockClinicRepo.create.mock.calls[1][0].slug;
    expect(first).not.toBe(second);
  });

  it('compensating delete: removes the owner when clinic creation throws', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockRejectedValueOnce(new Error('duplicate slug'));

    const result = await registerClinicService(registerInput);

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ error: 'CLINIC_CREATE_FAILED' });
    expect(mockUserRepo.deleteById).toHaveBeenCalledWith(USER_ID);
  });

  it('compensating delete: removes both rows when the clinicId write-back does not match', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockResolvedValueOnce(false);

    const result = await registerClinicService(registerInput);

    expect(result.status).toBe(500);
    expect(mockClinicRepo.deleteById).toHaveBeenCalledWith(CLINIC_ID);
    expect(mockUserRepo.deleteById).toHaveBeenCalledWith(USER_ID);
  });

  it('compensating delete: removes both rows when the write-back throws', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    mockUserRepo.create.mockResolvedValueOnce(USER_ID);
    mockClinicRepo.create.mockResolvedValueOnce(CLINIC_ID);
    mockUserRepo.updateById.mockRejectedValueOnce(new Error('connection lost'));

    const result = await registerClinicService(registerInput);

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
      logoUrl: '',
      locale: 'ka',
      timezone: 'Asia/Tbilisi',
      isActive: true,
    });
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
