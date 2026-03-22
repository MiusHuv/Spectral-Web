import React, { useState } from 'react';
import DataTable, { Column } from '../common/DataTable';
import Pagination from '../common/Pagination';

// Demo data
interface DemoData {
  id: number;
  name: string;
  classification: string;
  samples: number;
  band_1um: number;
}

const demoData: DemoData[] = [
  { id: 1, name: 'H_Group', classification: 'Ordinary Chondrite', samples: 3245, band_1um: 0.234 },
  { id: 2, name: 'L_Group', classification: 'Ordinary Chondrite', samples: 2876, band_1um: 0.198 },
  { id: 3, name: 'LL_K_Group', classification: 'Ordinary Chondrite', samples: 1543, band_1um: 0.187 },
  { id: 4, name: 'CM_Group', classification: 'Carbonaceous Chondrite', samples: 1876, band_1um: 0.156 },
  { id: 5, name: 'HED_Group', classification: 'Achondrite', samples: 987, band_1um: 0.289 },
  { id: 6, name: 'E_Group', classification: 'Enstatite Chondrite', samples: 654, band_1um: 0.145 },
  { id: 7, name: 'CO_CV_Group', classification: 'Carbonaceous Chondrite', samples: 543, band_1um: 0.167 },
  { id: 8, name: 'Iron_Group', classification: 'Iron Meteorite', samples: 432, band_1um: 0.098 },
];

const ComponentsDemo: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const columns: Column<DemoData>[] = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      width: '200px',
    },
    {
      key: 'classification',
      title: 'Classification',
      sortable: true,
    },
    {
      key: 'samples',
      title: 'Samples',
      sortable: true,
      width: '120px',
      render: (value) => value.toLocaleString(),
    },
    {
      key: 'band_1um',
      title: '1μm Band Depth',
      sortable: true,
      width: '150px',
      render: (value) => value.toFixed(3),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '150px',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href={`#view-${record.id}`} style={{ color: '#2563eb' }}>View</a>
          <a href={`#spectrum-${record.id}`} style={{ color: '#2563eb' }}>Spectrum</a>
        </div>
      ),
    },
  ];

  // Paginate data
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = demoData.slice(startIndex, endIndex);

  return (
    <div style={{ padding: '40px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: '#1e293b' }}>
          Components Demo
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px' }}>
          Testing DataTable and Pagination components
        </p>

        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>
            Meteorite Data Table
          </h2>

          <DataTable
            columns={columns}
            data={paginatedData}
            rowKey={(record) => record.id}
            onRowClick={(record) => console.log('Clicked:', record)}
          />

          <Pagination
            current={currentPage}
            total={demoData.length}
            pageSize={pageSize}
            onChange={setCurrentPage}
            showSizeChanger
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
          />
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
            Features Demonstrated:
          </h3>
          <ul style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.8' }}>
            <li>✅ Sortable columns (click column headers)</li>
            <li>✅ Custom cell rendering</li>
            <li>✅ Row click events (check console)</li>
            <li>✅ Pagination with page size selector</li>
            <li>✅ Professional table styling</li>
            <li>✅ Responsive design</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ComponentsDemo;
