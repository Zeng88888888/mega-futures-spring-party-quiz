const ADMIN_SESSION_KEY = "mega-futures-admin-session";

export function getAdminPassword() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "";
}

export function hasAdminSession() {
  return !!getAdminPassword();
}

export function setAdminPassword(password: string) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, password);
}

export function clearAdminPassword() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
