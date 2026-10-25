export interface ApplicationSettings {
  organizationName: string;
  projectName: string;
  brandTagline: string;
  slaCriticalMinutes: number;
  slaStandardMinutes: number;
  autoGuestFollowUp: boolean;
  alertEmail: string;
  defaultTimezone: string;
  dataRetentionDays: number;
}

export interface PropertySettingConfig {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  brand: string;
  isActive: boolean;
  totalRooms: number;
  location: string;
  contactEmail: string;
  contactPhone: string;
  welcomeMessage: string;
}

let appSettingsStore: ApplicationSettings = {
  organizationName: "Vistora Hospitality Collection",
  projectName: "Vistora Guest Experience & SLA Platform",
  brandTagline: "Luxury Hospitality Service Recovery & CSAT Intelligence",
  slaCriticalMinutes: 15,
  slaStandardMinutes: 120,
  autoGuestFollowUp: true,
  alertEmail: "operations@vistora.app",
  defaultTimezone: "Asia/Bangkok",
  dataRetentionDays: 365,
};

let propertySettingsStore: Record<string, PropertySettingConfig> = {
  "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11": {
    propertyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    propertyName: "Vistora Riverside Bangkok",
    propertyCode: "VRB",
    brand: "Vistora Hotels & Resorts",
    isActive: true,
    totalRooms: 376,
    location: "Bangkok, Thailand",
    contactEmail: "riverside.ops@vistora.app",
    contactPhone: "+66 2 123 4567",
    welcomeMessage: "Welcome to Vistora Riverside Bangkok. Your comfort is our supreme honor.",
  },
  "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22": {
    propertyId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    propertyName: "Vistora Siam Bangkok",
    propertyCode: "VSB",
    brand: "Vistora Hotels & Resorts",
    isActive: true,
    totalRooms: 354,
    location: "Bangkok, Thailand",
    contactEmail: "siam.ops@vistora.app",
    contactPhone: "+66 2 987 6543",
    welcomeMessage: "Welcome to Vistora Siam. Experience elevated urban tranquility.",
  },
  "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33": {
    propertyId: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    propertyName: "Vistora Chiang Mai Resort",
    propertyCode: "VCM",
    brand: "Vistora Hotels & Resorts",
    isActive: true,
    totalRooms: 84,
    location: "Chiang Mai, Thailand",
    contactEmail: "chiangmai.ops@vistora.app",
    contactPhone: "+66 53 123 789",
    welcomeMessage: "Welcome to Vistora Chiang Mai Resort. An sanctuary of peace and cultural grandeur.",
  },
};

export function getApplicationSettings(): ApplicationSettings {
  return { ...appSettingsStore };
}

export function updateApplicationSettings(patch: Partial<ApplicationSettings>): ApplicationSettings {
  appSettingsStore = { ...appSettingsStore, ...patch };
  return { ...appSettingsStore };
}

export function getPropertySetting(propertyId: string): PropertySettingConfig | null {
  return propertySettingsStore[propertyId] || null;
}

export function getAllPropertySettings(): PropertySettingConfig[] {
  return Object.values(propertySettingsStore);
}

export function updatePropertySetting(
  propertyId: string,
  patch: Partial<PropertySettingConfig>
): PropertySettingConfig {
  const existing = propertySettingsStore[propertyId] || {
    propertyId,
    propertyName: "Hotel Property",
    propertyCode: "HTL",
    brand: "Vistora",
    isActive: true,
    totalRooms: 100,
    location: "Thailand",
    contactEmail: "concierge@vistora.app",
    contactPhone: "",
    welcomeMessage: "Welcome to Vistora.",
  };

  propertySettingsStore[propertyId] = {
    ...existing,
    ...patch,
    propertyId,
  };

  return propertySettingsStore[propertyId];
}
