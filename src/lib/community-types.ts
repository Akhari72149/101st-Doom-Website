export type CommunityPerson = {
  id: string;
  name: string;
  rank: string;
  rankLevel: number;
  slotId: string | null;
  slotLabel: string;
  section: string;
  subsection: string;
  mos: string | null;
};

export type CertificationLead = {
  family: string;
  person: CommunityPerson;
  certifications: string[];
};

export type RoleContact = {
  userId: string;
  name: string;
  tags: string[];
  person: CommunityPerson | null;
};

export type RecognitionEvent = {
  id: string;
  type: "promotion" | "certification" | "medal";
  occurredAt: string;
  person: CommunityPerson;
  title: string;
  detail: string;
  award?: { category: string | null; iconKey: string | null; color: string };
};

export type CommunityResponse = {
  leadership: CommunityPerson[];
  certificationLeads: CertificationLead[];
  roleContacts: RoleContact[];
  recognition: RecognitionEvent[];
};
