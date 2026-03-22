// Meteorite classification hierarchy based on ACTUAL database data
// Generated from database query results

export interface ClassificationNode {
    label: string;
    count: number;
    children?: ClassificationNode[];
}

// This is the ACTUAL hierarchy from the database
export const meteoriteClassificationTree: ClassificationNode[] = [
    {
        label: 'Achondrites',
        count: 0,
        children: [
            { label: 'Acapulcoite', count: 0 },
            { label: 'Angrite', count: 0 },
            { label: 'Aubrite', count: 0 },
            { label: 'Brachinite', count: 0 },
            {
                label: 'Diogenite',
                count: 0,
                children: [
                    { label: 'Olivine-Diogenite', count: 0 },
                ]
            },
            { label: 'Eucrite', count: 0 },
            { label: 'Howardite', count: 0 },
            { label: 'Lodranite', count: 0 },
            {
                label: 'Ungrouped',
                count: 0,
                children: [
                    { label: 'Ultramafic', count: 0 },
                ]
            },
            { label: 'Ureilite', count: 0 },
            { label: 'Winonaite', count: 0 },
        ]
    },
    {
        label: 'Carbonaceous Chondrite',
        count: 0,
        children: [
            {
                label: 'C',
                count: 0,
                children: [
                    { label: 'C1', count: 0 },
                    { label: 'C2', count: 0 },
                    { label: 'C3', count: 0 },
                    { label: 'C4', count: 0 },
                    { label: 'C5', count: 0 },
                    { label: 'C6', count: 0 },
                ]
            },
            {
                label: 'CH',
                count: 0,
                children: [
                    { label: 'CH3', count: 0 },
                ]
            },
            {
                label: 'CI',
                count: 0,
                children: [
                    { label: 'CI1', count: 0 },
                    { label: 'CI2', count: 0 },
                ]
            },
            {
                label: 'CK',
                count: 0,
                children: [
                    { label: 'CK3', count: 0 },
                    { label: 'CK4', count: 0 },
                    { label: 'CK5', count: 0 },
                    { label: 'CK5-6', count: 0 },
                    { label: 'CK6', count: 0 },
                ]
            },
            {
                label: 'CM',
                count: 0,
                children: [
                    { label: 'CM1', count: 0 },
                    { label: 'CM2', count: 0 },
                ]
            },
            {
                label: 'CO',
                count: 0,
                children: [
                    { label: 'CO3', count: 0 },
                    { label: 'CO3.0', count: 0 },
                    { label: 'CO3.3', count: 0 },
                    { label: 'CO3.6', count: 0 },
                ]
            },
            {
                label: 'CR',
                count: 0,
                children: [
                    { label: 'CR1', count: 0 },
                    { label: 'CR2', count: 0 },
                ]
            },
            {
                label: 'CV',
                count: 0,
                children: [
                    { label: 'CV3', count: 0 },
                    { label: 'CV7', count: 0 },
                ]
            },
            { label: 'CY', count: 0 },
        ]
    },
    {
        label: 'Enstatite Chondrite',
        count: 0,
        children: [
            {
                label: 'E',
                count: 0,
                children: [
                    { label: 'E4', count: 0 },
                ]
            },
            {
                label: 'EH',
                count: 0,
                children: [
                    { label: 'EH3', count: 0 },
                    { label: 'EH4', count: 0 },
                    { label: 'EH5', count: 0 },
                ]
            },
            {
                label: 'EL',
                count: 0,
                children: [
                    { label: 'EL3', count: 0 },
                    { label: 'EL4', count: 0 },
                    { label: 'EL6', count: 0 },
                ]
            },
        ]
    },
    {
        label: 'Iron',
        count: 0,
        children: [
            { label: 'IA', count: 0 },
            {
                label: 'IAB',
                count: 0,
                children: [
                    { label: 'Troilite', count: 0 },
                ]
            },
            { label: 'Iron_Ungrouped', count: 0 },
        ]
    },
    {
        label: 'Ordinary Chondrite',
        count: 0,
        children: [
            {
                label: 'H',
                count: 0,
                children: [
                    { label: 'H3-4', count: 0 },
                    { label: 'H3-6', count: 0 },
                    { label: 'H3.3', count: 0 },
                    { label: 'H3.4', count: 0 },
                    { label: 'H3.5', count: 0 },
                    { label: 'H3.6', count: 0 },
                    { label: 'H3.7', count: 0 },
                    { label: 'H3.8', count: 0 },
                    { label: 'H4', count: 0 },
                    { label: 'H5', count: 0 },
                    { label: 'H6', count: 0 },
                ]
            },
            {
                label: 'L',
                count: 0,
                children: [
                    { label: 'L3', count: 0 },
                    { label: 'L3-6', count: 0 },
                    { label: 'L3.1', count: 0 },
                    { label: 'L3.2', count: 0 },
                    { label: 'L3.3', count: 0 },
                    { label: 'L3.4', count: 0 },
                    { label: 'L3.5', count: 0 },
                    { label: 'L3.6', count: 0 },
                    { label: 'L3.7', count: 0 },
                    { label: 'L3.8', count: 0 },
                    { label: 'L4', count: 0 },
                    { label: 'L5', count: 0 },
                    { label: 'L6', count: 0 },
                ]
            },
            {
                label: 'LL',
                count: 0,
                children: [
                    { label: 'LL3', count: 0 },
                    { label: 'LL3.1', count: 0 },
                    { label: 'LL3.2', count: 0 },
                    { label: 'LL3.3', count: 0 },
                    { label: 'LL3.4', count: 0 },
                    { label: 'LL3.5', count: 0 },
                    { label: 'LL3.7', count: 0 },
                    { label: 'LL3.8', count: 0 },
                    { label: 'LL4', count: 0 },
                    { label: 'LL5', count: 0 },
                    { label: 'LL6', count: 0 },
                ]
            },
        ]
    },
    {
        label: 'R chondrite',
        count: 0,
        children: [
            {
                label: 'R',
                count: 0,
                children: [
                    { label: 'R3', count: 0 },
                    { label: 'R3.8', count: 0 },
                    { label: 'R6', count: 0 },
                ]
            },
        ]
    },
    {
        label: 'Stony Iron',
        count: 0,
        children: [
            { label: 'Pallasite', count: 0 },
        ]
    },
];

// Helper function to update counts from API data
export function updateClassificationCounts(
    tree: ClassificationNode[],
    classifications: { main_label: string; count: number }[]
): ClassificationNode[] {
    const countMap = new Map(classifications.map(c => [c.main_label, c.count]));
    
    function updateNode(node: ClassificationNode): ClassificationNode {
        const apiCount = countMap.get(node.label) || 0;
        
        // If node has children, update them recursively
        const updatedChildren = node.children?.map(updateNode);
        
        // Calculate total count from children
        const childrenCount = updatedChildren 
            ? updatedChildren.reduce((sum, child) => sum + child.count, 0)
            : 0;
        
        return {
            ...node,
            count: apiCount || childrenCount,
            children: updatedChildren
        };
    }
    
    return tree.map(updateNode);
}
