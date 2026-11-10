import type { Day } from '../../types';

export function toggleDay(list: Day[], day: Day): Day[] {
  return list.includes(day) ? list.filter((d) => d !== day) : [...list, day];
}
