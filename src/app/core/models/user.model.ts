import { LocalizedText } from './dashboard.models';

/** Signed-in user. Name and role are bilingual for the EN / AR interface. */
export interface User {
  /** Account id (1 for the demo account). */
  id: number;
  name: LocalizedText;
  /** Sign-in email, stored lowercase. */
  email: string;
  /** Job title / department shown under the name. */
  role: LocalizedText;
  /** Avatar image file name (currently the shared placeholder avatar). */
  avatarUrl: string;
}
