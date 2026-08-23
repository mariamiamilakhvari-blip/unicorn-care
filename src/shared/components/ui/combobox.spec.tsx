import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Combobox, ComboboxOption } from '@/shared/components/ui/combobox';

/* A slice of the real catalogue: both names present, because both have to be searchable. */
const OPTIONS: ComboboxOption[] = [
  { value: 'rhinoplasty', label: 'რინოპლასტიკა', keywords: ['რინოპლასტიკა', 'Rhinoplasty'] },
  { value: 'botox_injection', label: 'ბოტულინოთერაპია', keywords: ['ბოტულინოთერაპია', 'Botulinum therapy'] },
  { value: 'liposuction', label: 'ლიპოსაქცია', keywords: ['ლიპოსაქცია', 'Liposuction'] },
  { value: 'hydrafacial', label: 'ჰაიდრაფეიშალი (HydraFacial)', keywords: ['ჰაიდრაფეიშალი (HydraFacial)', 'HydraFacial'] },
  { value: 'other', label: 'სხვა', keywords: ['სხვა', 'Other'] },
];

function open(value = '', onChange = vi.fn()) {
  render(
    <Combobox
      options={OPTIONS}
      value={value}
      onChange={onChange}
      placeholder="selectProcedure"
      searchPlaceholder="searchProcedure"
      emptyMessage="noProcedureFound"
    />
  );
  return onChange;
}

const trigger = () => screen.getByRole('combobox');
const search = () => screen.getByPlaceholderText('searchProcedure');
const optionLabels = () => screen.getAllByRole('option').map(node => node.textContent);

function type(query: string) {
  fireEvent.change(search(), { target: { value: query } });
}

describe('Combobox — what it shows before it is opened', () => {
  it('shows the placeholder when nothing is selected', () => {
    open();

    expect(trigger()).toHaveTextContent('selectProcedure');
  });

  it('shows the selected option’s label', () => {
    open('liposuction');

    expect(trigger()).toHaveTextContent('ლიპოსაქცია');
  });

  /*
    A retired key is still a stored value. The trigger falls back to the placeholder rather than
    printing the raw key at a clinician as though it were the name of an operation.
  */
  it('falls back to the placeholder for a value no option carries', () => {
    open('breast_augmentation');

    expect(trigger()).toHaveTextContent('selectProcedure');
  });
});

describe('Combobox — filtering', () => {
  it('lists every option before anything is typed', () => {
    open();
    fireEvent.click(trigger());

    expect(optionLabels()).toHaveLength(OPTIONS.length);
  });

  it('narrows the list as the query is typed', () => {
    open();
    fireEvent.click(trigger());

    type('ლიპო');

    expect(optionLabels()).toEqual(['ლიპოსაქცია']);
  });

  /*
    The point of `keywords`. The page is in Georgian, every label is Mkhedruli, and a clinic that
    types the Latin name still has to find the procedure — otherwise anything they cannot spell in
    Georgian is unreachable in a list of ninety-two.
  */
  it('matches the English name while the labels are Georgian', () => {
    open();
    fireEvent.click(trigger());

    type('rhino');

    expect(optionLabels()).toEqual(['რინოპლასტიკა']);
  });

  it('ignores case on the Latin half', () => {
    open();
    fireEvent.click(trigger());

    type('BOTULINUM');

    expect(optionLabels()).toEqual(['ბოტულინოთერაპია']);
  });

  it('ignores surrounding whitespace', () => {
    open();
    fireEvent.click(trigger());

    type('  liposuction  ');

    expect(optionLabels()).toEqual(['ლიპოსაქცია']);
  });

  it('matches on a substring from the middle of a name', () => {
    open();
    fireEvent.click(trigger());

    type('facial');

    expect(optionLabels()).toEqual(['ჰაიდრაფეიშალი (HydraFacial)']);
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    open();
    fireEvent.click(trigger());

    type('zzzz');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('noProcedureFound')).toBeInTheDocument();
  });

  it('starts from the whole list again on reopening', async () => {
    open();
    fireEvent.click(trigger());
    type('rhino');
    expect(optionLabels()).toHaveLength(1);

    fireEvent.click(trigger());
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    fireEvent.click(trigger());

    expect(optionLabels()).toHaveLength(OPTIONS.length);
  });
});

