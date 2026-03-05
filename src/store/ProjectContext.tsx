import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { AppState, AppAction, ProjectData } from '../types';
import { createSampleData } from '../utils/sampleData';
import {
  dbLoadProjects, dbSaveProject, dbDeleteProject,
  dbUpsertColumn, dbDeleteColumn, dbReorderColumns,
  dbUpsertRow, dbDeleteRow,
  dbUpsertCell, dbInsertMessage, dbUpsertInterest,
  dbSaveProjectData,
} from './supabaseStorage';

const HARDCODED_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

const initialState: AppState = {
  view: 'home',
  projects: [],
  currentProjectId: null,
  projectData: null,
  selectedCellId: null,
  focusedColumnId: null,
  apiKey: HARDCODED_API_KEY,
  searchQuery: '',
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_PROJECTS':
      return { ...state, projects: action.projects };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.project] };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.projectId),
        ...(state.currentProjectId === action.projectId
          ? { currentProjectId: null, projectData: null, view: 'home' as const, selectedCellId: null }
          : {}),
      };
    case 'SELECT_PROJECT':
      return {
        ...state,
        view: 'project',
        currentProjectId: action.projectId,
        projectData: action.data,
        selectedCellId: null,
        searchQuery: '',
      };
    case 'CLOSE_PROJECT':
      return { ...state, view: 'home', currentProjectId: null, projectData: null, selectedCellId: null, searchQuery: '' };
    case 'ADD_COLUMN': {
      if (!state.projectData) return state;
      return { ...state, projectData: { ...state.projectData, columns: [...state.projectData.columns, action.column] } };
    }
    case 'UPDATE_COLUMN': {
      if (!state.projectData) return state;
      return {
        ...state,
        projectData: {
          ...state.projectData,
          columns: state.projectData.columns.map(c => (c.id === action.column.id ? action.column : c)),
        },
      };
    }
    case 'DELETE_COLUMN': {
      if (!state.projectData) return state;
      return {
        ...state,
        projectData: {
          ...state.projectData,
          columns: state.projectData.columns.filter(c => c.id !== action.columnId),
          cells: state.projectData.cells.filter(c => c.columnId !== action.columnId),
        },
      };
    }
    case 'REORDER_COLUMNS': {
      if (!state.projectData) return state;
      return { ...state, projectData: { ...state.projectData, columns: action.columns } };
    }
    case 'ADD_ROW': {
      if (!state.projectData) return state;
      const newCells = action.cells ?? state.projectData.columns.map(col => ({
        id: `${action.row.id}-${col.id}`,
        rowId: action.row.id,
        columnId: col.id,
        value: '',
        annotation: '',
      }));
      return {
        ...state,
        projectData: {
          ...state.projectData,
          rows: [...state.projectData.rows, action.row],
          cells: [...state.projectData.cells, ...newCells],
        },
      };
    }
    case 'DELETE_ROW': {
      if (!state.projectData) return state;
      return {
        ...state,
        projectData: {
          ...state.projectData,
          rows: state.projectData.rows.filter(r => r.id !== action.rowId),
          cells: state.projectData.cells.filter(c => c.rowId !== action.rowId),
          threads: state.projectData.threads.filter(t => !t.cellId.startsWith(action.rowId + '-')),
          interests: state.projectData.interests.filter(i => !i.cellId.startsWith(action.rowId + '-')),
        },
        selectedCellId: state.selectedCellId?.startsWith(action.rowId + '-') ? null : state.selectedCellId,
      };
    }
    case 'UPDATE_CELL': {
      if (!state.projectData) return state;
      const exists = state.projectData.cells.some(c => c.id === action.cell.id);
      return {
        ...state,
        projectData: {
          ...state.projectData,
          cells: exists
            ? state.projectData.cells.map(c => (c.id === action.cell.id ? action.cell : c))
            : [...state.projectData.cells, action.cell],
        },
      };
    }
    case 'SELECT_CELL':
      return { ...state, selectedCellId: action.cellId };
    case 'ADD_MESSAGE': {
      if (!state.projectData) return state;
      const threadExists = state.projectData.threads.some(t => t.cellId === action.cellId);
      const threads = threadExists
        ? state.projectData.threads.map(t =>
            t.cellId === action.cellId ? { ...t, messages: [...t.messages, action.message] } : t
          )
        : [...state.projectData.threads, { cellId: action.cellId, messages: [action.message] }];
      return { ...state, projectData: { ...state.projectData, threads } };
    }
    case 'UPDATE_INTEREST': {
      if (!state.projectData) return state;
      const exists = state.projectData.interests.some(i => i.cellId === action.interest.cellId);
      return {
        ...state,
        projectData: {
          ...state.projectData,
          interests: exists
            ? state.projectData.interests.map(i => (i.cellId === action.interest.cellId ? action.interest : i))
            : [...state.projectData.interests, action.interest],
        },
      };
    }
    case 'SET_API_KEY':
      return { ...state, apiKey: action.apiKey };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    case 'FOCUS_COLUMN':
      return { ...state, focusedColumnId: action.columnId };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: (action: AppAction) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = React.useState(true);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Load projects from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        let projects = await dbLoadProjects();
        if (projects.length === 0) {
          const seedId = 'proj-seed-org';
          const seedProject = { id: seedId, name: '組織研究', createdAt: new Date().toISOString() };
          await dbSaveProject(seedProject);
          const sampleData = createSampleData();
          await dbSaveProjectData(seedId, sampleData);
          projects = [seedProject];
        }
        dispatch({ type: 'SET_PROJECTS', projects });
        dispatch({ type: 'SET_API_KEY', apiKey: HARDCODED_API_KEY });
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const wrappedDispatch = (action: AppAction): void => {
    const currentState = stateRef.current;
    const projectId = currentState.currentProjectId;

    // Optimistic local update
    dispatch(action);

    // Async Supabase sync (fire and forget)
    (async () => {
      switch (action.type) {
        case 'ADD_PROJECT':
          await dbSaveProject(action.project);
          break;
        case 'DELETE_PROJECT':
          await dbDeleteProject(action.projectId);
          break;
        case 'ADD_COLUMN':
          if (projectId) await dbUpsertColumn(action.column, projectId);
          break;
        case 'UPDATE_COLUMN':
          if (projectId) await dbUpsertColumn(action.column, projectId);
          break;
        case 'DELETE_COLUMN':
          await dbDeleteColumn(action.columnId);
          break;
        case 'REORDER_COLUMNS':
          await dbReorderColumns(action.columns);
          break;
        case 'ADD_ROW': {
          if (projectId) {
            const cols = currentState.projectData?.columns || [];
            const newCells = action.cells ?? cols.map(col => ({
              id: `${action.row.id}-${col.id}`,
              rowId: action.row.id,
              columnId: col.id,
              value: '',
              annotation: '',
            }));
            await dbUpsertRow(action.row, projectId, newCells);
          }
          break;
        }
        case 'DELETE_ROW':
          await dbDeleteRow(action.rowId);
          break;
        case 'UPDATE_CELL':
          await dbUpsertCell(action.cell);
          break;
        case 'ADD_MESSAGE':
          await dbInsertMessage(action.cellId, action.message);
          break;
        case 'UPDATE_INTEREST':
          await dbUpsertInterest(action.interest);
          break;
      }
    })().catch(err => console.error('Supabase sync error:', err));
  };

  return (
    <AppContext.Provider value={{ state, dispatch: wrappedDispatch, loading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
