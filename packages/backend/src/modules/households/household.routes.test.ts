import app from '../../app';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { authedAgent } from '../../../test/helpers/auth';
import { makeUser } from '../../../test/helpers/factories';
import { createHousehold } from './household.service';

afterEach(truncateAll);
afterAll(closeTestDb);

it('creates a household', async () => {
  const user = await makeUser();
  const res = await authedAgent(app, user.id)
    .post('/households')
    .send({ name: 'Home' });

  expect(res.status).toBe(201);
  expect(res.body.household.name).toBe('Home');
});

it('rejects a non-member with 403 on every :id route', async () => {
  const owner = await makeUser();
  const outsider = await makeUser();
  const household = await createHousehold('Home', owner.id);
  const agent = authedAgent(app, outsider.id);

  for (const call of [
    () => agent.patch(`/households/${household.id}`).send({ name: 'x' }),
    () => agent.post(`/households/${household.id}/leave`),
    () => agent.post(`/households/${household.id}/invite-code`),
    () => agent.delete(`/households/${household.id}/members`).send({ userId: owner.id }),
  ]) {
    const res = await call();
    expect(res.status).toBe(403);
  }
});

it('404s an unknown household', async () => {
  const user = await makeUser();
  const res = await authedAgent(app, user.id).post(
    '/households/00000000-0000-7000-8000-000000000000/leave'
  );
  expect(res.status).toBe(404);
});

it('joins by code', async () => {
  const owner = await makeUser();
  const joiner = await makeUser();
  const household = await createHousehold('Home', owner.id);
  await createHousehold('Other', joiner.id);

  const res = await authedAgent(app, joiner.id)
    .post('/households/join')
    .send({ code: household.inviteCode });

  expect(res.status).toBe(200);
  expect(res.body.household.members).toHaveLength(2);
});

it('rejects an unauthenticated caller', async () => {
  const res = await (await import('supertest')).default(app).get('/households');
  expect(res.status).toBe(401);
});
