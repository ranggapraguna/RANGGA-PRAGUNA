import { SchoolExpense, SchoolInfo, Triwulan } from '../types';
import { expensesToSheetRows, generateSummarySheetRows, sheetRowsToExpenses } from '../utils/googleSheetsFormatter';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface SheetMetadata {
  id: string;
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
  }>;
  spreadsheetUrl: string;
}

/**
 * List spreadsheets from the user's Google Drive.
 */
export async function listSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=20&fields=files(id, name, modifiedTime, webViewLink)`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal mengambil daftar spreadsheet dari Google Drive: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Fetch spreadsheet metadata including sheet tabs.
 */
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string): Promise<SheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title))`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal mengakses Google Spreadsheet (${spreadsheetId}): ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return {
    id: data.spreadsheetId,
    title: data.properties?.title || 'BOSP Spreadsheet',
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
    })),
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

/**
 * Creates a brand new Google Spreadsheet configured specifically for BOSP.
 * Tabs: 'Ringkasan Pagu', 'Semua Belanja', 'TW1', 'TW2', 'TW3', 'TW4'.
 */
export async function createBospSpreadsheet(
  accessToken: string,
  schoolInfo: SchoolInfo,
  expenses: SchoolExpense[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = `BOSP ${schoolInfo.namaSekolah} - TA ${schoolInfo.tahunAnggaran}`;

  const requestBody = {
    properties: {
      title,
    },
    sheets: [
      { properties: { title: 'Ringkasan Pagu', gridProperties: { frozenRowCount: 7 } } },
      { properties: { title: 'Semua Belanja', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW1', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW2', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW3', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW4', gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat Google Spreadsheet baru: ${createRes.status} ${errText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Populate data into the newly created spreadsheet
  await syncExpensesToSpreadsheet(accessToken, spreadsheetId, schoolInfo, expenses);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Pushes/Syncs all expenses and summary data into the specified Google Spreadsheet.
 */
export async function syncExpensesToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  schoolInfo: SchoolInfo,
  expenses: SchoolExpense[]
): Promise<{ updatedCells: number }> {
  // First, verify tabs exist or inspect spreadsheet
  const meta = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const existingTabTitles = meta.sheets.map((s) => s.title);

  // If missing tabs like 'Semua Belanja', create them via batchUpdate
  const requiredTabs = ['Ringkasan Pagu', 'Semua Belanja', 'TW1', 'TW2', 'TW3', 'TW4'];
  const missingTabs = requiredTabs.filter((tab) => !existingTabTitles.includes(tab));

  if (missingTabs.length > 0) {
    const addSheetRequests = missingTabs.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            frozenRowCount: title === 'Ringkasan Pagu' ? 7 : 1,
          },
        },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: addSheetRequests }),
    });
  }

  // Prepare batch values payload
  const summaryRows = generateSummarySheetRows(schoolInfo, expenses);
  const allExpenseRows = expensesToSheetRows(expenses);

  // Per quarter rows
  const quarters: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];
  const dataPayload: Array<{ range: string; values: (string | number)[][] }> = [
    {
      range: `'Ringkasan Pagu'!A1:Z50`,
      values: summaryRows,
    },
    {
      range: `'Semua Belanja'!A1:U${Math.max(allExpenseRows.length, 100)}`,
      values: allExpenseRows,
    },
  ];

  quarters.forEach((tw) => {
    const twExpenses = expenses.filter((e) => e.triwulan === tw);
    const twRows = expensesToSheetRows(twExpenses);
    dataPayload.push({
      range: `'${tw}'!A1:U${Math.max(twRows.length, 100)}`,
      values: twRows,
    });
  });

  // Clear existing ranges first to avoid stale trailing rows, or write with USER_ENTERED
  const batchUpdateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataPayload,
    }),
  });

  if (!batchUpdateRes.ok) {
    const errText = await batchUpdateRes.text();
    throw new Error(`Gagal menyinkronkan data ke Google Sheets: ${batchUpdateRes.status} ${errText}`);
  }

  const result = await batchUpdateRes.json();
  return { updatedCells: result.totalUpdatedCells || 0 };
}

/**
 * Imports expenses from Google Spreadsheet ('Semua Belanja' tab, or the first available sheet).
 */
export async function fetchExpensesFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<SchoolExpense[]> {
  const meta = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const targetTab = meta.sheets.find((s) => s.title === 'Semua Belanja') || meta.sheets[0];

  if (!targetTab) {
    throw new Error('Spreadsheet tidak memiliki lembar sheet yang valid.');
  }

  const range = `'${targetTab.title}'!A1:U1000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membaca data dari Google Sheets: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const rows = data.values || [];
  return sheetRowsToExpenses(rows);
}
