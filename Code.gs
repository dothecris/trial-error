// Google Apps Script Backend Functions

// Get the connected spreadsheet
function getSpreadsheet() {
  try {
    const SPREADSHEET_ID = '1ykwqHI0wwLh6WZDQRmAX3a4SQM9x7Md7TUV6U3x5oXY';
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('Spreadsheet opened successfully: ' + ss.getName());
    return ss;
  } catch (error) {
    console.log('Error opening spreadsheet: ' + error.toString());
    throw new Error('Cannot access spreadsheet: ' + error.message);
  }
}

// Serve the HTML page based on the page parameter
function doGet(e) {
  const page = e.parameter.page || 'index';
  
  try {
    return HtmlService.createTemplateFromFile(page)
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

// Include CSS and JS files
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Get RAMCO data (first page for performance)
function getRamcoDataFirstPage() {
  console.log('=== getRamcoDataFirstPage called ===');
  
  try {
    console.log('Step 1: Getting spreadsheet...');
    const ss = getSpreadsheet();
    console.log('Step 2: Spreadsheet obtained');
    
    console.log('Step 3: Looking for RAMCO sheet...');
    let sheet = ss.getSheetByName('RAMCO');
    
    if (!sheet) {
      console.log('Step 4: RAMCO sheet not found, creating it...');
      sheet = ss.insertSheet('RAMCO');
      
      // Add headers based on your mapping
      const headers = [
        'Delivery Rec',      // A - from CSV column AE
        'Haulers Name',      // B - from CSV column AC  
        'Plate Number',      // C - from CSV column R
        'Driver Name',       // D - from CSV column P
        'Dispatch Date',     // E - from CSV column Q
        'Sold to Name',      // F - from CSV column G
        'Ship to Name',      // G - from CSV column L
        'Ship to Address',   // H - from CSV column AF
        'S.O Number',        // I - from CSV column A
        'Delivery Rec No',   // J - from CSV column AE
        'Dispatch Qty',      // K - from CSV column U
        'Bay Code',          // L - from CSV column AK
        'Dispatch Time',     // M - from CSV column AM
        'Truck Type'         // N - from CSV column AJ
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      console.log('Step 5: Headers added to new RAMCO sheet');
      
      return {
        success: true,
        message: 'RAMCO sheet created with headers. Upload CSV data to get started.',
        headers: headers,
        data: []
      };
    }
    
    console.log('Step 4: RAMCO sheet found');
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    console.log('Step 5: Sheet dimensions - Rows:', lastRow, 'Cols:', lastCol);
    
    if (lastRow === 0 || lastCol === 0) {
      console.log('Step 6: Sheet is empty');
      return {
        success: true,
        message: 'RAMCO sheet is empty. Upload CSV data to get started.',
        headers: [],
        data: []
      };
    }
    
    console.log('Step 6: Getting data from sheet...');
    const allData = sheet.getDataRange().getValues();
    
    if (!allData || allData.length === 0) {
      console.log('Step 7: No data retrieved');
      return {
        success: true,
        message: 'No data found in RAMCO sheet',
        headers: [],
        data: []
      };
    }
    
    const headers = allData[0] || [];
    const dataRows = allData.slice(1) || [];
    
    console.log('Step 7: Data processed - Headers:', headers.length, 'Rows:', dataRows.length);
    
    // Limit to first 50 rows for performance
    const limitedRows = dataRows.slice(0, 50);
    
    const result = {
      success: true,
      message: `Loaded ${limitedRows.length} records from RAMCO sheet (showing first 50)`,
      headers: headers,
      data: limitedRows
    };
    
    console.log('Step 8: Returning result');
    return result;
    
  } catch (error) {
    console.log('ERROR in getRamcoDataFirstPage:', error.toString());
    
    const errorResult = {
      success: false,
      message: 'Failed to load RAMCO data: ' + error.message,
      headers: [],
      data: [],
      error: error.toString()
    };
    
    console.log('Returning error result:', JSON.stringify(errorResult));
    return errorResult;
  }
}

// Process CSV upload with your specific column mapping and deduplication
function processCsvUpload(csvData) {
  console.log('=== processCsvUpload called ===');
  
  try {
    if (!csvData || typeof csvData !== 'string' || csvData.length === 0) {
      throw new Error('Invalid CSV data provided');
    }
    
    console.log('CSV data length:', csvData.length);
    console.log('First 200 characters:', csvData.substring(0, 200));
    
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('RAMCO');
    
    if (!sheet) {
      console.log('Creating RAMCO sheet...');
      sheet = ss.insertSheet('RAMCO');
      
      // Add headers based on your mapping
      const headers = [
        'Delivery Rec',      // A - from CSV column AE
        'Haulers Name',      // B - from CSV column AC  
        'Plate Number',      // C - from CSV column R
        'Driver Name',       // D - from CSV column P
        'Dispatch Date',     // E - from CSV column Q
        'Sold to Name',      // F - from CSV column G
        'Ship to Name',      // G - from CSV column L
        'Ship to Address',   // H - from CSV column AF
        'S.O Number',        // I - from CSV column A
        'Delivery Rec No',   // J - from CSV column AE
        'Dispatch Qty',      // K - from CSV column U
        'Bay Code',          // L - from CSV column AK
        'Dispatch Time',     // M - from CSV column AM
        'Truck Type'         // N - from CSV column AJ
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      console.log('Headers added to new sheet');
    }
    
    // Parse CSV data
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }
    
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      // Handle both comma and tab delimiters
      const delimiter = line.includes('\t') ? '\t' : ',';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    }
    
    const csvHeaders = parseCSVLine(lines[0]);
    const csvRows = lines.slice(1).map(line => parseCSVLine(line));
    
    console.log('CSV parsed - Headers:', csvHeaders.length, 'Rows:', csvRows.length);
    console.log('CSV Headers:', csvHeaders);
    
    // Get existing data for deduplication
    const existingData = sheet.getDataRange().getValues();
    const existingRows = existingData.length > 1 ? existingData.slice(1) : [];
    console.log('Existing rows in sheet:', existingRows.length);
    
    // Column mapping based on your requirements
    // CSV columns are referenced by letter (A, AC, AE, etc.)
    function getColumnIndex(columnLetter) {
      let result = 0;
      for (let i = 0; i < columnLetter.length; i++) {
        result = result * 26 + (columnLetter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      return result - 1; // Convert to 0-based index
    }
    
    // Your column mapping
    const columnMapping = {
      'AE': 0,  // Delivery Rec -> A
      'AC': 1,  // Haulers Name -> B
      'R': 2,   // Plate Number -> C
      'P': 3,   // Driver Name -> D
      'Q': 4,   // Dispatch Date -> E
      'G': 5,   // Sold to Name -> F
      'L': 6,   // Ship to Name -> G
      'AF': 7,  // Ship to Address -> H
      'A': 8,   // S.O Number -> I
      'AE': 9,  // Delivery Rec No -> J (same as AE)
      'U': 10,  // Dispatch Qty -> K
      'AK': 11, // Bay Code -> L
      'AM': 12, // Dispatch Time -> M
      'AJ': 13  // Truck Type -> N
    };
    
    console.log('Column mapping:', columnMapping);
    
    // Process CSV rows and map to sheet columns
    const newRows = [];
    const toDeleteIndexes = [];
    let processedCount = 0;
    
    csvRows.forEach((csvRow, rowIndex) => {
      if (!csvRow || csvRow.length === 0 || csvRow.every(cell => !cell || !cell.trim())) {
        console.log(`Skipping empty row ${rowIndex + 1}`);
        return;
      }
      
      // Create a new row with 14 columns (A-N)
      const mappedRow = new Array(14).fill('');
      
      // Map CSV data to sheet columns
      Object.keys(columnMapping).forEach(csvColumn => {
        const csvColumnIndex = getColumnIndex(csvColumn);
        const sheetColumnIndex = columnMapping[csvColumn];
        
        if (csvColumnIndex < csvRow.length && csvRow[csvColumnIndex]) {
          const value = csvRow[csvColumnIndex].toString().trim();
          if (value) {
            mappedRow[sheetColumnIndex] = value;
            
            // Preserve source formatting for dates
            if (sheetColumnIndex === 4) { // Dispatch Date column
              try {
                // Try to parse and format date
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  mappedRow[sheetColumnIndex] = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                }
              } catch (e) {
                // Keep original value if date parsing fails
                mappedRow[sheetColumnIndex] = value;
              }
            }
          }
        }
      });
      
      // Ensure Delivery Rec No (J) matches Delivery Rec (A)
      if (mappedRow[0]) {
        mappedRow[9] = mappedRow[0];
      }
      
      const plateNumber = mappedRow[2]; // Column C
      const haulerName = mappedRow[1];  // Column B
      const dispatchDate = mappedRow[4]; // Column E
      
      if (!plateNumber && !haulerName) {
        console.log(`Skipping row ${rowIndex + 1} - missing essential data`);
        return;
      }
      
      // Deduplication: For each Plate Number + Hauler Name, keep the latest Dispatch Date
      if (plateNumber && haulerName) {
        existingRows.forEach((existingRow, index) => {
          const existingPlateNumber = existingRow[2]; // Column C
          const existingHaulerName = existingRow[1];  // Column B
          const existingDispatchDate = existingRow[4]; // Column E
          
          if (existingPlateNumber === plateNumber && existingHaulerName === haulerName) {
            // Compare dispatch dates
            const newDate = new Date(dispatchDate);
            const existingDate = new Date(existingDispatchDate);
            
            if (!isNaN(newDate.getTime()) && !isNaN(existingDate.getTime())) {
              if (newDate > existingDate) {
                // New data is newer, mark existing for deletion
                toDeleteIndexes.push(index + 2); // +2 because sheet is 1-indexed and we skip header
                console.log(`Marking row ${index + 2} for deletion (older entry for ${plateNumber} + ${haulerName})`);
              } else {
                // Existing data is newer or same, skip new data
                console.log(`Skipping new row for ${plateNumber} + ${haulerName} (existing data is newer or same)`);
                return;
              }
            }
          }
        });
      }
      
      console.log(`Processing row ${rowIndex + 1}:`, mappedRow.slice(0, 5)); // Log first 5 columns
      newRows.push(mappedRow);
      processedCount++;
    });
    
    console.log('New rows to add:', newRows.length);
    console.log('Rows to delete:', toDeleteIndexes.length);
    
    // Delete duplicate entries (sort in descending order to avoid index shifting)
    const uniqueDeleteIndexes = [...new Set(toDeleteIndexes)].sort((a, b) => b - a);
    let deletedCount = 0;
    uniqueDeleteIndexes.forEach(rowIndex => {
      try {
        sheet.deleteRow(rowIndex);
        deletedCount++;
        console.log(`Deleted row ${rowIndex}`);
      } catch (e) {
        console.error(`Error deleting row ${rowIndex}:`, e);
      }
    });
    
    // Add new rows to the sheet
    let addedCount = 0;
    if (newRows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      console.log(`Adding ${newRows.length} rows starting at row ${startRow}`);
      
      try {
        sheet.getRange(startRow, 1, newRows.length, 14).setValues(newRows);
        addedCount = newRows.length;
        console.log('Successfully added all rows');
        
        // Apply formatting to preserve source formatting
        const dataRange = sheet.getRange(startRow, 1, newRows.length, 14);
        
        // Format dispatch date column (E)
        const dateRange = sheet.getRange(startRow, 5, newRows.length, 1);
        dateRange.setNumberFormat('yyyy-mm-dd');
        
        // Format dispatch time column (M)
        const timeRange = sheet.getRange(startRow, 13, newRows.length, 1);
        timeRange.setNumberFormat('hh:mm');
        
        console.log('Formatting applied to preserve source formatting');
        
      } catch (e) {
        console.error('Error adding rows in batch:', e);
        
        // Fallback: add rows one by one
        newRows.forEach((row, index) => {
          try {
            sheet.getRange(startRow + index, 1, 1, 14).setValues([row]);
            addedCount++;
            console.log(`Added row ${startRow + index}`);
          } catch (e2) {
            console.error(`Error adding row ${index}:`, e2);
          }
        });
      }
    }
    
    console.log('CSV processing completed successfully');
    
    return {
      success: true,
      message: `Successfully processed ${processedCount} rows. Added ${addedCount} new entries, removed ${deletedCount} duplicates.`,
      details: {
        processed: processedCount,
        added: addedCount,
        deleted: deletedCount,
        csvHeaders: csvHeaders.length,
        deduplicationRule: 'Latest dispatch date kept for each Plate Number + Hauler Name combination'
      }
    };
    
  } catch (error) {
    console.error('Error processing CSV upload:', error);
    return {
      success: false,
      message: 'CSV processing failed: ' + error.message,
      details: {
        error: error.toString(),
        stack: error.stack
      }
    };
  }
}

// Search RAMCO data
function searchRamcoData(searchTerm) {
  console.log('=== searchRamcoData called with term:', searchTerm);
  
  try {
    if (!searchTerm || searchTerm.trim() === '') {
      console.log('Empty search term, returning all data');
      return getRamcoDataFirstPage();
    }
    
    const allDataResult = getRamcoDataFirstPage();
    
    if (!allDataResult.success) {
      return allDataResult;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    const filteredData = allDataResult.data.filter(row => {
      return row.some(cell => {
        if (cell === null || cell === undefined) return false;
        return cell.toString().toLowerCase().includes(searchTermLower);
      });
    });
    
    console.log('Search completed - Found:', filteredData.length, 'matches');
    
    return {
      success: true,
      message: `Found ${filteredData.length} matching records`,
      headers: allDataResult.headers,
      data: filteredData
    };
    
  } catch (error) {
    console.log('ERROR in searchRamcoData:', error.toString());
    return {
      success: false,
      message: 'Search failed: ' + error.message,
      headers: [],
      data: [],
      error: error.toString()
    };
  }
}

// Simple test function
function testBasic() {
  console.log('=== testBasic called ===');
  
  try {
    const result = {
      success: true,
      message: 'Google Apps Script is responding correctly',
      timestamp: new Date().toString(),
      currentTime: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
    };
    
    console.log('testBasic result:', JSON.stringify(result));
    return result;
    
  } catch (error) {
    console.log('ERROR in testBasic:', error.toString());
    return {
      success: false,
      message: 'Error in basic test: ' + error.message,
      error: error.toString()
    };
  }
}

// Add a test row to RAMCO sheet
function addTestRow() {
  console.log('=== addTestRow called ===');
  
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('RAMCO');
    
    if (!sheet) {
      console.log('Creating RAMCO sheet...');
      sheet = ss.insertSheet('RAMCO');
      
      const headers = [
        'Delivery Rec', 'Haulers Name', 'Plate Number', 'Driver Name', 'Dispatch Date',
        'Sold to Name', 'Ship to Name', 'Ship to Address', 'S.O Number', 'Delivery Rec No',
        'Dispatch Qty', 'Bay Code', 'Dispatch Time', 'Truck Type'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      console.log('Headers added');
    }
    
    const timestamp = Date.now();
    const testRow = [
      'DR' + timestamp,
      'Test Hauler Company',
      'TEST' + timestamp.toString().slice(-3),
      'Test Driver',
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      'Test Customer Corp',
      'Test Ship Location',
      '123 Test Street, Test City',
      'SO' + timestamp,
      'DR' + timestamp,
      '100',
      'BAY1',
      '08:00',
      'Truck Type A'
    ];
    
    sheet.appendRow(testRow);
    console.log('Test row added successfully');
    
    return {
      success: true,
      message: 'Test row added successfully to RAMCO sheet'
    };
    
  } catch (error) {
    console.log('ERROR in addTestRow:', error.toString());
    return {
      success: false,
      message: 'Failed to add test row: ' + error.message,
      error: error.toString()
    };
  }
}

// Generate ticket number
function generateTicketNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Submit transport issue ticket
function submitTransportIssue(ticketData) {
  console.log('=== submitTransportIssue called ===');
  
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('Transport Issue');
    
    if (!sheet) {
      sheet = ss.insertSheet('Transport Issue');
      const headers = [
        'Ticket No', 'Haulers Name', 'Driver', 'Plate Number', 'Sold to Name',
        'Ship to Name', 'Ship to Address', 'Dispatch Date', 'Dispatch Time',
        'Delivery Schedule', 'Transport Caller', 'Status', 'Remarks',
        'Submission Date', 'Submission Time'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      console.log('Transport Issue sheet created');
    }
    
    const ticketNumber = generateTicketNumber();
    const now = new Date();
    
    const row = [
      ticketNumber,
      ticketData.haulersName || '',
      ticketData.driver || '',
      ticketData.plateNumber || '',
      ticketData.soldToName || '',
      ticketData.shipToName || '',
      ticketData.shipToAddress || '',
      ticketData.dispatchDate || '',
      ticketData.dispatchTime || '',
      ticketData.deliverySchedule || '',
      ticketData.transportCaller || '',
      ticketData.status || '',
      ticketData.remarks || '',
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss')
    ];
    
    sheet.appendRow(row);
    console.log('Ticket submitted:', ticketNumber);
    
    return {
      success: true,
      ticketNumber: ticketNumber,
      message: 'Ticket submitted successfully'
    };
    
  } catch (error) {
    console.log('ERROR in submitTransportIssue:', error.toString());
    return {
      success: false,
      message: 'Failed to submit ticket: ' + error.message,
      error: error.toString()
    };
  }
}

// Get transport issues
function getTransportIssues() {
  console.log('=== getTransportIssues called ===');
  
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Transport Issue');
    
    if (!sheet) {
      return {
        success: true,
        message: 'No transport issues found',
        headers: [],
        data: []
      };
    }
    
    const lastRow = sheet.getLastRow();
    
    if (lastRow === 0) {
      return {
        success: true,
        message: 'Transport issues sheet is empty',
        headers: [],
        data: []
      };
    }
    
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const data = allData.slice(1);
    
    console.log('Transport issues loaded:', data.length, 'tickets');
    
    return {
      success: true,
      message: `Loaded ${data.length} transport issue tickets`,
      headers: headers,
      data: data
    };
    
  } catch (error) {
    console.log('ERROR in getTransportIssues:', error.toString());
    return {
      success: false,
      message: 'Failed to load transport issues: ' + error.message,
      headers: [],
      data: [],
      error: error.toString()
    };
  }
}

// Search transport issues
function searchTransportIssues(searchTerm) {
  console.log('=== searchTransportIssues called ===');
  
  try {
    const issuesData = getTransportIssues();
    
    if (!issuesData.success) {
      return issuesData;
    }
    
    if (!searchTerm || searchTerm.trim() === '') {
      return issuesData;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    const filteredData = issuesData.data.filter(row => {
      return row.some(cell => {
        if (cell === null || cell === undefined) return false;
        return cell.toString().toLowerCase().includes(searchTermLower);
      });
    });
    
    return {
      success: true,
      message: `Found ${filteredData.length} matching tickets`,
      headers: issuesData.headers,
      data: filteredData
    };
    
  } catch (error) {
    console.log('ERROR in searchTransportIssues:', error.toString());
    return {
      success: false,
      message: 'Search failed: ' + error.message,
      headers: [],
      data: [],
      error: error.toString()
    };
  }
}

// Comprehensive diagnostics
function runDiagnostics() {
  console.log('=== runDiagnostics called ===');
  
  try {
    const results = {
      timestamp: new Date().toString(),
      tests: {}
    };
    
    // Test 1: Basic functionality
    console.log('Running basic test...');
    results.tests.basic = testBasic();
    
    // Test 2: Spreadsheet access
    console.log('Testing spreadsheet access...');
    try {
      const ss = getSpreadsheet();
      results.tests.spreadsheet = {
        success: true,
        message: 'Spreadsheet access successful',
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId()
      };
    } catch (error) {
      results.tests.spreadsheet = {
        success: false,
        message: 'Spreadsheet access failed: ' + error.message
      };
    }
    
    // Test 3: RAMCO sheet access
    console.log('Testing RAMCO sheet...');
    try {
      const dataResult = getRamcoDataFirstPage();
      results.tests.ramcoData = dataResult;
    } catch (error) {
      results.tests.ramcoData = {
        success: false,
        message: 'RAMCO data test failed: ' + error.message
      };
    }
    
    console.log('Diagnostics completed');
    
    return {
      success: true,
      message: 'Diagnostics completed successfully',
      results: results
    };
    
  } catch (error) {
    console.log('ERROR in runDiagnostics:', error.toString());
    return {
      success: false,
      message: 'Diagnostics failed: ' + error.message,
      error: error.toString()
    };
  }
}