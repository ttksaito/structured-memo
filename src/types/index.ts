export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Column {
  id: string;
  name: string;
  description: string;
  order: number;
  visible: boolean;
}

export interface Row {
  id: string;
  name: string;
  order: number;
}

export interface Cell {
  id: string;
  rowId: string;
  columnId: string;
  value: string;
  annotation: string;
}

export interface ChatThread {
  cellId: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface CellInterest {
  cellId: string;
  chatCount: number;
  lastChattedAt: string | null;
  star: boolean;
}

export interface ProjectData {
  columns: Column[];
  rows: Row[];
  cells: Cell[];
  threads: ChatThread[];
  interests: CellInterest[];
}

export type View = 'home' | 'project';

export interface AppState {
  view: View;
  projects: Project[];
  currentProjectId: string | null;
  projectData: ProjectData | null;
  selectedCellId: string | null;
  focusedColumnId: string | null;
  apiKey: string;
  searchQuery: string;
}

export type AppAction =
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'DELETE_PROJECT'; projectId: string }
  | { type: 'SELECT_PROJECT'; projectId: string; data: ProjectData }
  | { type: 'CLOSE_PROJECT' }
  | { type: 'ADD_COLUMN'; column: Column }
  | { type: 'UPDATE_COLUMN'; column: Column }
  | { type: 'DELETE_COLUMN'; columnId: string }
  | { type: 'REORDER_COLUMNS'; columns: Column[] }
  | { type: 'ADD_ROW'; row: Row; cells?: Cell[] }
  | { type: 'DELETE_ROW'; rowId: string }
  | { type: 'UPDATE_CELL'; cell: Cell }
  | { type: 'SELECT_CELL'; cellId: string | null }
  | { type: 'ADD_MESSAGE'; cellId: string; message: ChatMessage }
  | { type: 'UPDATE_INTEREST'; interest: CellInterest }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'FOCUS_COLUMN'; columnId: string | null };
