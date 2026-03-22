import React from 'react';
import { 
    ExportHistoryEntry, 
    formatTimestamp, 
    clearExportHistory 
} from '../../utils/exportHistory';
import './ExportHistory.css';

export interface ExportHistoryProps {
    history: ExportHistoryEntry[];
    onRepeatExport: (entry: ExportHistoryEntry) => void;
    onHistoryUpdate: () => void;
}

const ExportHistory: React.FC<ExportHistoryProps> = ({
    history,
    onRepeatExport,
    onHistoryUpdate
}) => {
    const handleClearHistory = () => {
        if (window.confirm('Are you sure you want to clear your export history?')) {
            clearExportHistory();
            onHistoryUpdate();
        }
    };

    const getFormatIcon = (format: string) => {
        switch (format) {
            case 'csv':
                return '📊';
            case 'json':
                return '📋';
            case 'hdf5':
                return '🗄️';
            case 'fits':
                return '🔭';
            default:
                return '📄';
        }
    };

    const getFormatLabel = (format: string) => {
        return format.toUpperCase();
    };

    const getDataTypeLabel = (dataType: string) => {
        return dataType.charAt(0).toUpperCase() + dataType.slice(1);
    };

    if (history.length === 0) {
        return (
            <div className="export-history-empty">
                <div className="export-history-empty-icon">📦</div>
                <p className="export-history-empty-text">No export history yet</p>
                <p className="export-history-empty-subtext">
                    Your recent exports will appear here
                </p>
            </div>
        );
    }

    return (
        <div className="export-history">
            <div className="export-history-header">
                <h3 className="export-history-title">Recent Exports</h3>
                <button 
                    className="export-history-clear-btn"
                    onClick={handleClearHistory}
                    title="Clear all history"
                >
                    Clear History
                </button>
            </div>

            <div className="export-history-list">
                {history.map((entry) => (
                    <div key={entry.id} className="export-history-item">
                        <div className="export-history-item-icon">
                            {getFormatIcon(entry.format)}
                        </div>
                        
                        <div className="export-history-item-content">
                            <div className="export-history-item-header">
                                <span className="export-history-item-title">
                                    {getDataTypeLabel(entry.dataType)} Export
                                </span>
                                <span className="export-history-item-format">
                                    {getFormatLabel(entry.format)}
                                </span>
                            </div>
                            
                            <div className="export-history-item-details">
                                <span className="export-history-item-detail">
                                    {entry.itemCount} item{entry.itemCount !== 1 ? 's' : ''}
                                </span>
                                <span className="export-history-item-separator">•</span>
                                <span className="export-history-item-detail">
                                    {entry.fileSizeHuman}
                                </span>
                                <span className="export-history-item-separator">•</span>
                                <span className="export-history-item-detail export-history-item-time">
                                    {formatTimestamp(entry.timestamp)}
                                </span>
                            </div>
                            
                            <div className="export-history-item-fields">
                                {entry.includeFields.basicInfo && (
                                    <span className="export-history-field-tag">Basic Info</span>
                                )}
                                {entry.includeFields.classification && (
                                    <span className="export-history-field-tag">Classification</span>
                                )}
                                {entry.includeFields.orbitalParams && (
                                    <span className="export-history-field-tag">Orbital</span>
                                )}
                                {entry.includeFields.physicalProps && (
                                    <span className="export-history-field-tag">Physical</span>
                                )}
                                {entry.includeFields.spectralData && (
                                    <span className="export-history-field-tag">Spectral</span>
                                )}
                            </div>
                        </div>
                        
                        <div className="export-history-item-actions">
                            <button
                                className="export-history-repeat-btn"
                                onClick={() => onRepeatExport(entry)}
                                title="Repeat this export"
                            >
                                <span className="export-history-repeat-icon">↻</span>
                                Repeat
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExportHistory;
