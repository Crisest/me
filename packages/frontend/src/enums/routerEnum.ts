export enum Route {
  LOGIN = '/login',
  REGISTER = '/register',
  HOME = '/',
  BUDGET = '/budget',
  TRANSACTIONS = '/transactions',
  PROFILE = '/profile',
  HOUSEHOLD = '/household',
  HOUSEHOLD_JOIN = '/household/join/:code',
}

export const protectedRoutes = [
  Route.HOME,
  Route.BUDGET,
  Route.TRANSACTIONS,
  Route.PROFILE,
  Route.HOUSEHOLD,
];
