export enum Route {
  LOGIN = '/login',
  REGISTER = '/register',
  HOME = '/',
  BUDGET = '/budget',
  TRANSACTIONS = '/transactions',
  SHARED = '/shared',
  SHARED_JOIN = '/shared/join/:code',
  SHARED_DASHBOARD = '/shared/:groupId',
  PROFILE = '/profile',
}

export const protectedRoutes = [
  Route.HOME,
  Route.BUDGET,
  Route.TRANSACTIONS,
  Route.PROFILE,
  Route.SHARED,
];
