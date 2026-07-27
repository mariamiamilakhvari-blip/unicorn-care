import { useTranslations } from 'next-intl';

import { Badge } from '@/shared/components/ui/badge';

type IntensityChipProps = {
  intensity: 'light' | 'moderate' | 'intense';
};

/**
 * Intensity is a prescribed instruction, not decoration — "lymphatic massage, light" is a
 * different order from the same task at intense, so it reads as its own token.
 */
const INTENSITY_CLASS_NAME: Record<IntensityChipProps['intensity'], string> = {
  light: 'bg-primary/10 text-primary',
  moderate: 'bg-primary/25 text-primary',
  intense: 'bg-primary text-primary-foreground',
};

export function IntensityChip({ intensity }: IntensityChipProps) {
  const t = useTranslations('carePlan');

  return (
    <Badge variant="secondary" className={INTENSITY_CLASS_NAME[intensity]}>
      {t(`intensity.${intensity}`)}
    </Badge>
  );
}
