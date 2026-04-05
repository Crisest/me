export enum Route {
  LOGIN = '/login',
  REGISTER = '/register',
  GROUPS = '/groups',
  PROJECTS = '/projects',
  HOME = '/',
  CONTACT = '/contact',
  BUDGET = '/budget',
  GROUP_JOIN = '/groups/join/:code',
  GROUP_DASHBOARD = '/groups/:groupId',
  PROFILE = '/profile',
}

export const protectedRoutes = [Route.BUDGET, Route.PROFILE];
