import type { MeetingType } from '../../types';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
}

export type AssistantProposalChange =
  | {
      type: 'set_meeting';
      courseId: string;
      meetingType: MeetingType;
      meetingId: string;
      label?: string;
      reason?: string;
    }
  | {
      type: 'add_course';
      courseId: string;
      label?: string;
      reason?: string;
    }
  | {
      type: 'remove_course';
      courseId: string;
      label?: string;
      reason?: string;
    };

export interface AssistantProposal {
  title?: string;
  summary?: string;
  changes: AssistantProposalChange[];
}

export interface AssistantLockAction {
  action: 'lock_course' | 'unlock_course' | 'lock_component' | 'unlock_component';
  courseId: string;
  meetingType?: MeetingType;
}

export interface AssistantProposalPreview {
  ok: boolean;
  message?: string;
  stats?: {
    campusDays: string;
    gaps: string;
    credits: string;
    conflicts: string;
  };
  changes?: Array<{
    title: string;
    before?: string;
    after?: string;
    reason?: string;
  }>;
  conflict?: {
    title: string;
    details: string[];
  };
}
