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

const years: Option<number>[] = [];
const currentYear = new Date().getFullYear();
for (let year = currentYear; year >= 2000; year--) {
  years.push({ id: year, label: year.toString(), value: year });
}

export { years, months };
