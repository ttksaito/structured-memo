import { Project, ProjectData } from '../types';

const PROJECTS_KEY = 'structured-memo-projects';
const PROJECT_DATA_PREFIX = 'structured-memo-data-';
const API_KEY_KEY = 'structured-memo-api-key';

export function loadProjects(): Project[] {
  const raw = localStorage.getItem(PROJECTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadProjectData(projectId: string): ProjectData | null {
  const raw = localStorage.getItem(PROJECT_DATA_PREFIX + projectId);
  return raw ? JSON.parse(raw) : null;
}

export function saveProjectData(projectId: string, data: ProjectData): void {
  localStorage.setItem(PROJECT_DATA_PREFIX + projectId, JSON.stringify(data));
}

export function deleteProjectData(projectId: string): void {
  localStorage.removeItem(PROJECT_DATA_PREFIX + projectId);
}

export function loadApiKey(): string {
  return localStorage.getItem(API_KEY_KEY) || '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_KEY, key);
}
