import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ExportManager } from '../ExportManager';
import { apiClient } from '../../../services/api';

// Mock the API client
vi.mock('../../../services/api', () => ({
  apiClient: {
    exportData: vi.fn(),
    exportSpectrum: vi.fn(),
  },
  apiUtils: {
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
    withRetry: vi.fn((fn) => fn()),
  },
}));

// Mock URL.createObjectURL and related APIs
const mockCreateObjectURL = vi.fn(() => 'mock-blob-url');
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
});

// Mock document.createElement for download link
const mockClick = vi.fn();
const originalCreateElement = document.createElement.bind(document);
const originalAppendChild = document.body.appendChild.bind(document.body);
const originalRemoveChild = document.body.removeChild.bind(document.body);
const mockAppendChild = vi.fn((node: Node) => originalAppendChild(node));
const mockRemoveChild = vi.fn((node: Node) => originalRemoveChild(node));
Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName) => {
    if (tagName === 'a') {
      const anchor = originalCreateElement('a');
      anchor.click = mockClick;
      return anchor;
    }
    return originalCreateElement(tagName);
  }),
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
});

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
});

describe('ExportManager', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    selectedAsteroidIds: [1, 2, 3],
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders export manager with selected asteroids count', () => {
      render(<ExportManager {...defaultProps} />);
      
      expect(screen.getByText('Export Data')).toBeInTheDocument();
      expect(screen.getByText('Selected asteroids:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders close button when onClose is provided', () => {
      render(<ExportManager {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close export dialog');
      expect(closeButton).toBeInTheDocument();
    });

    it('renders all export type options', () => {
      render(<ExportManager {...defaultProps} />);
      
      expect(screen.getByLabelText('Asteroid Data')).toBeInTheDocument();
      expect(screen.getByLabelText('Spectral Data')).toBeInTheDocument();
      expect(screen.getByLabelText('Chart Visualization')).toBeInTheDocument();
    });

    it('renders format options for data export', () => {
      render(<ExportManager {...defaultProps} />);
      
      expect(screen.getByLabelText('CSV')).toBeInTheDocument();
      expect(screen.getByLabelText('JSON')).toBeInTheDocument();
    });
  });

  describe('Data Export', () => {
    it('calls exportData API with correct parameters for CSV', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      vi.mocked(apiClient.exportData).mockResolvedValue(mockBlob);
      
      render(<ExportManager {...defaultProps} />);
      
      const csvRadio = screen.getByLabelText('CSV');
      await user.click(csvRadio);
      
      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(apiClient.exportData).toHaveBeenCalledWith([1, 2, 3], 'csv', false);
      });
    });

    it('creates download link and triggers download', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      vi.mocked(apiClient.exportData).mockResolvedValue(mockBlob);
      
      render(<ExportManager {...defaultProps} />);
      
      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
        expect(mockClick).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
      });
    });

    it('calls onClose after successful export', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      vi.mocked(apiClient.exportData).mockResolvedValue(mockBlob);
      
      render(<ExportManager {...defaultProps} />);
      
      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('does not attempt export when no asteroids are selected', async () => {
      const user = userEvent.setup();
      render(<ExportManager selectedAsteroidIds={[]} onClose={mockOnClose} />);
      
      const exportButton = screen.getByText('Export CSV');
      expect(exportButton).toBeDisabled();

      await user.click(exportButton);
      
      expect(apiClient.exportData).not.toHaveBeenCalled();
    });

    it('shows error message when API call fails', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.exportData).mockRejectedValue(new Error('API Error'));
      
      render(<ExportManager {...defaultProps} />);
      
      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Export failed: API Error/)).toBeInTheDocument();
      });
    });

    it('disables export button when no asteroids selected', () => {
      render(<ExportManager selectedAsteroidIds={[]} onClose={mockOnClose} />);
      
      const exportButton = screen.getByText('Export CSV');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ExportManager {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close export dialog');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
