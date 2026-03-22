import React, { useState, useEffect } from 'react';
import { useCart, CartItem } from '../../contexts/CartContext';
import DataSelectionPanel from './DataSelectionPanel';
import FormatSelectionPanel from './FormatSelectionPanel';
import ContentCustomizationPanel from './ContentCustomizationPanel';
import ExportProgressIndicator from './ExportProgressIndicator';
import ExportHistory from './ExportHistory';
import MarkdownViewer from '../common/MarkdownViewer';
import { 
    exportApiClient, 
    triggerDownload, 
    generateExportFilename,
    exportUtils,
    ExportConfiguration as ApiExportConfiguration
} from '../../services/exportApi';
import {
    loadExportPreferences,
    saveExportPreferences,
    getDefaultPreferences
} from '../../utils/exportPreferences';
import {
    addExportToHistory,
    getExportHistory,
    formatFileSize,
    ExportHistoryEntry
} from '../../utils/exportHistory';
import './ExportModal.css';

export interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    preselectedItems?: CartItem[];
    dataType: 'asteroids' | 'meteorites';
    currentResults?: any[];
}

export interface ExportFormat {
    value: 'csv' | 'json' | 'hdf5' | 'fits';
    label: string;
    description: string;
    useCases: string[];
    icon: string;
}

export interface IncludeFields {
    basicInfo: boolean;
    classification: boolean;
    orbitalParams: boolean;
    physicalProps: boolean;
    spectralData: boolean;
}

export interface SpectralOptions {
    wavelengthRange?: [number, number];
    resolution: 'original' | 'resampled';
    includeUncertainty: boolean;
    includeMetadata: boolean;
}

export interface ExportConfiguration {
    items: string[];
    format: ExportFormat['value'];
    includeFields: IncludeFields;
    spectralOptions?: SpectralOptions;
}

