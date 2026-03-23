import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Types for the application state
export interface Asteroid {
  id: number;
  official_number?: number | null;
  proper_name?: string | null;
  provisional_designation?: string | null;
  bus_demeo_class?: string | null;
  tholen_class?: string | null;
  orbital_class?: string | null;
  identifiers?: {
    official_number?: number | null;
    proper_name?: string | null;
    provisional_designation?: string | null;
  };
  classifications?: {
    bus_demeo_class?: string | null;
    tholen_class?: string | null;
    orbital_class?: string | null;
  };
  orbital_elements?: OrbitalElements;
  physical_properties?: PhysicalProperties;
}

export interface OrbitalElements {
  semi_major_axis?: number;
  eccentricity?: number;
  inclination?: number;
  orbital_period?: number;
  perihelion_distance?: number;
  aphelion_distance?: number;
}

export interface PhysicalProperties {
  diameter?: number | null;
  albedo?: number | null;
  rotation_period?: number | null;
  density?: number | null;
}

export interface SpectralData {
  asteroid_id: number;
  wavelengths: number[];
  reflectances: number[];
  normalized?: boolean;
}

export interface ClassificationSystem {
  name: string;
  classes: string[];
}

// Application state interface
export interface AppState {
  // UI state
  loading: boolean;
  error: string | null;
  
  // Data state
  selectedAsteroids: number[];
  classificationSystem: 'bus_demeo' | 'tholen';
  availableClassifications: ClassificationSystem[];
  asteroidData: Record<number, Asteroid>;
  spectralData: Record<number, SpectralData>;
  focusedAsteroidId: number | null;
  
  // UI preferences
  showSpectralChart: boolean;
  showPropertiesPanel: boolean;
}

// Action types
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_ASTEROID'; payload: number }
  | { type: 'DESELECT_ASTEROID'; payload: number }
  | { type: 'TOGGLE_ASTEROID_SELECTION'; payload: number }
  | { type: 'SELECT_MULTIPLE_ASTEROIDS'; payload: number[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_CLASSIFICATION_SYSTEM'; payload: 'bus_demeo' | 'tholen' }
  | { type: 'SET_AVAILABLE_CLASSIFICATIONS'; payload: ClassificationSystem[] }
  | { type: 'SET_ASTEROID_DATA'; payload: { id: number; data: Asteroid } }
  | { type: 'SET_SPECTRAL_DATA'; payload: { id: number; data: SpectralData } }
  | { type: 'SET_FOCUSED_ASTEROID'; payload: number | null }
  | { type: 'TOGGLE_SPECTRAL_CHART' }
  | { type: 'TOGGLE_PROPERTIES_PANEL' };

// Initial state
export const initialAppState: AppState = {
  loading: false,
  error: null,
  selectedAsteroids: [],
  classificationSystem: 'bus_demeo',
  availableClassifications: [],
  asteroidData: {},
  spectralData: {},
  focusedAsteroidId: null,
  showSpectralChart: true,
  showPropertiesPanel: true,
};

// Reducer function
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SELECT_ASTEROID':
      if (state.selectedAsteroids.includes(action.payload)) {
        return state;
      }
      return {
        ...state,
        selectedAsteroids: [...state.selectedAsteroids, action.payload],
        focusedAsteroidId: action.payload,
      };

    case 'DESELECT_ASTEROID': {
      const remaining = state.selectedAsteroids.filter(id => id !== action.payload);
      const nextFocus =
        state.focusedAsteroidId === action.payload
          ? remaining.length > 0
            ? remaining[remaining.length - 1]
            : null
          : state.focusedAsteroidId;
      return {
        ...state,
        selectedAsteroids: remaining,
        focusedAsteroidId: nextFocus,
      };
    }
    
    case 'TOGGLE_ASTEROID_SELECTION': {
      const isCurrentlySelected = state.selectedAsteroids.includes(action.payload);
      if (isCurrentlySelected) {
        const remaining = state.selectedAsteroids.filter(id => id !== action.payload);
        const nextFocus =
          state.focusedAsteroidId === action.payload
            ? remaining.length > 0
              ? remaining[remaining.length - 1]
              : null
            : state.focusedAsteroidId;
        return {
          ...state,
          selectedAsteroids: remaining,
          focusedAsteroidId: nextFocus,
        };
      }

      return {
        ...state,
        selectedAsteroids: [...state.selectedAsteroids, action.payload],
        focusedAsteroidId: action.payload,
      };
    }
    
    case 'SELECT_MULTIPLE_ASTEROIDS': {
      const newSelections = action.payload.filter(id => !state.selectedAsteroids.includes(id));
      const updatedSelections = [...state.selectedAsteroids, ...newSelections];
      const nextFocus =
        newSelections.length > 0
          ? newSelections[newSelections.length - 1]
          : state.focusedAsteroidId;
      return {
        ...state,
        selectedAsteroids: updatedSelections,
        focusedAsteroidId: nextFocus,
      };
    }
    
    case 'CLEAR_SELECTION':
      return { ...state, selectedAsteroids: [], focusedAsteroidId: null };
    
    case 'SET_CLASSIFICATION_SYSTEM':
      return { ...state, classificationSystem: action.payload };
    
    case 'SET_AVAILABLE_CLASSIFICATIONS':
      return { ...state, availableClassifications: action.payload };
    
    case 'SET_ASTEROID_DATA':
      return {
        ...state,
        asteroidData: {
          ...state.asteroidData,
          [action.payload.id]: action.payload.data,
        },
      };
    
    case 'SET_SPECTRAL_DATA':
      return {
        ...state,
        spectralData: {
          ...state.spectralData,
          [action.payload.id]: action.payload.data,
        },
      };

    case 'SET_FOCUSED_ASTEROID':
      if (state.focusedAsteroidId === action.payload) {
        return state;
      }
      return {
        ...state,
        focusedAsteroidId: action.payload,
      };
    
    case 'TOGGLE_SPECTRAL_CHART':
      return { ...state, showSpectralChart: !state.showSpectralChart };
    
    case 'TOGGLE_PROPERTIES_PANEL':
      return { ...state, showPropertiesPanel: !state.showPropertiesPanel };
    
    default:
      return state;
  }
};

