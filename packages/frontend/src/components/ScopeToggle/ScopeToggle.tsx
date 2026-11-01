import YmSegmented, { type SegmentOption } from '@ui/YmSegmented/YmSegmented';

export type Scope = 'mine' | 'household';

interface ScopeToggleProps {
  value: Scope;
  onChange: (value: Scope) => void;
}

const OPTIONS: SegmentOption<Scope>[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'household', label: 'Household' },
];

export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  return (
    <YmSegmented
      options={OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Transaction scope"
    />
  );
}

export default ScopeToggle;
