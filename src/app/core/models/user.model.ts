import { LocalizedText } from './dashboard.models';

/** Signed-in user. Name and role are bilingual for the EN / AR interface. */
export interface User {
  id: number;
  name: LocalizedText;
  email: string;
  /** Job title / department shown under the name. */
  role: LocalizedText;
  avatarUrl: string;
}
