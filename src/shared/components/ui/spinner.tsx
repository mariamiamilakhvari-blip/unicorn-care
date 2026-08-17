import { cn } from '@/shared/lib/utils';

type SpinnerProps = {
  className?: string;
  /** Announced to screen readers, since the ring itself carries no text. */
  label: string;
};

/**
 * The busy ring, as one component.
 *
 * A borrowed border rather than an icon: it matches the route-level loading state the app already
 * shows, and it inherits `currentColor`, so it reads correctly inside an input, on a button, and
 * in both themes without being told which.
 *
 * `motion-reduce:animate-none` leaves a static ring for anyone who has asked for less motion — the
 * spin is the only thing lost, and `role="status"` still announces it.
 */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        'motion-reduce:animate-none',
        className
      )}
    />
  );
}
