export enum Route {
  LOGIN = '/login',
  REGISTER = '/register',
  HOME = '/',
  BUDGET = '/budget',
  SHARED = '/shared',
  SHARED_JOIN = '/shared/join/:code',
  SHARED_DASHBOARD = '/shared/:groupId',
  PROFILE = '/profile',
}

export const protectedRoutes = [Route.HOME, Route.BUDGET, Route.PROFILE, Route.SHARED];
