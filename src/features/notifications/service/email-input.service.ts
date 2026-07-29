import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { nextCheckup } from '@/features/notifications/service/welcome-email.service';
import {
  DailyEmailInput,
  EmailGuide,
  EmailMedication,
  EmailRehabTask,
  WelcomeEmailInput,
} from '@/features/notifications/types/email.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { clock } from '@/shared/lib/clock';
import { AppLocale } from '@/shared/types/roles';

/**
 * Turns documents into the plain data the email builders take.
 *
 * Kept apart from the builders so those stay pure and unit-testable, and apart from the dispatcher
 * so the reads are in one place rather than scattered through the send loop.
 */

async function loadGuide(
  plan: CarePlanDocument,
  clinicId: string,
  locale: AppLocale
): Promise<EmailGuide | null> {
  const procedure = await procedureRepository.findById(plan.procedureId.toString(), clinicId);
  if (!procedure) return null;

  const guide =
    (await recoveryGuideRepository.findForClinic(clinicId, procedure.manipulationType, locale)) ??
    (await recoveryGuideRepository.findDefault(procedure.manipulationType, locale));

  if (!guide || !guide.isPublished) return null;

  return {
    expected: guide.expected.map(item => ({
      title: item.title,
      description: item.description ?? '',
      fromDay: item.fromDay,
      toDay: item.toDay,
    })),
    warning: guide.warning.map(item => ({
      title: item.title,
      description: item.description ?? '',
      severity: item.severity,
      fromDay: item.fromDay ?? 0,
      toDay: item.toDay ?? 0,
    })),
  };
}

function toMedications(plan: CarePlanDocument): EmailMedication[] {
  return plan.medications.map(item => ({
    name: item.name,
    dosage: item.dosage,
    timesOfDay: [...item.timesOfDay],
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    withFood: item.withFood,
  }));
}

function toRehabTasks(plan: CarePlanDocument): EmailRehabTask[] {
  return plan.rehabTasks.map(item => ({
    title: item.title,
    intensity: item.intensity,
    durationMinutes: item.durationMinutes ?? 0,
    timesOfDay: [...item.timesOfDay],
    daysOfWeek: [...(item.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6])],
    startsOn: item.startsOn,
    endsOn: item.endsOn,
  }));
}

export async function toWelcomeInput(
  plan: CarePlanDocument,
  clinic: ClinicDocument
): Promise<WelcomeEmailInput | null> {
  const clinicId = plan.clinicId.toString();
  const patient = await patientRepository.findById(plan.patientId.toString(), clinicId);
  if (!patient) return null;

  const locale = (patient.locale ?? clinic.locale) as AppLocale;
  const procedure = await procedureRepository.findById(plan.procedureId.toString(), clinicId);

  return {
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email ?? '',
      locale,
    },
    clinic: { name: clinic.name, phone: clinic.phone ?? '', timezone: clinic.timezone },
    procedure: procedure
      ? {
        manipulationType: procedure.manipulationType,
        performedAt: procedure.performedAt,
        operatorName: procedure.operatorName,
      }
      : null,
    medications: toMedications(plan),
    rehabTasks: toRehabTasks(plan),
    checkups: plan.checkups.map(item => ({
      title: item.title,
      scheduledAt: item.scheduledAt,
      location: item.location ?? '',
    })),
    guide: await loadGuide(plan, clinicId, locale),
  };
}

/** True when `now`'s clinic-local calendar day falls inside the item's own date window. */
function runsToday(item: { startsOn: Date; endsOn: Date }, now: Date, timezone: string): boolean {
  const fromStart = clock.daysBetweenInZone(item.startsOn, now, timezone);
  const toEnd = clock.daysBetweenInZone(now, item.endsOn, timezone);
  return fromStart >= 0 && toEnd >= 0;
}

export async function toDailyInput(
  plan: CarePlanDocument,
  clinic: ClinicDocument,
  patient: PatientDocument,
  now: Date
): Promise<DailyEmailInput> {
  const zone = clinic.timezone;
  const locale = (patient.locale ?? clinic.locale) as AppLocale;
  const weekday = clock.weekdayInZone(now, zone);

  const upcoming = plan.checkups.filter(item => item.scheduledAt.getTime() >= now.getTime());
  const checkup = nextCheckup(upcoming);

  return {
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email ?? '',
      locale,
    },
    clinic: { name: clinic.name, phone: clinic.phone ?? '', timezone: zone },
    medications: toMedications(plan).filter(item => runsToday(item, now, zone)),
    // A rehab task also has to fall on a weekday the clinic prescribed, unlike a medication.
    rehabTasks: toRehabTasks(plan).filter(
      item => runsToday(item, now, zone) && item.daysOfWeek.includes(weekday)
    ),
    nextCheckup: checkup
      ? {
        title: checkup.title,
        scheduledAt: checkup.scheduledAt,
        location: checkup.location ?? '',
      }
      : null,
    daysUntilCheckup: checkup ? clock.daysBetweenInZone(now, checkup.scheduledAt, zone) : null,
    guide: await loadGuide(plan, plan.clinicId.toString(), locale),
    recoveryDay: clock.daysBetweenInZone(plan.startsAt, now, zone),
  };
}
