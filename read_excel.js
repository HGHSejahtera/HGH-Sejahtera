import * as XLSX from 'xlsx';
import fs from 'fs';

const files = [
  'D:/Projects/Code/HGH/HGH/MemoryCore/Reference/Tiktoksellercenter_batchedit_20260618_all_information_template/Tiktoksellercenter_batchedit_20260618_all_information_template_1.xlsx',
  'D:/Projects/Code/HGH/HGH/MemoryCore/Reference/mass_update_sales_info_19518118_20260618193640.xlsx'
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`\n--- Analyzing ${filePath.split('/').pop()} ---`);
  const fileData = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileData, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Print first 5 rows
  for (let i = 0; i < Math.min(8, data.length); i++) {
    console.log(`Row ${i + 1}:`, JSON.stringify(data[i]).substring(0, 300));
  }
});
