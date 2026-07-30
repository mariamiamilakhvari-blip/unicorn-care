'use client';

import { useTranslations } from 'next-intl';
import { Control, FieldValues, Path } from 'react-hook-form';

import { Checkbox } from '@/shared/components/ui/checkbox';
import { FormControl, FormField, FormItem, useFormField } from '@/shared/components/ui/form';

/**
 * The consent block shared by clinic registration and patient creation.
 *
 * Driven by a key list rather than fourteen hand-written `FormField` blocks: the wording is legal
 * text that will be revised, and a layout duplicated per checkbox is where one revision quietly
 * misses a form. Each key maps to `<namespace>.<key>` in the message files, so adding a consent
 * means adding a schema field and two strings — never JSX.
 *
 * Nothing here is pre-ticked and nothing is disabled. A pre-ticked consent box is not consent
 * under GDPR (Art. 4(11) requires a clear affirmative action), so the defaults live in the form's
 * `defaultValues` as `false` and the schema rejects anything that is not literally `true`.
 */
type ConsentChecklistProps<T extends FieldValues> = {
  control: Control<T>;
  /** Message namespace holding the wording, e.g. `consent.clinic`. */
  namespace: string;
  /** Section heading, already translated by the caller. */
  heading: string;
  /** Field names in schema order. Rendered in the order given. */
  fields: readonly Path<T>[];
};

/**
 * The schema raises the bare code `CONSENT_REQUIRED`, and `FormMessage` prefers `error.message`
 * over its children, so translating it means rendering the paragraph here. `formMessageId` is
 * reused so the checkbox's `aria-describedby` still resolves.
 */
function ConsentMessage() {
  const t = useTranslations('consent');
  const { error, formMessageId } = useFormField();

  if (!error) return null;

  return (
    <p id={formMessageId} className="text-sm font-medium text-destructive">
      {t('required')}
    </p>
  );
}

export function ConsentChecklist<T extends FieldValues>({
  control,
  namespace,
  heading,
  fields,
}: ConsentChecklistProps<T>) {
  const t = useTranslations(namespace);

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {heading}
      </p>
      {fields.map(name => (
        <FormField
          key={String(name)}
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem>
              {/*
                The label wraps the checkbox so the whole sentence is a hit target. These are long
                lines of legal text, and a 16px box is a poor thing to ask someone to hit on a
                phone eight times in a row.
              */}
              <label className="flex cursor-pointer items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={checked => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className="mt-0.5"
                  />
                </FormControl>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {t(String(name).split('.').pop() ?? String(name))}
                </span>
              </label>
              <ConsentMessage />
            </FormItem>
          )}
        />
      ))}
    </section>
  );
}
