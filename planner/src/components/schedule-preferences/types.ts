import type { Dispatch, SetStateAction } from 'react';
import type { SchedulePreferences } from '../../lib/preferences';

export interface SectionProps {
  draft: SchedulePreferences;
  setDraft: Dispatch<SetStateAction<SchedulePreferences>>;
}
