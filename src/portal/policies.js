export const isAdmin = user => user?.roleName === 'Admin';
export const USER_ROLE_ID = 2; // Role seeded and fixed by UserAdministrationService.
export const isUserEmployee = user => user?.roleId === USER_ROLE_ID && user?.roleName === 'User';
export const isBaseRole = role => role?.id === 1 || role?.id === USER_ROLE_ID;
