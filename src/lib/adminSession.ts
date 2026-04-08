const ADMIN_SESSION_KEY = "mega-futures-admin-session";

export function getAdminPassword() {
  return localStorage.getItem(ADMIN_SESSION_KEY) ?? sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "";
}

export function hasAdminSession() {
  return !!getAdminPassword();
}

export function setAdminPassword(password: string) {
  localStorage.setItem(ADMIN_SESSION_KEY, password);
  sessionStorage.setItem(ADMIN_SESSION_KEY, password);
}

export function clearAdminPassword() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
