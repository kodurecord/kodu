// Person — a human with a relationship to a property or KODU service.
// NOT an auth user — auth_identities will link to persons when auth is added.
// email is the de-facto lookup key but is NOT the primary key.

export interface Person {
  id: string;       // ULID
  firstName?: string;
  lastName?: string;
  fullName?: string;  // retained for backwards-compat / manually-imported contacts
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface UpdatePersonInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  // email intentionally not updatable here — use a dedicated email-change flow
}
