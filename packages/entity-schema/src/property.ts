// Property — a physical address/parcel
// Persons relate to properties through person_properties (effective-dated).

export interface Property {
  id: string; // ULID
  streetLine1: string;
  streetLine2?: string;
  city: string;
  state: string; // 2-letter US state code
  zip: string;
  country: string; // default: 'US'
  yearBuilt?: number;
  grossSqft?: number;
  propertyType?: string; // 'single_family','condo','townhouse','multi_family','other'
  createdAt: string; // ISO-8601
  updatedAt: string;
}

export interface CreatePropertyInput {
  streetLine1: string;
  streetLine2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  yearBuilt?: number;
  grossSqft?: number;
  propertyType?: string;
}
