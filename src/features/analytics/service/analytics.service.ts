import { analyticsRepository, CountBucket } from '@/features/analytics/repository/analytics.repository';
import {
  AnalyticsClinicOption,
  AnalyticsRange,
  ChannelDelivery,
  ClinicAnalytics,
  HoursSaved,
  LocaleSplit,
  Rate,
} from '@/features/analytics/types/analytics.types';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import {
  MINUTES_SAVED_PER_DELIVERED_REMINDER,
  MINUTES_SAVED_PER_PATIENT_ONBOARDED,
  QUARTER_MONTHS,
} from '@/shared/const/analytics.const';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

const MINUTES_PER_HOUR = 60;

/** Reads a bucket list into a plain lookup, defaulting anything absent to zero. */
function bucketCount(buckets: CountBucket[], key: string): number {
  return buckets.find(bucket => bucket._id === key)?.count ?? 0;
}

/**
 * A rate, or `null` when there was nothing to rate.
 *
 * Zero attempts is not zero percent. A clinic with no reminders due in a quarter has no delivery
 * rate at all, and printing 0% would report a quiet quarter as a total failure.
 */
function toRate(delivered: number, attempted: number): Rate {
  return { delivered, attempted, rate: attempted === 0 ? null : delivered / attempted };
}

/** The UTC bounds of a calendar quarter. */
export function quarterRange(year: number, quarter: number): AnalyticsRange {
  const months = QUARTER_MONTHS[quarter];
  const from = new Date(Date.UTC(year, months.startMonth, 1, 0, 0, 0, 0));
  // Day 0 of the following month is the last day of this one, so no month-length table is needed.
  const to = new Date(Date.UTC(year, months.endMonth + 1, 0, 23, 59, 59, 999));

  return { from: from.toISOString(), to: to.toISOString(), label: `Q${quarter} ${year}` };
}

/**
 * The estimate. Delivered reminders only — one nobody received saved nobody anything.
 *
 * Both constants are exported on the result so every surface that shows the total can also show
 * what it assumed. That is the difference between a figure a clinic can check and a figure it has
 * to take on faith.
 */
function estimateHoursSaved(deliveredReminders: number, newPatients: number): HoursSaved {
  const fromReminders = deliveredReminders * MINUTES_SAVED_PER_DELIVERED_REMINDER;
  const fromOnboarding = newPatients * MINUTES_SAVED_PER_PATIENT_ONBOARDED;

  return {
    hours: Math.round(((fromReminders + fromOnboarding) / MINUTES_PER_HOUR) * 10) / 10,
    fromReminders,
    fromOnboarding,
    minutesPerReminder: MINUTES_SAVED_PER_DELIVERED_REMINDER,
    minutesPerPatient: MINUTES_SAVED_PER_PATIENT_ONBOARDED,
  };
}

function toLocaleSplit(buckets: CountBucket[]): LocaleSplit[] {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (['ka', 'en'] as AppLocale[]).map(locale => {
    const count = bucketCount(buckets, locale);
    return { locale, count, share: total === 0 ? 0 : count / total };
  });
}

/** Clinics the console can report on. */
export async function listAnalyticsClinicsService(): Promise<
  ServiceResult<{ items: AnalyticsClinicOption[] }>
  > {
  const clinics = await analyticsRepository.listClinics();
  return {
    data: { items: clinics.map(clinic => ({ id: clinic._id.toString(), name: clinic.name })) },
    status: 200,
  };
}

/**
 * Everything the analytics view and the quarterly report both need, for one clinic over one range.
 *
 * One service for both surfaces on purpose: a report that disagreed with the screen it was
 * generated from would be worse than either alone, and the only way to guarantee they agree is to
 * have them read the same numbers.
 */
export async function getClinicAnalyticsService(
  clinicId: string,
  range: AnalyticsRange
): Promise<ServiceResult<ClinicAnalytics>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const from = new Date(range.from);
  const to = new Date(range.to);

  const [activePatients, newPatients, localeBuckets, statusBuckets, delivery] = await Promise.all([
    analyticsRepository.countActivePatients(clinicId, to),
    analyticsRepository.countNewPatients(clinicId, from, to),
    analyticsRepository.countPatientsByLocale(clinicId, to),
    analyticsRepository.countOccurrencesByStatus(clinicId, from, to),
    analyticsRepository.countDeliveries(clinicId, from, to),
  ]);

  const done = bucketCount(statusBuckets, 'done');
  const skipped = bucketCount(statusBuckets, 'skipped');
  const missed = bucketCount(statusBuckets, 'missed');
  const sent = bucketCount(statusBuckets, 'sent');
  // `sending` is a claim held for the length of one sweep; from the patient's side it is pending.
  const pending = bucketCount(statusBuckets, 'pending') + bucketCount(statusBuckets, 'sending');
  const total = done + skipped + missed + sent + pending;

  /*
    Adherence is confirmed over everything the patient was actually asked. `sent` is excluded from
    the denominator — a reminder that went out an hour ago and has not been answered yet is not a
    patient ignoring their medication, and counting it as one would make every report look worse
    the closer it was run to the end of the quarter.
  */
  const answerable = done + skipped + missed;

  const channels: ChannelDelivery = {
    push: toRate(delivery.pushDelivered, delivery.pushAttempted),
    email: toRate(delivery.emailDelivered, delivery.emailAttempted),
  };

  return {
    data: {
      clinicId,
      clinicName: clinic.name,
      range,
      activePatients,
      newPatients,
      reminders: { total, dispatched: delivery.dispatched, done, skipped, missed, pending },
      delivery: channels,
      adherenceRate: answerable === 0 ? null : done / answerable,
      locales: toLocaleSplit(localeBuckets),
      hoursSaved: estimateHoursSaved(
        delivery.pushDelivered + delivery.emailDelivered,
        newPatients
      ),
    },
    status: 200,
  };
}
