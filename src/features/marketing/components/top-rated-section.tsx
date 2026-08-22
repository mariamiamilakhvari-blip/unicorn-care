import { Star } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getPublicRatingsService } from '@/features/rating/service/public-rating.service';
import {
  PublicClinicRating,
  PublicDoctorRating,
  PublicRatingsView,
} from '@/features/rating/types/rating.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

/**
 * The public rating boards, between the benefit cards and the audience section.
 *
 * An async server component that calls the service directly rather than fetching its own API
 * route — the same shape the dashboard pages use. It is the one section of the landing page whose
 * content is not static copy, and it is the section a prospective patient has the most reason to
 * trust, so it is rendered on the server and reaches a crawler as text rather than arriving after
 * hydration.
 *
 * Renders **nothing at all** when no clinic has cleared `MIN_RATINGS_FOR_AVERAGE`. An empty
 * leaderboard is worse than no leaderboard: a board with one clinic on it reads as a ranking, and
 * the whole point of the threshold is that a handful of ratings is not a ranking. A quiet absence
 * is honest; "Top rated: 1 result" is not.
 */
export const TopRatedSection = async () => {
  const { data } = await getPublicRatingsService();
  if ('error' in data) return null;

  const boards = data as PublicRatingsView;
  if (boards.clinics.length === 0 && boards.doctors.length === 0) return null;

  const t = await getTranslations('marketing');

  return (
    <section
      aria-label={t('topRatedTitle')}
      className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10 sm:px-10 sm:pt-16"
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t('topRatedEyebrow')}
        </span>
        <h2 className="font-heading text-3xl font-bold">{t('topRatedTitle')}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('topRatedHelp', { threshold: boards.threshold })}
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {boards.clinics.length > 0 && (
          <Board title={t('topRatedClinics')}>
            {boards.clinics.map((clinic, index) => (
              <ClinicRow
                key={clinic.id}
                clinic={clinic}
                rank={index + 1}
                count={t('topRatedRatingCount', { count: clinic.ratingCount })}
              />
            ))}
          </Board>
        )}

        {boards.doctors.length > 0 && (
          <Board title={t('topRatedDoctors')}>
            {boards.doctors.map((doctor, index) => (
              <DoctorRow
                key={`${doctor.clinicName}-${doctor.name}`}
                doctor={doctor}
                rank={index + 1}
                count={t('topRatedRatingCount', { count: doctor.ratingCount })}
              />
            ))}
          </Board>
        )}
      </div>
    </section>
  );
};

function Board({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-1">{children}</ol>
      </CardContent>
    </Card>
  );
}

/**
 * The rank sits in its own fixed-width column so the names below it line up regardless of whether
 * the number is one digit or two — a ragged left edge on a ranked list reads as a rendering fault.
 */
function Rank({ value }: { value: number }) {
  return (
    <span className="w-6 shrink-0 font-mono text-sm text-muted-foreground">{value}</span>
  );
}

function Score({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 font-heading text-lg font-semibold">
      <Star className="size-4 fill-current text-moss" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}

/*
  The count arrives pre-formatted, not as a number beside a bare noun. "1 ratings" is what
  concatenation produces, and the plural rules differ per locale — Georgian does not inflect the
  noun after a numeral at all, so the choice cannot live in the component.
*/
function ClinicRow({
  clinic,
  rank,
  count,
}: {
  clinic: PublicClinicRating;
  rank: number;
  count: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
      <Rank value={rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{clinic.name}</p>
        <p className="text-xs text-muted-foreground">{count}</p>
      </div>
      <Score value={clinic.avgClinicScore} />
    </li>
  );
}

function DoctorRow({
  doctor,
  rank,
  count,
}: {
  doctor: PublicDoctorRating;
  rank: number;
  count: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
      <Rank value={rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doctor.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doctor.clinicName} · {count}
        </p>
      </div>
      <Score value={doctor.avgDoctorScore} />
    </li>
  );
}
