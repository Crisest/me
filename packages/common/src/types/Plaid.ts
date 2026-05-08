import { Bank } from './Bank';

export type PlaidStatus = 'connected' | 'login_required' | 'error';

export interface PlaidLinkedBank extends Bank {
  isPlaidLinked: true;
  plaidStatus: PlaidStatus;
  plaidInstitutionId?: string;
}

export namespace PlaidPayloads {
  export interface CreateLinkTokenResponse {
    linkToken: string;
  }

  export interface ExchangeTokenRequest {
    publicToken: string;
    institutionId: string;
    institutionName: string;
  }

  export interface ExchangeTokenResponse {
    bank: PlaidLinkedBank;
  }

  export interface SyncResponse {
    added: number;
    modified: number;
    removed: number;
  }
}
