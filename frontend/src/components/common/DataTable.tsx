import React, { useState, useMemo } from 'react';
import './DataTable.css';

export interface Column<T> {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  rowKey: (record: T) => string | number;
  onRowClick?: (record: T) => void;
  className?: string;
  expandedRowRender?: (record: T) => React.ReactNode;
  expandedRowKeys?: (string | number)[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
}

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyText = 'No data available',
  rowKey,
  onRowClick,
  className = '',
  expandedRowRender,
  expandedRowKeys = [],
  sortBy,
  sortOrder,
  onSortChange
}: DataTableProps<T>) {
  // Local sort state (only used if onSortChange not provided)
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortOrder, setLocalSortOrder] = useState<'asc' | 'desc'>('asc');

  // Use controlled or local state
  const currentSortKey = onSortChange ? sortBy : localSortKey;
  const currentSortOrder = onSortChange ? sortOrder : localSortOrder;

  // Handle column sort
  const handleSort = (key: string) => {
    if (onSortChange) {
      // Controlled mode - notify parent
      if (sortBy === key) {
        onSortChange(key, sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        onSortChange(key, 'asc');
      }
    } else {
      // Local mode - manage state internally
      if (localSortKey === key) {
        setLocalSortOrder(localSortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setLocalSortKey(key);
        setLocalSortOrder('asc');
      }
    }
  };

  // Sort data (only if in local mode)
  const sortedData = useMemo(() => {
    if (onSortChange) {
      // Controlled mode - data comes pre-sorted from parent
      return data;
    }

    if (!localSortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[localSortKey];
      const bVal = b[localSortKey];

      if (aVal === bVal) return 0;
      
      const comparison = aVal > bVal ? 1 : -1;
      return localSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, localSortKey, localSortOrder, onSortChange]);

  if (loading) {
    return (
      <div className={`data-table-container ${className}`}>
        <div className="data-table-loading">
          <div className="spinner"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`data-table-container ${className}`}>
        <div className="data-table-empty">
          <p>{emptyText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`data-table-container ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={column.sortable ? 'sortable' : ''}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="th-content">
                  <span>{column.title}</span>
                  {column.sortable && (
                    <span className="sort-icon">
                      {currentSortKey === column.key ? (
                        currentSortOrder === 'asc' ? '↑' : '↓'
                      ) : (
                        '↕'
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((record, index) => {
            const key = rowKey(record);
            const isExpanded = expandedRowKeys.includes(key);
            const expandedContent = expandedRowRender?.(record);
            
            return (
              <React.Fragment key={key}>
                <tr
                  onClick={() => onRowClick?.(record)}
                  className={onRowClick ? 'clickable' : ''}
                >
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(record[column.key], record, index)
                        : record[column.key]}
                    </td>
                  ))}
                </tr>
                {isExpanded && expandedContent && (
                  <tr className="expanded-row">
                    <td colSpan={columns.length} className="expanded-cell">
                      {expandedContent}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
