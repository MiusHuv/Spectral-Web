import React, { useState } from 'react';
import './ClassificationTree.css';

interface ClassificationNode {
    label: string;
    count: number;
    children?: ClassificationNode[];
}

interface ClassificationTreeProps {
    data: ClassificationNode[];
    selectedItems: string[];
    onToggle: (label: string) => void;
}

const ClassificationTreeNode: React.FC<{
    node: ClassificationNode;
    level: number;
    selectedItems: string[];
    onToggle: (label: string) => void;
}> = ({ node, level, selectedItems, onToggle }) => {
    const [isExpanded, setIsExpanded] = useState(level === 0);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedItems.includes(node.label);

    return (
        <div className="tree-node" style={{ marginLeft: `${level * 16}px` }}>
            <div className="tree-node-content">
                {hasChildren && (
                    <button
                        className="tree-expand-btn"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? '▼' : '▶'}
                    </button>
                )}
                {!hasChildren && <span className="tree-spacer"></span>}
                
                <input
                    type="checkbox"
                    id={`tree-${node.label}`}
                    checked={isSelected}
                    onChange={() => onToggle(node.label)}
                    className="tree-checkbox"
                />
                <label htmlFor={`tree-${node.label}`} className="tree-label">
                    {node.label}
                    <span className="tree-count">({node.count})</span>
                </label>
            </div>
            
            {hasChildren && isExpanded && (
                <div className="tree-children">
                    {node.children!.map(child => (
                        <ClassificationTreeNode
                            key={child.label}
                            node={child}
                            level={level + 1}
                            selectedItems={selectedItems}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ClassificationTree: React.FC<ClassificationTreeProps> = ({
    data,
    selectedItems,
    onToggle
}) => {
    return (
        <div className="classification-tree">
            {data.map(node => (
                <ClassificationTreeNode
                    key={node.label}
                    node={node}
                    level={0}
                    selectedItems={selectedItems}
                    onToggle={onToggle}
                />
            ))}
        </div>
    );
};

export default ClassificationTree;
