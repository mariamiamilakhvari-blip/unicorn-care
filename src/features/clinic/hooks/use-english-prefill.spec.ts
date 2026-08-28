import { act, renderHook } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { useEnglishPrefill } from '@/features/clinic/hooks/use-english-prefill';
import { ClinicProfileFormType } from '@/features/clinic/validations/clinic.validation';

type Seed = Partial<ClinicProfileFormType>;

/**
 * Drives the hook through a real `useForm`, so what is asserted is the value that would actually
 * be submitted rather than a call to a spy.
 */
function setup(seed: Seed = {}) {
  return renderHook(() => {
    const form = useForm<ClinicProfileFormType>({
      defaultValues: {
        name: '',
        nameEn: '',
        addressLine: '',
        addressLineEn: '',
        ...seed,
      } as ClinicProfileFormType,
    });

    /*
      Registered as the real form registers them through `FormField`. Without this react-hook-form
      has no field to mark, and `isDirty` never moves however the value is set.
    */
    form.register('name');
    form.register('nameEn');
    form.register('addressLine');
    form.register('addressLineEn');

    /*
      `formState` is a proxy that only tracks the keys read during render, so a test that reads
      `isDirty` afterwards would never see it move. Reading it here is the subscription.
    */
    void form.formState.isDirty;

    const [name, addressLine] = useWatch({
      control: form.control,
      name: ['name', 'addressLine'],
    });

    useEnglishPrefill({
      name: name ?? '',
      addressLine: addressLine ?? '',
      getValues: form.getValues,
      setValue: form.setValue,
    });

    return form;
  });
}

/**
 * The suggestion a clinic is offered while typing its Georgian name and address.
 *
 * It exists because `nameEn` is optional and almost nobody filled it, so English-language patients
 * read a Georgian clinic name in the subject line of every email. Being handed a spelling and
 * asked to check is a task people do; typing one out is not.
 *
 * What is pinned here is the boundary that keeps it honest: it fills empty fields, on edit, and
 * never touches a name the clinic wrote itself.
 */
describe('useEnglishPrefill', () => {
  it('suggests a Latin name once the Georgian one is typed', () => {
    const { result } = setup();

    act(() => result.current.setValue('name', 'გაგუას კლინიკა'));

    expect(result.current.getValues('nameEn')).toBe('Gaguas Klinika');
  });

  it('suggests an address the same way', () => {
    const { result } = setup();

    act(() => result.current.setValue('addressLine', 'საბურთალო: ვაჟა-ფშაველას გამზ. N40'));

    expect(result.current.getValues('addressLineEn')).toBe(
      'Saburtalo: Vazha-Pshavelas Gamz. N40'
    );
  });

  /*
    The rule the whole feature turns on. A clinic that typed its own English name has answered the
    question this exists to ask, and rewriting it on every keystroke in the Georgian field would be
    the feature destroying their work.
  */
  it('never overwrites an English name the clinic wrote itself', () => {
    const { result } = setup({ nameEn: 'Gagua Clinic' });

    act(() => result.current.setValue('name', 'გაგუას კლინიკა'));

    expect(result.current.getValues('nameEn')).toBe('Gagua Clinic');
  });

  it('never overwrites a custom English address either', () => {
    const { result } = setup({ addressLineEn: '40 Vazha-Pshavela Ave, Tbilisi' });

    act(() => result.current.setValue('addressLine', 'ახალი მისამართი'));

    expect(result.current.getValues('addressLineEn')).toBe('40 Vazha-Pshavela Ave, Tbilisi');
  });

  /* A field opened, spaced and abandoned holds `' '`, which would otherwise lock it out forever. */
  it('treats a whitespace-only English field as still empty', () => {
    const { result } = setup({ nameEn: '   ' });

    act(() => result.current.setValue('name', 'გაგუას კლინიკა'));

    expect(result.current.getValues('nameEn')).toBe('Gaguas Klinika');
  });

  /*
    Opening the settings page must not silently dirty a saved profile with text nobody asked for.
    A clinic that edits its Georgian name is asking; one that merely looked at the page is not.
  */
  it('suggests nothing on mount, however empty the English field is', () => {
    const { result } = setup({ name: 'გაგუას კლინიკა', nameEn: '' });

    expect(result.current.getValues('nameEn')).toBe('');
    expect(result.current.formState.isDirty).toBe(false);
  });

  it('marks the form dirty when it does suggest, so the value can be saved', () => {
    const { result } = setup();

    act(() => result.current.setValue('name', 'გაგუას კლინიკა'));

    expect(result.current.formState.isDirty).toBe(true);
  });

  /*
    Clearing the Georgian field suggests nothing rather than blanking the English one, which would
    read as the form deleting text the clinic could still want.
  */
  it('does not blank the English field when the Georgian one is cleared', () => {
    const { result } = setup();

    act(() => result.current.setValue('name', 'გაგუას კლინიკა'));
    expect(result.current.getValues('nameEn')).toBe('Gaguas Klinika');

    act(() => result.current.setValue('name', ''));
    expect(result.current.getValues('nameEn')).toBe('Gaguas Klinika');
  });

  /* Once a suggestion has landed it is the clinic's text, and further edits leave it alone. */
  it('stops suggesting after the first fill', () => {
    const { result } = setup();

    act(() => result.current.setValue('name', 'გაგუას კლინიკა'));
    act(() => result.current.setValue('name', 'თბილისის ცენტრი'));

    expect(result.current.getValues('nameEn')).toBe('Gaguas Klinika');
  });

  it('keeps the two pairs independent', () => {
    const { result } = setup({ nameEn: 'Gagua Clinic' });

    act(() => result.current.setValue('addressLine', 'ვაჟა-ფშაველა'));

    expect(result.current.getValues('nameEn')).toBe('Gagua Clinic');
    expect(result.current.getValues('addressLineEn')).toBe('Vazha-Pshavela');
  });
});