describe('Combobox — choosing', () => {
  it('reports the value, not the label', () => {
    const onChange = open();
    fireEvent.click(trigger());

    fireEvent.mouseDown(screen.getByText('ლიპოსაქცია'));

    expect(onChange).toHaveBeenCalledWith('liposuction');
  });

  it('closes once a choice is made', async () => {
    open();
    fireEvent.click(trigger());

    fireEvent.mouseDown(screen.getByText('ლიპოსაქცია'));

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('marks the current value as the selected option', () => {
    open('liposuction');
    fireEvent.click(trigger());

    const selected = screen.getAllByRole('option').filter(node => node.getAttribute('aria-selected') === 'true');
    expect(selected.map(node => node.textContent)).toEqual(['ლიპოსაქცია']);
  });
});

describe('Combobox — keyboard', () => {
  it('picks the highlighted option on Enter', () => {
    const onChange = open();
    fireEvent.click(trigger());

    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('botox_injection');
  });

  it('applies Enter to the filtered list, not the full one', () => {
    const onChange = open();
    fireEvent.click(trigger());

    type('liposuction');
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('liposuction');
  });

  it('wraps from the first option to the last', () => {
    const onChange = open();
    fireEvent.click(trigger());

    fireEvent.keyDown(search(), { key: 'ArrowUp' });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('other');
  });

  it('jumps to the last option on End', () => {
    const onChange = open();
    fireEvent.click(trigger());

    fireEvent.keyDown(search(), { key: 'End' });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('other');
  });

  it('does nothing on Enter when nothing matches', () => {
    const onChange = open();
    fireEvent.click(trigger());

    type('zzzz');
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  /*
    The procedure form submits on Enter. Without preventDefault the keystroke that picks a
    procedure also saves the form, which is a different action than the clinician asked for.
  */
  it('does not submit the surrounding form', () => {
    const onSubmit = vi.fn(event => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Combobox
          options={OPTIONS}
          value=""
          onChange={vi.fn()}
          placeholder="selectProcedure"
          searchPlaceholder="searchProcedure"
          emptyMessage="noProcedureFound"
        />
      </form>
    );

    fireEvent.click(trigger());
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Combobox — accessibility', () => {
  it('reports its expanded state on the trigger', async () => {
    open();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger());

    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'true'));
  });

  it('points the search box at the list and the highlighted option', () => {
    open();
    fireEvent.click(trigger());

    const list = screen.getByRole('listbox');
    expect(search()).toHaveAttribute('aria-controls', list.id);
    expect(search()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id);
  });

  it('drops the active descendant when the list is empty', () => {
    open();
    fireEvent.click(trigger());

    type('zzzz');

    expect(search()).not.toHaveAttribute('aria-activedescendant');
  });

  it('cannot be opened when disabled', () => {
    render(
      <Combobox
        options={OPTIONS}
        value=""
        onChange={vi.fn()}
        placeholder="selectProcedure"
        searchPlaceholder="searchProcedure"
        emptyMessage="noProcedureFound"
        disabled
      />
    );

    expect(trigger()).toBeDisabled();
  });
});

/** The value is owned by the form around it, so it has to render what it is handed back. */
describe('Combobox — as a controlled field', () => {
  function Harness() {
    const [value, setValue] = useState('');
    return (
      <Combobox
        options={OPTIONS}
        value={value}
        onChange={setValue}
        placeholder="selectProcedure"
        searchPlaceholder="searchProcedure"
        emptyMessage="noProcedureFound"
      />
    );
  }

  it('shows the chosen procedure on the trigger afterwards', async () => {
    render(<Harness />);

    fireEvent.click(trigger());
    type('rhino');
    fireEvent.keyDown(search(), { key: 'Enter' });

    await waitFor(() => expect(trigger()).toHaveTextContent('რინოპლასტიკა'));
  });
});
