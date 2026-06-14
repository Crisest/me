import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Application } from 'express';

export function signTestJwt(userId: string): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ userId }, secret, { expiresIn: '1h' });
}

export function authedAgent(
  app: Application,
  userId: string
) {
  const agent = request.agent(app);
  const token = signTestJwt(userId);
  agent.jar.setCookie(`jwt=${token}; Path=/; HttpOnly`);
  return agent;
}