// Context interface
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

// Create context
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Selection utility functions
export const selectionUtils = {
  isAsteroidSelected: (selectedAsteroids: number[], asteroidId: number): boolean => {
    return selectedAsteroids.includes(asteroidId);
  },
  
  canSelectMore: (selectedAsteroids: number[], maxSelections: number): boolean => {
    return selectedAsteroids.length < maxSelections;
  },
  
  getSelectionCount: (selectedAsteroids: number[]): number => {
    return selectedAsteroids.length;
  },
  
  hasSelections: (selectedAsteroids: number[]): boolean => {
    return selectedAsteroids.length > 0;
  },
  
  wouldExceedLimit: (selectedAsteroids: number[], additionalCount: number, maxSelections: number): boolean => {
    return selectedAsteroids.length + additionalCount > maxSelections;
  },
  
  getRemainingSelections: (selectedAsteroids: number[], maxSelections: number): number => {
    return Math.max(0, maxSelections - selectedAsteroids.length);
  }
};

// Custom hook to use the context
export const useOptionalAppContext = (): AppContextType | undefined => {
  return useContext(AppContext);
};

export const useAppContext = (): AppContextType => {
  const context = useOptionalAppContext();
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// Custom hook for selection management
export const useSelectionManager = (maxSelections: number = 10) => {
  const { state, dispatch } = useAppContext();
  
  const selectAsteroid = useCallback((asteroidId: number): { success: boolean; error?: string } => {
    if (selectionUtils.isAsteroidSelected(state.selectedAsteroids, asteroidId)) {
      return { success: false, error: 'Asteroid is already selected' };
    }
    
    if (!selectionUtils.canSelectMore(state.selectedAsteroids, maxSelections)) {
      return { success: false, error: `Maximum of ${maxSelections} asteroids can be selected at once.` };
    }
    
    dispatch({ type: 'SELECT_ASTEROID', payload: asteroidId });
    return { success: true };
  }, [state.selectedAsteroids, maxSelections, dispatch]);
  
  const deselectAsteroid = useCallback((asteroidId: number): { success: boolean; error?: string } => {
    if (!selectionUtils.isAsteroidSelected(state.selectedAsteroids, asteroidId)) {
      return { success: false, error: 'Asteroid is not selected' };
    }
    
    dispatch({ type: 'DESELECT_ASTEROID', payload: asteroidId });
    return { success: true };
  }, [state.selectedAsteroids, dispatch]);
  
  const toggleAsteroidSelection = useCallback((asteroidId: number): { success: boolean; error?: string } => {
    if (selectionUtils.isAsteroidSelected(state.selectedAsteroids, asteroidId)) {
      return deselectAsteroid(asteroidId);
    } else {
      return selectAsteroid(asteroidId);
    }
  }, [state.selectedAsteroids, selectAsteroid, deselectAsteroid]);
  
  const selectMultipleAsteroids = useCallback((asteroidIds: number[]): { success: boolean; error?: string; selected: number[] } => {
    const newSelections = asteroidIds.filter(id => !selectionUtils.isAsteroidSelected(state.selectedAsteroids, id));
    
    if (selectionUtils.wouldExceedLimit(state.selectedAsteroids, newSelections.length, maxSelections)) {
      const remaining = selectionUtils.getRemainingSelections(state.selectedAsteroids, maxSelections);
      return { 
        success: false, 
        error: `Cannot select ${newSelections.length} asteroids. Only ${remaining} selections remaining.`,
        selected: []
      };
    }
    
    if (newSelections.length === 0) {
      return { success: false, error: 'All specified asteroids are already selected', selected: [] };
    }
    
    dispatch({ type: 'SELECT_MULTIPLE_ASTEROIDS', payload: newSelections });
    return { success: true, selected: newSelections };
  }, [state.selectedAsteroids, maxSelections, dispatch]);
  
  const clearAllSelections = useCallback((): void => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, [dispatch]);
  
  return {
    selectedAsteroids: state.selectedAsteroids,
    selectionCount: selectionUtils.getSelectionCount(state.selectedAsteroids),
    hasSelections: selectionUtils.hasSelections(state.selectedAsteroids),
    canSelectMore: selectionUtils.canSelectMore(state.selectedAsteroids, maxSelections),
    remainingSelections: selectionUtils.getRemainingSelections(state.selectedAsteroids, maxSelections),
    maxSelections,
    selectAsteroid,
    deselectAsteroid,
    toggleAsteroidSelection,
    selectMultipleAsteroids,
    clearAllSelections,
    isAsteroidSelected: (asteroidId: number) => selectionUtils.isAsteroidSelected(state.selectedAsteroids, asteroidId),
  };
};
