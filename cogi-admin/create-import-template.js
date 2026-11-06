const XLSX = require('xlsx');
const path = require('path');

// Create workbook
const wb = XLSX.utils.book_new();

// Manifest sheet
const manifestData = [
  {
    schemaVersion: '1.0',
    packageCode: 'MATH-CLASS6-CONTENT-V1',
    sourceDocumentCode: 'VN-GDPT2018-MATH-SOURCE-01',
    subjectVersionCode: 'MATH-2018',
    description: 'Nội dung và yêu cầu cần đạt Toán lớp 6'
  }
];
const manifestSheet = XLSX.utils.json_to_sheet(manifestData);
XLSX.utils.book_append_sheet(wb, manifestSheet, 'Manifest');

// Sections sheet
const sectionsData = [
  {
    importKey: 'SEC-V-3-G06-1',
    parentImportKey: 'SEC-V-3-G06',
    sectionType: 'content_group',
    title: 'Số',
    body: 'Nội dung về số',
    sortOrder: 1
  },
  {
    importKey: 'SEC-V-3-G06-1-1-A',
    parentImportKey: 'SEC-V-3-G06-1',
    sectionType: 'content_topic',
    title: 'Số tự nhiên',
    body: 'NỘI DUNG: Số tự nhiên',
    sortOrder: 1
  }
];
const sectionsSheet = XLSX.utils.json_to_sheet(sectionsData);
XLSX.utils.book_append_sheet(wb, sectionsSheet, 'Sections');

// SourceLocations sheet
const locationsData = [
  {
    importKey: 'LOC-PDF-47-48',
    sectionImportKey: 'SEC-V-3-G06-1-1-A',
    startPage: 47,
    endPage: 48,
    locator: 'SECTION:V-3-G06-1-1-A',
    excerpt: 'Bảng nội dung và yêu cầu cần đạt - Số tự nhiên'
  }
];
const locationsSheet = XLSX.utils.json_to_sheet(locationsData);
XLSX.utils.book_append_sheet(wb, locationsSheet, 'SourceLocations');

// ContentLines sheet (NEW)
const contentLinesData = [
  {
    importKey: 'LN-V-3-G06-1-1-A-001',
    sectionImportKey: 'SEC-V-3-G06-1-1-A',
    lineOrder: 1,
    contentText: 'Số tự nhiên và tập hợp các số tự nhiên. Thứ tự trong tập hợp các số tự nhiên'
  },
  {
    importKey: 'LN-V-3-G06-1-1-A-002',
    sectionImportKey: 'SEC-V-3-G06-1-1-A',
    lineOrder: 2,
    contentText: 'Cách ghi số tự nhiên ở dạng tổng'
  },
  {
    importKey: 'LN-V-3-G06-1-1-A-003',
    sectionImportKey: 'SEC-V-3-G06-1-1-A',
    lineOrder: 3,
    contentText: 'Số tự nhiên ở dạng rút gọn'
  }
];
const contentLinesSheet = XLSX.utils.json_to_sheet(contentLinesData);
XLSX.utils.book_append_sheet(wb, contentLinesSheet, 'ContentLines');

// ContentRequirements sheet (NEW)
const requirementsData = [
  {
    importKey: 'REQ-V-3-G06-1-1-A-001-A',
    contentLineImportKey: 'LN-V-3-G06-1-1-A-001',
    requirementOrder: 1,
    requirementText: 'Sử dụng được thuật ngữ tập hợp, phần tử thuộc (không thuộc) một tập hợp; sử dụng được cách cho tập hợp.',
    sourceLocationImportKey: 'LOC-PDF-47-48'
  },
  {
    importKey: 'REQ-V-3-G06-1-1-A-001-B',
    contentLineImportKey: 'LN-V-3-G06-1-1-A-001',
    requirementOrder: 2,
    requirementText: 'Nhận biết được tập hợp các số tự nhiên.',
    sourceLocationImportKey: 'LOC-PDF-47-48'
  },
  {
    importKey: 'REQ-V-3-G06-1-1-A-001-C',
    contentLineImportKey: 'LN-V-3-G06-1-1-A-001',
    requirementOrder: 3,
    requirementText: 'Biểu diễn được số tự nhiên trong hệ thập phân.',
    sourceLocationImportKey: 'LOC-PDF-47-48'
  },
  {
    importKey: 'REQ-V-3-G06-1-1-A-002-A',
    contentLineImportKey: 'LN-V-3-G06-1-1-A-002',
    requirementOrder: 1,
    requirementText: 'Biểu diễn được một số tự nhiên ở dạng tổng của các số hạng bằng nhiều cách khác nhau.',
    sourceLocationImportKey: 'LOC-PDF-47-48'
  },
  {
    importKey: 'REQ-V-3-G06-1-1-A-003-A',
    contentLineImportKey: 'LN-V-3-G06-1-1-A-003',
    requirementOrder: 1,
    requirementText: 'Biểu diễn được một số tự nhiên ở dạng rút gọn (chuẩn).',
    sourceLocationImportKey: 'LOC-PDF-47-48'
  }
];
const requirementsSheet = XLSX.utils.json_to_sheet(requirementsData);
XLSX.utils.book_append_sheet(wb, requirementsSheet, 'ContentRequirements');

// Write file
const outputPath = path.join(__dirname, 'COGI_Import_Template_With_ContentLines.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`✓ Template created: ${outputPath}`);
