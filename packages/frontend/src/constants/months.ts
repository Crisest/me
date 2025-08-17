import { Option } from '@/components/YmCombobox/YmCombobox';

const months: Option<number>[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((month, index) => ({
  id: index,
  label: month,
  value: index + 1,
}));

export default months;
