export enum Route {
  LOGIN = '/login',
  REGISTER = '/register',
  GROUPS = '/groups',
  PROJECTS = '/projects',
  HOME = '/',
  CONTACT = '/contact',
  BUDGET = '/budget',
  GROUP_DASHBOARD = '/groups/:groupId',
}

export const protectedRoutes = [Route.BUDGET];
