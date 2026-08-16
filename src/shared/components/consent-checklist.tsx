'use client';

import Link from 'next/link';
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
 * under the Law of Georgia on Personal Data Protection, which requires a clear affirmative action.
 * So the defaults live in the form's `defaultValues` as `false`, and the schema rejects anything
 * that is not literally `true`.
 */
type ConsentChecklistProps<T extends FieldValues> = {
  control: Control<T>;
  /** Message namespace holding the wording, e.g. `consent.clinic`. */
  namespace: string;
  /** Section heading, already translated by the caller. */
  heading: string;
  /*
    Consent key → href, for the lines that reference a document. Those messages carry a `<link>`
    tag and are rendered with `t.rich`; everything else is plain text. Asking someone to agree to
    a document they cannot open is not consent, so the two that name one have to be reachable
    from the checkbox itself.
  */
  links?: Record<string, string>;
  /** Field names in schema order. Rendered in the order given. */
  fields: readonly Path<T>[];
};

/**
 * The schema raises a bare code, and `FormMessage` prefers `error.message` over its children, so
 * translating it means rendering the paragraph here. `formMessageId` is reused so the checkbox's
 * `aria-describedby` still resolves.
 *
 * One message for every box now. This used to branch on `BAA_REQUIRED`, because the Business
 * Associate Agreement was the one consent required of US clinics only and a clinic seeing the
 * generic sentence had no way to tell why that box became mandatory when it changed its country.
 * The Data Processing Agreement that replaced it is mandatory everywhere, so "you must tick this
 * to continue" is once again the whole story.
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
  links,
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
                  {(() => {
                    const key = String(name).split('.').pop() ?? String(name);
                    const href = links?.[key];
                    if (!href) return t(key);
                    return t.rich(key, {
                      // `stopPropagation` so opening the document does not also tick the box —
                      // the link sits inside the label that toggles it.
                      link: chunks => (
                        <Link
                          href={href}
                          target="_blank"
                          onClick={event => event.stopPropagation()}
                          className="underline underline-offset-4 hover:text-foreground"
                        >
                          {chunks}
                        </Link>
                      ),
                    });
                  })()}
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
