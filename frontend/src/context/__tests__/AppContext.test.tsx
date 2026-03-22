import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useAppContext, useSelectionManager, selectionUtils } from '../AppContext';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  it('provides initial state', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBe(null);
    expect(result.current.state.selectedAsteroids).toEqual([]);
    expect(result.current.state.classificationSystem).toBe('bus_demeo');
  });

  it('handles asteroid selection', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SELECT_ASTEROID', payload: 123 });
    });
    
    expect(result.current.state.selectedAsteroids).toContain(123);
  });

  it('handles asteroid deselection', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SELECT_ASTEROID', payload: 123 });
      result.current.dispatch({ type: 'DESELECT_ASTEROID', payload: 123 });
    });
    
    expect(result.current.state.selectedAsteroids).not.toContain(123);
  });

  it('handles classification system change', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SET_CLASSIFICATION_SYSTEM', payload: 'tholen' });
    });
    
    expect(result.current.state.classificationSystem).toBe('tholen');
  });

  it('handles loading state', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SET_LOADING', payload: true });
    });
    
    expect(result.current.state.loading).toBe(true);
  });

  it('handles error state', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SET_ERROR', payload: 'Test error' });
    });
    
    expect(result.current.state.error).toBe('Test error');
    expect(result.current.state.loading).toBe(false);
  });

  it('handles toggle asteroid selection', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    // Toggle to select
    act(() => {
      result.current.dispatch({ type: 'TOGGLE_ASTEROID_SELECTION', payload: 123 });
    });
    
    expect(result.current.state.selectedAsteroids).toContain(123);
    
    // Toggle to deselect
    act(() => {
      result.current.dispatch({ type: 'TOGGLE_ASTEROID_SELECTION', payload: 123 });
    });
    
    expect(result.current.state.selectedAsteroids).not.toContain(123);
  });

  it('handles multiple asteroid selection', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SELECT_MULTIPLE_ASTEROIDS', payload: [123, 456, 789] });
    });
    
    expect(result.current.state.selectedAsteroids).toEqual([123, 456, 789]);
  });

  it('prevents duplicate selections in multiple asteroid selection', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SELECT_ASTEROID', payload: 123 });
      result.current.dispatch({ type: 'SELECT_MULTIPLE_ASTEROIDS', payload: [123, 456, 789] });
    });
    
    expect(result.current.state.selectedAsteroids).toEqual([123, 456, 789]);
  });

  it('handles clear selection', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    
    act(() => {
      result.current.dispatch({ type: 'SELECT_MULTIPLE_ASTEROIDS', payload: [123, 456, 789] });
      result.current.dispatch({ type: 'CLEAR_SELECTION' });
    });
    
    expect(result.current.state.selectedAsteroids).toEqual([]);
  });
});

describe('selectionUtils', () => {
  it('correctly identifies if asteroid is selected', () => {
    expect(selectionUtils.isAsteroidSelected([1, 2, 3], 2)).toBe(true);
    expect(selectionUtils.isAsteroidSelected([1, 2, 3], 4)).toBe(false);
    expect(selectionUtils.isAsteroidSelected([], 1)).toBe(false);
  });

  it('correctly determines if more selections are allowed', () => {
    expect(selectionUtils.canSelectMore([1, 2, 3], 5)).toBe(true);
    expect(selectionUtils.canSelectMore([1, 2, 3], 3)).toBe(false);
    expect(selectionUtils.canSelectMore([1, 2, 3], 2)).toBe(false);
  });

  it('correctly counts selections', () => {
    expect(selectionUtils.getSelectionCount([1, 2, 3])).toBe(3);
    expect(selectionUtils.getSelectionCount([])).toBe(0);
  });

  it('correctly determines if there are selections', () => {
    expect(selectionUtils.hasSelections([1, 2, 3])).toBe(true);
    expect(selectionUtils.hasSelections([])).toBe(false);
  });

  it('correctly determines if selection would exceed limit', () => {
    expect(selectionUtils.wouldExceedLimit([1, 2], 2, 5)).toBe(false);
    expect(selectionUtils.wouldExceedLimit([1, 2], 4, 5)).toBe(true);
    expect(selectionUtils.wouldExceedLimit([1, 2, 3], 1, 3)).toBe(true);
  });

  it('correctly calculates remaining selections', () => {
    expect(selectionUtils.getRemainingSelections([1, 2], 5)).toBe(3);
    expect(selectionUtils.getRemainingSelections([1, 2, 3], 3)).toBe(0);
    expect(selectionUtils.getRemainingSelections([1, 2, 3, 4], 3)).toBe(0);
  });
});

