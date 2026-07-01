export interface User {
  id: string;
  displayName: string;
  phoneHint: string;
  createdAt: string;
}

export interface ContactHash {
  contactHash: string;
  frequencyBucket: 'frequent' | 'occasional' | 'rare' | 'unknown';
  excluded: boolean;
}

export interface ComparisonSession {
  id: string;
  token: string;
  expiresAt: string;
}

export interface ComparisonResult {
  id: string;
  mutualCount: number;
  mutuals: MutualContact[];
  createdAt: string;
}

export interface MutualContact {
  contactHash: string;
  yourFrequency: 'frequent' | 'occasional' | 'rare' | 'unknown';
  theirFrequency: 'frequent' | 'occasional' | 'rare' | 'unknown';
  yourWeekCount: number;
  theirWeekCount: number;
  yourMonthCount: number;
  theirMonthCount: number;
  yourTotalCount: number;
  theirTotalCount: number;
}

export interface OtpRequestResponse {
  requestId: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  salt: string;
}

export interface SyncContactsRequest {
  hashes: Array<{
    hash: string;
    frequencyBucket: 'frequent' | 'occasional' | 'rare' | 'unknown';
    weekCount: number;
    monthCount: number;
    totalCount: number;
  }>;
}
