import { Request, Response } from 'express';
import { PlaidPayloads } from '@portfolio/common';
import * as plaidService from './plaid.service';

export const createLinkTokenHandler = async (req: Request, res: Response) => {
  try {
    const linkToken = await plaidService.createLinkToken(req.user!.id);
    res.json({ linkToken });
  } catch (err) {
    req.log.error({ err }, 'Failed to create Plaid link token');
    res.status(500).json({ error: 'Failed to create Plaid link token' });
  }
};

export const exchangeTokenHandler = async (req: Request, res: Response) => {
  try {
    const payload = req.body as PlaidPayloads.ExchangeTokenRequest;
    const bank = await plaidService.exchangePublicToken(req.user!.id, payload);
    res.status(201).json({ bank });
  } catch (err) {
    req.log.error({ err }, 'Failed to exchange Plaid public token');
    res.status(500).json({ error: 'Failed to exchange Plaid public token' });
  }
};

export const syncOneHandler = async (req: Request, res: Response) => {
  try {
    const result = await plaidService.syncOneBankForUser(req.user!.id, req.params.bankId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, 'Failed to sync Plaid bank');
    res.status(500).json({ error: 'Failed to sync Plaid bank' });
  }
};

export const syncAllHandler = async (req: Request, res: Response) => {
  try {
    const result = await plaidService.syncAllBanksForUser(req.user!.id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, 'Failed to sync all Plaid banks');
    res.status(500).json({ error: 'Failed to sync all Plaid banks' });
  }
};

export const unlinkBankHandler = async (req: Request, res: Response) => {
  try {
    await plaidService.unlinkBank(req.user!.id, req.params.bankId);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, 'Failed to unlink Plaid bank');
    res.status(500).json({ error: 'Failed to unlink Plaid bank' });
  }
};

export const updateLinkTokenHandler = async (req: Request, res: Response) => {
  try {
    const linkToken = await plaidService.createUpdateLinkToken(
      req.user!.id,
      req.params.bankId
    );
    res.json({ linkToken });
  } catch (err) {
    req.log.error({ err }, 'Failed to create update-mode link token');
    res.status(500).json({ error: 'Failed to create update-mode link token' });
  }
};

export const resyncBankHandler = async (req: Request, res: Response) => {
  try {
    const result = await plaidService.resyncBank(req.user!.id, req.params.bankId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, 'Failed to resync Plaid bank');
    res.status(500).json({ error: 'Failed to resync Plaid bank' });
  }
};