type WizardStep = 'selection' | 'format' | 'customize' | 'export';

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    preselectedItems = [],
    dataType,
    currentResults = []
}) => {
    const { items: cartItems } = useCart();
    
    // Wizard state
    const [currentStep, setCurrentStep] = useState<WizardStep>('selection');
    const [showHistory, setShowHistory] = useState(false);
    const [showDocumentation, setShowDocumentation] = useState(false);
    const [documentationPath, setDocumentationPath] = useState<string>('');
    
    // Ref for focus management
    const modalRef = React.useRef<HTMLDivElement>(null);
    
    // Export configuration state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat['value']>('csv');
    const [includeFields, setIncludeFields] = useState<IncludeFields>({
        basicInfo: true,
        classification: true,
        orbitalParams: true,
        physicalProps: true,
        spectralData: true
    });
    const [spectralOptions, setSpectralOptions] = useState<SpectralOptions>({
        resolution: 'original',
        includeUncertainty: true,
        includeMetadata: true
    });
    const [estimatedSize, setEstimatedSize] = useState<string>('Calculating...');
    
    // Export progress state
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState<string>('');
    const [exportError, setExportError] = useState<string | null>(null);
    
    // Export history state
    const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);

    // Initialize with preselected items and load preferences when modal opens
    useEffect(() => {
        if (isOpen) {
            // Set preselected items if provided
            if (preselectedItems.length > 0) {
                setSelectedIds(preselectedItems.map(item => item.id));
            }
            
            // Load saved preferences
            const savedPreferences = loadExportPreferences();
            if (savedPreferences) {
                // Pre-populate format selection
                setSelectedFormat(savedPreferences.format);
                
                // Pre-populate field selections
                setIncludeFields(savedPreferences.includeFields);
                
                // Pre-populate spectral options
                setSpectralOptions(savedPreferences.spectralOptions);
            } else {
                // Use default preferences if none saved
                const defaults = getDefaultPreferences();
                setSelectedFormat(defaults.format);
                setIncludeFields(defaults.includeFields);
                setSpectralOptions(defaults.spectralOptions);
            }
            
            // Load export history
            const history = getExportHistory();
            setExportHistory(history);
            
            // Focus management - focus modal when opened
            setTimeout(() => {
                if (modalRef.current) {
                    const firstFocusable = modalRef.current.querySelector<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    firstFocusable?.focus();
                }
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);
    
    // Keyboard navigation - ESC to close and focus trap
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isExporting) {
                onClose();
            }
            
            // Focus trap - Tab navigation
            if (e.key === 'Tab' && isOpen && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement?.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement?.focus();
                    }
                }
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, isExporting, onClose]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setCurrentStep('selection');
                setSelectedIds([]);
                setSelectedFormat('csv');
                setIncludeFields({
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true
                });
                setSpectralOptions({
                    resolution: 'original',
                    includeUncertainty: true,
                    includeMetadata: true
                });
                setIsExporting(false);
                setExportStatus('');
                setExportError(null);
                setShowHistory(false);
            }, 300);
        }
    }, [isOpen]);

    const handleNext = () => {
        const steps: WizardStep[] = ['selection', 'format', 'customize', 'export'];
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1]);
        }
    };

    const handleBack = () => {
        const steps: WizardStep[] = ['selection', 'format', 'customize', 'export'];
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1]);
        }
    };

    const handleRepeatExport = (historyEntry: ExportHistoryEntry) => {
        // Restore configuration from history entry
        setSelectedIds(historyEntry.itemIds);
        setSelectedFormat(historyEntry.format);
        setIncludeFields(historyEntry.includeFields);
        if (historyEntry.spectralOptions) {
            setSpectralOptions(historyEntry.spectralOptions);
        }
        
        // Hide history and go to customize step to allow review before export
        setShowHistory(false);
        setCurrentStep('customize');
    };

    const handleHistoryUpdate = () => {
        // Reload history after changes
        const history = getExportHistory();
        setExportHistory(history);
    };

    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    const handleExport = async () => {
        setIsExporting(true);
        setExportError(null);
        setCurrentStep('export');
        
        try {
            // Save user preferences for future exports
            saveExportPreferences({
                format: selectedFormat,
                includeFields: includeFields,
                spectralOptions: spectralOptions,
            });
            
            // Convert observation IDs to asteroid IDs if needed
            const processedIds = selectedIds.map(id => {
                // If ID starts with "observation-", extract the asteroid ID from cart item
                if (id.startsWith('observation-')) {
                    const cartItem = cartItems.find(item => item.id === id);
                    if (cartItem && cartItem.asteroidId) {
                        return cartItem.asteroidId.toString();
                    }
                }
                return id;
            });
            
            // Prepare export configuration
            const config: ApiExportConfiguration = {
                itemIds: processedIds,
                format: selectedFormat,
                includeFields: {
                    basicInfo: includeFields.basicInfo,
                    classification: includeFields.classification,
                    orbitalParams: includeFields.orbitalParams,
                    physicalProps: includeFields.physicalProps,
                    spectralData: includeFields.spectralData,
                },
                spectralOptions: includeFields.spectralData ? {
                    wavelengthRange: spectralOptions.wavelengthRange,
                    resolution: spectralOptions.resolution,
                    includeUncertainty: spectralOptions.includeUncertainty,
                    includeMetadata: spectralOptions.includeMetadata,
                } : undefined,
            };

            // Validate configuration
            const validation = exportUtils.validateConfiguration(config);
            if (!validation.isValid) {
                setExportError(validation.errors.join(', '));
                setIsExporting(false);
                return;
            }

            // Start export process
            setExportStatus('Preparing export...');
            
            // Call appropriate export method based on data type
            const result = dataType === 'asteroids'
                ? await exportApiClient.exportAsteroids(config)
                : await exportApiClient.exportMeteorites(config);

            // Debug logging
            console.log('Export result:', result);
            console.log('Backend filename:', result.filename);
            console.log('Blob type:', result.blob.type);
            console.log('Blob size:', result.blob.size);

            // Update status
            setExportStatus('Converting data...');
            
            // Use backend filename if available, otherwise generate one
            const generatedFilename = generateExportFilename(
                dataType,
                selectedFormat,
                selectedIds.length,
                preselectedItems.length > 0
            );
            const filename = result.filename || generatedFilename;
            
            console.log('Generated filename:', generatedFilename);
            console.log('Final filename:', filename);

            // Trigger download
            setExportStatus('Downloading...');
            triggerDownload(result.blob, filename);

            // Add to export history
            const fileSizeBytes = result.blob.size;
            addExportToHistory({
                timestamp: new Date().toISOString(),
                itemCount: selectedIds.length,
                format: selectedFormat,
                dataType: dataType,
                fileSizeBytes: fileSizeBytes,
                fileSizeHuman: formatFileSize(fileSizeBytes),
                itemIds: selectedIds,
                includeFields: includeFields,
                spectralOptions: includeFields.spectralData ? spectralOptions : undefined,
            });

            // Success
            setExportStatus('Export complete!');
            
            // Close modal after short delay
            setTimeout(() => {
                setIsExporting(false);
                onClose();
            }, 1500);

        } catch (error) {
            // Handle errors
            console.error('Export failed:', error);
            
            const errorMessage = exportUtils.getErrorMessage(error);
            const errorSuggestion = exportUtils.getErrorActionSuggestion(error);
            
            setExportError(`${errorMessage}\n\n${errorSuggestion}`);
            setExportStatus('Export failed');
            setIsExporting(false);
            
            // Log recovery suggestions for debugging
            const suggestions = exportUtils.getRecoverySuggestions(error);
            console.log('Recovery suggestions:', suggestions);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 'selection':
                return selectedIds.length > 0;
            case 'format':
                return selectedFormat !== null;
            case 'customize':
                return true;
            default:
                return false;
        }
    };

    const getStepTitle = () => {
        switch (currentStep) {
            case 'selection':
                return 'Select Data';
            case 'format':
                return 'Choose Format';
            case 'customize':
                return 'Customize Export';
            case 'export':
                return 'Exporting...';
            default:
                return '';
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="export-modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
        >
            <div 
                className="export-modal" 
                onClick={(e) => e.stopPropagation()}
                ref={modalRef}
            >
                {/* Screen reader announcements */}
                <div 
                    role="status" 
                    aria-live="polite" 
                    aria-atomic="true" 
                    className="sr-only"
                >
                    {exportStatus && isExporting ? exportStatus : ''}
                </div>
                
                {/* Header */}
                <div className="export-modal-header">
                    <div className="export-modal-title">
                        <h2 id="export-modal-title">Export {dataType === 'asteroids' ? 'Asteroid' : 'Meteorite'} Data</h2>
                        <p className="export-modal-subtitle" aria-live="polite">
                            {showHistory ? 'Export History' : getStepTitle()}
                        </p>
                    </div>
                    <div className="export-modal-header-actions">
                        {!isExporting && (
                            <>
                                <button 
                                    className="export-modal-help-btn"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDocumentationPath('/docs/export-formats.md');
                                        setShowDocumentation(true);
                                    }}
                                    title="View export format documentation"
                                    aria-label="Help - View export documentation"
                                >
                                    <svg 
                                        width="20" 
                                        height="20" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                    <span>Help</span>
                                </button>
                                <button 
                                    className="export-modal-history-btn"
                                    onClick={toggleHistory}
                                    title={showHistory ? 'Back to export' : 'View export history'}
                                >
                                    {showHistory ? '← Back' : '📋 History'}
                                </button>
                            </>
                        )}
                        <button 
                            className="export-modal-close"
                            onClick={onClose}
                            aria-label="Close export modal"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Progress Steps */}
                {!showHistory && (
                    <nav className="export-wizard-steps" aria-label="Export wizard progress">
                        <div 
                            className={`wizard-step ${currentStep === 'selection' ? 'active' : ''} ${['format', 'customize', 'export'].includes(currentStep) ? 'completed' : ''}`}
                            aria-current={currentStep === 'selection' ? 'step' : undefined}
                        >
                            <div className="wizard-step-number" aria-label="Step 1">1</div>
                            <div className="wizard-step-label">Select</div>
                        </div>
                        <div className="wizard-step-line" aria-hidden="true"></div>
                        <div 
                            className={`wizard-step ${currentStep === 'format' ? 'active' : ''} ${['customize', 'export'].includes(currentStep) ? 'completed' : ''}`}
                            aria-current={currentStep === 'format' ? 'step' : undefined}
                        >
                            <div className="wizard-step-number" aria-label="Step 2">2</div>
                            <div className="wizard-step-label">Format</div>
                        </div>
                        <div className="wizard-step-line" aria-hidden="true"></div>
                        <div 
                            className={`wizard-step ${currentStep === 'customize' ? 'active' : ''} ${currentStep === 'export' ? 'completed' : ''}`}
                            aria-current={currentStep === 'customize' ? 'step' : undefined}
                        >
                            <div className="wizard-step-number" aria-label="Step 3">3</div>
                            <div className="wizard-step-label">Customize</div>
                        </div>
                        <div className="wizard-step-line" aria-hidden="true"></div>
                        <div 
                            className={`wizard-step ${currentStep === 'export' ? 'active' : ''}`}
                            aria-current={currentStep === 'export' ? 'step' : undefined}
                        >
                            <div className="wizard-step-number" aria-label="Step 4">4</div>
                            <div className="wizard-step-label">Export</div>
                        </div>
                    </nav>
                )}

                {/* Content */}
                <div className="export-modal-content">
                    {showHistory ? (
                        <ExportHistory
                            history={exportHistory}
                            onRepeatExport={handleRepeatExport}
                            onHistoryUpdate={handleHistoryUpdate}
                        />
                    ) : (
                        <>
                            {currentStep === 'selection' && (
                                <DataSelectionPanel
                                    dataType={dataType}
                                    cartItems={cartItems.filter(item => item.type === dataType.slice(0, -1) as 'asteroid' | 'meteorite')}
                                    currentResults={currentResults}
                                    selectedIds={selectedIds}
                                    onSelectionChange={setSelectedIds}
                                />
                            )}

                            {currentStep === 'format' && (
                                <FormatSelectionPanel
                                    selectedFormat={selectedFormat}
                                    onFormatChange={setSelectedFormat}
                                    onShowDocumentation={() => {
                                        setDocumentationPath('/docs/export-formats.md');
                                        setShowDocumentation(true);
                                    }}
                                />
                            )}

                            {currentStep === 'customize' && (
                                <ContentCustomizationPanel
                                    includeFields={includeFields}
                                    spectralOptions={spectralOptions}
                                    onFieldsChange={setIncludeFields}
                                    onSpectralOptionsChange={setSpectralOptions}
                                    estimatedSize={estimatedSize}
                                />
                            )}

                            {currentStep === 'export' && (
                                <ExportProgressIndicator
                                    status={exportStatus}
                                    isExporting={isExporting}
                                    error={exportError}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!showHistory && (
                    <div className="export-modal-footer">
                        <div className="export-modal-info">
                            {currentStep !== 'export' && (
                                <span className="selected-count" aria-live="polite" aria-atomic="true">
                                    {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
                                </span>
                            )}
                        </div>
                        <div className="export-modal-actions" role="group" aria-label="Wizard navigation">
                            {currentStep !== 'selection' && currentStep !== 'export' && (
                                <button 
                                    className="export-btn export-btn-secondary"
                                    onClick={handleBack}
                                    aria-label="Go back to previous step"
                                >
                                    Back
                                </button>
                            )}
                            {currentStep !== 'export' && currentStep !== 'customize' && (
                                <button 
                                    className="export-btn export-btn-primary"
                                    onClick={handleNext}
                                    disabled={!canProceed()}
                                    aria-label="Proceed to next step"
                                    aria-disabled={!canProceed()}
                                >
                                    Next
                                </button>
                            )}
                            {currentStep === 'customize' && (
                                <button 
                                    className="export-btn export-btn-primary"
                                    onClick={handleExport}
                                    disabled={!canProceed()}
                                    aria-label={`Export ${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''}`}
                                    aria-disabled={!canProceed()}
                                >
                                    Export
                                </button>
                            )}
                            {currentStep === 'export' && !isExporting && (
                                <button 
                                    className="export-btn export-btn-primary"
                                    onClick={onClose}
                                    aria-label="Close export modal"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Documentation Viewer */}
            {showDocumentation && (
                <MarkdownViewer
                    markdownPath={documentationPath}
                    onClose={() => setShowDocumentation(false)}
                />
            )}
        </div>
    );
};

export default ExportModal;