describe('useSelectionManager', () => {
  it('provides correct initial state', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    expect(result.current.selectedAsteroids).toEqual([]);
    expect(result.current.selectionCount).toBe(0);
    expect(result.current.hasSelections).toBe(false);
    expect(result.current.canSelectMore).toBe(true);
    expect(result.current.remainingSelections).toBe(5);
    expect(result.current.maxSelections).toBe(5);
  });

  it('handles asteroid selection successfully', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      const response = result.current.selectAsteroid(123);
      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });
    
    expect(result.current.selectedAsteroids).toContain(123);
    expect(result.current.selectionCount).toBe(1);
    expect(result.current.hasSelections).toBe(true);
    expect(result.current.remainingSelections).toBe(4);
  });

  it('prevents duplicate asteroid selection', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      result.current.selectAsteroid(123);
    });
    
    act(() => {
      const response = result.current.selectAsteroid(123);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Asteroid is already selected');
    });
    
    expect(result.current.selectionCount).toBe(1);
  });

  it('enforces maximum selection limit', () => {
    const { result } = renderHook(() => useSelectionManager(2), { wrapper });
    
    act(() => {
      result.current.selectAsteroid(123);
      result.current.selectAsteroid(456);
    });
    
    act(() => {
      const response = result.current.selectAsteroid(789);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Maximum of 2 asteroids can be selected at once.');
    });
    
    expect(result.current.selectionCount).toBe(2);
    expect(result.current.canSelectMore).toBe(false);
  });

  it('handles asteroid deselection successfully', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      result.current.selectAsteroid(123);
    });
    
    act(() => {
      const response = result.current.deselectAsteroid(123);
      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });
    
    expect(result.current.selectedAsteroids).not.toContain(123);
    expect(result.current.selectionCount).toBe(0);
  });

  it('prevents deselection of non-selected asteroid', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      const response = result.current.deselectAsteroid(123);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Asteroid is not selected');
    });
  });

  it('handles toggle selection correctly', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    // Toggle to select
    act(() => {
      const response = result.current.toggleAsteroidSelection(123);
      expect(response.success).toBe(true);
    });
    
    expect(result.current.selectedAsteroids).toContain(123);
    
    // Toggle to deselect
    act(() => {
      const response = result.current.toggleAsteroidSelection(123);
      expect(response.success).toBe(true);
    });
    
    expect(result.current.selectedAsteroids).not.toContain(123);
  });

  it('handles multiple asteroid selection successfully', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      const response = result.current.selectMultipleAsteroids([123, 456, 789]);
      expect(response.success).toBe(true);
      expect(response.selected).toEqual([123, 456, 789]);
    });
    
    expect(result.current.selectedAsteroids).toEqual([123, 456, 789]);
    expect(result.current.selectionCount).toBe(3);
  });

  it('prevents multiple selection that would exceed limit', () => {
    const { result } = renderHook(() => useSelectionManager(2), { wrapper });
    
    act(() => {
      const response = result.current.selectMultipleAsteroids([123, 456, 789]);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Cannot select 3 asteroids. Only 2 selections remaining.');
      expect(response.selected).toEqual([]);
    });
    
    expect(result.current.selectionCount).toBe(0);
  });

  it('handles multiple selection with some already selected', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      result.current.selectAsteroid(123);
    });
    
    act(() => {
      const response = result.current.selectMultipleAsteroids([123, 456, 789]);
      expect(response.success).toBe(true);
      expect(response.selected).toEqual([456, 789]);
    });
    
    expect(result.current.selectedAsteroids).toEqual([123, 456, 789]);
  });

  it('prevents multiple selection when all are already selected', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      result.current.selectMultipleAsteroids([123, 456]);
    });
    
    act(() => {
      const response = result.current.selectMultipleAsteroids([123, 456]);
      expect(response.success).toBe(false);
      expect(response.error).toBe('All specified asteroids are already selected');
    });
  });

  it('clears all selections', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      result.current.selectMultipleAsteroids([123, 456, 789]);
      result.current.clearAllSelections();
    });
    
    expect(result.current.selectedAsteroids).toEqual([]);
    expect(result.current.selectionCount).toBe(0);
    expect(result.current.hasSelections).toBe(false);
  });

  it('correctly identifies if asteroid is selected', () => {
    const { result } = renderHook(() => useSelectionManager(5), { wrapper });
    
    act(() => {
      result.current.selectAsteroid(123);
    });
    
    expect(result.current.isAsteroidSelected(123)).toBe(true);
    expect(result.current.isAsteroidSelected(456)).toBe(false);
  });
});