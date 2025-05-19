export enum Route {
  LOGIN = '/login',
  REGISTER = '/register',
  GROUPS = '/groups',
  PROJECTS = '/projects',
  HOME = '/',
  CONTACT = '/contact',
  BUDGET = '/budget',
}

export const protectedRoutes = [Route.BUDGET];
