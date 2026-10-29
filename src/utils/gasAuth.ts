import { UserProfile } from '../types/auth';
import { normalizeUserRole } from './auth';
import { normalizeUptKey } from '../data/schoolData';

export const DEFAULT_GAS_URL = 
  'https://script.google.com/macros/s/AKfycbxn2BoqwWRZkY8KC7QVfEZKJnS-RVuCUVJZferasj8Z9TZ9eFv-VjXFxztVs00BLUV__w/exec';

const STORAGE_KEY_GAS_URL = 'appsheet_gas_auth_url_v2';

export function getGasAuthUrl(): string {
  try {
    // Clear legacy keys so old script URLs don't override the new deployment
    localStorage.removeItem('appsheet_gas_auth_url_v1');
    const custom = localStorage.getItem(STORAGE_KEY_GAS_URL);
    if (
      custom &&
      (custom.includes('AKfycbz1hB2OmNXNVLfIzmQR') ||
        custom.includes('AKfycbwD2TvnOYyWKU-ICMVgaZ-E_DXGxjxrqqQztGwRd0VNR12Ek_SJBhyotLbhXaKP6gaCwA') ||
        !custom.trim())
    ) {
      localStorage.setItem(STORAGE_KEY_GAS_URL, DEFAULT_GAS_URL);
      return DEFAULT_GAS_URL;
    }
    return custom && custom.trim() ? custom.trim() : DEFAULT_GAS_URL;
  } catch {
    return DEFAULT_GAS_URL;
  }
}

export function saveGasAuthUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GAS_URL, url.trim());
  } catch (err) {
    console.error('Failed to save GAS auth URL', err);
  }
}

export interface GasAuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  isGasScriptError?: boolean;
}

/**
 * Pure parser function to interpret responses from Google Apps Script Web App
 * Supports Kolom A: ID, Kolom B: Nama, Kolom C: Username, Kolom D: Password, Kolom E: Role, Kolom F: NAMA UPT, Kolom G: Waktu_Dibuat
 */
export function parseGasResponse(rawText: string, requestedUpt?: string): GasAuthResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      success: false,
      error: 'Respon dari Google Apps Script kosong atau tidak valid.',
    };
  }

  // Check for common Google Apps Script deployment errors
  if (rawText.includes('Script function not found: doPost') || rawText.includes('Script function not found: doGet')) {
    return {
      success: false,
      error: 'Fungsi doPost(e) belum dideploy pada Google Apps Script URL tersebut. Mohon salin template kode Apps Script ke editor script Spreadsheet Anda.',
      isGasScriptError: true,
    };
  }

  if (rawText.includes('Script error') || rawText.includes('Authorization is required')) {
    return {
      success: false,
      error: 'Google Apps Script memerlukan izin otorisasi atau deployment Web App belum disetel ke "Anyone" (Siapa saja).',
      isGasScriptError: true,
    };
  }

  // Try parsing JSON
  try {
    let jsonString = rawText.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    const data = JSON.parse(jsonString);

    if (data.status === 'success' || data.success === true) {
      const u = data.user || data.data || data;
      const usernameVal = u.username || u.user || u.email || 'pengguna';
      const rawUptFromSheet = String(
        u.namaUpt || u.upt || u.schoolName || u.sekolah || ''
      ).trim();

      // Enforce UPT match if the spreadsheet returned a valid NAMA UPT from Kolom F
      const isLegacyDefaultSchool =
        !rawUptFromSheet || rawUptFromSheet.toUpperCase() === 'SD NEGERI 01 NUSANTARA';

      if (
        requestedUpt &&
        requestedUpt.trim() &&
        !isLegacyDefaultSchool &&
        normalizeUptKey(rawUptFromSheet) !== normalizeUptKey(requestedUpt.trim())
      ) {
        return {
          success: false,
          error: `Username "${usernameVal}" di Google Spreadsheet terdaftar pada UPT "${rawUptFromSheet}", bukan "${requestedUpt}". Silakan pilih UPT yang sesuai.`,
        };
      }

      const resolvedSchoolName = !isLegacyDefaultSchool
        ? rawUptFromSheet
        : requestedUpt?.trim() || 'SD NEGERI 01 NUSANTARA';

      const userProfile: UserProfile = {
        id: String(u.id || `gas-${Date.now()}`),
        username: String(usernameVal),
        name: u.name || u.nama || `Operator ${resolvedSchoolName}`,
        email: u.email || undefined,
        role: normalizeUserRole(u.role || u.peran, usernameVal),
        nip: u.nip || undefined,
        schoolName: resolvedSchoolName,
        createdAt: u.createdAt || u.waktuDibuat || new Date().toISOString(),
      };
      return {
        success: true,
        user: userProfile,
      };
    }

    return {
      success: false,
      error: data.message || data.error || 'Autentikasi gagal di Google Spreadsheet.',
    };
  } catch {
    return {
      success: false,
      error: 'Respon dari Google Apps Script bukan format JSON yang valid.',
      isGasScriptError: true,
    };
  }
}

/**
 * Perform login request to Google Apps Script endpoint (validating Username, Password, and Kolom F: NAMA UPT)
 */
export async function loginWithGoogleAppsScript(
  username: string,
  password: string,
  gasUrl: string = getGasAuthUrl(),
  selectedUpt?: string
): Promise<GasAuthResult> {
  const payload = {
    action: 'login',
    username: username.trim(),
    password: password.trim(),
    upt: selectedUpt ? selectedUpt.trim() : '',
    namaUpt: selectedUpt ? selectedUpt.trim() : '',
  };

  // Try via server proxy if available, fallback to direct fetch
  try {
    const proxyRes = await fetch('/api/auth/gas-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, gasUrl }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.success && data.user) {
        return parseGasResponse(
          JSON.stringify({ status: 'success', user: data.user }),
          selectedUpt
        );
      }
      return { 
        success: false, 
        error: data.error || data.message || 'Login gagal.',
        isGasScriptError: data.isGasScriptError
      };
    }
  } catch {
    // Server proxy failed or not mounted, fallback to direct client-side fetch
  }

  // Direct fetch to Google Apps Script Web App
  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    return parseGasResponse(text, selectedUpt);
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal menghubungi Google Apps Script: ${err.message || 'Periksa koneksi internet.'}`,
    };
  }
}

/**
 * Fetch list of UPT schools from Google Spreadsheet (Kolom F: NAMA UPT)
 */
export async function fetchUptListFromGoogleAppsScript(
  gasUrl: string = getGasAuthUrl()
): Promise<Array<{ id: string; name: string; username: string; role: string; namaUpt: string }>> {
  // 1. Try via backend server proxy first
  try {
    const proxyRes = await fetch('/api/auth/gas-schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl }),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if ((data.status === 'success' || data.success === true) && Array.isArray(data.schools)) {
        return data.schools;
      }
    }
  } catch {
    // fallback to direct fetch
  }

  // 2. Fallback to direct GET request (?action=getSchools)
  try {
    const separator = gasUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${gasUrl}${separator}action=getSchools`);
    const text = await response.text();
    const data = JSON.parse(text);
    if ((data.status === 'success' || data.success === true) && Array.isArray(data.schools)) {
      return data.schools;
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Recommended Google Apps Script Code Template Based on:
 * Kolom A: ID
 * Kolom B: Nama
 * Kolom C: Username
 * Kolom D: Password
 * Kolom E: Role
 * Kolom F: NAMA UPT
 * Kolom G: Waktu_Dibuat
 */
export const GAS_CODE_TEMPLATE = `// ========================================================
// KODE GOOGLE APPS SCRIPT UNTUK LOGIN UPT SEKOLAH BOSP
// ========================================================
// Struktur Kolom pada Sheet "Users" (Baris ke-1 adalah Header):
//    Kolom A: ID
//    Kolom B: Nama
//    Kolom C: Username
//    Kolom D: Password
//    Kolom E: Role
//    Kolom F: NAMA UPT
//    Kolom G: Waktu_Dibuat
//
// Cara Pasang:
// 1. Buka Google Spreadsheet Anda -> pastikan Sheet bernama "Users" (atau Sheet pertama)
// 2. Klik menu Extensions -> Apps Script
// 3. Hapus kode lama, tempelkan seluruh kode di bawah ini, lalu tekan Ctrl+S (Simpan)
// 4. Klik Deploy -> Manage deployments -> klik ikon Pensil (Edit) ->
//    pilih Version: "New version" -> klik Deploy
//    (Atau Deploy -> New deployment -> Web app -> Execute as: Me -> Who has access: Anyone)
// ========================================================

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users") || ss.getSheets()[0];
  var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";

  if (action === "getSchools" || action === "list") {
    return ambilDaftarUpt(sheet);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Google Apps Script Login UPT BOSP (Kolom A-G) aktif dan berjalan dengan baik!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  
  try {
    var raw = e.postData ? e.postData.contents : "";
    var data = {};
    try {
      data = JSON.parse(raw);
    } catch(err) {
      data = e.parameter || {};
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Users") || ss.getSheets()[0];
    var action = data.action || "login";
    
    // Pastikan jika sheet kosong dibuatkan header Kolom A s/d Kolom G
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Nama", "Username", "Password", "Role", "NAMA UPT", "Waktu_Dibuat"]);
    }
    
    // Action: Ambil daftar NAMA UPT dari Kolom F untuk pilihan dropdown UPT
    if (action === "getSchools" || action === "list") {
      return ambilDaftarUpt(sheet);
    }
    
    var rows = sheet.getDataRange().getValues();
    
    // Action: Login berdasarkan Username (Kolom C), Password (Kolom D), dan NAMA UPT (Kolom F)
    if (action === "login") {
      var reqUser = String(data.username || data.user || "").trim().toLowerCase();
      var reqPass = String(data.password || "").trim();
      var reqUpt  = String(data.namaUpt || data.upt || data.schoolName || "").trim();
      
      for (var i = 1; i < rows.length; i++) {
        var rowId      = String(rows[i][0] || "usr-" + i).trim(); // Kolom A: ID
        var rowNama    = String(rows[i][1] || "").trim();         // Kolom B: Nama
        var rowUser    = String(rows[i][2] || "").trim().toLowerCase(); // Kolom C: Username
        var rowPass    = String(rows[i][3] || "").trim();         // Kolom D: Password
        var rawRole    = String(rows[i][4] || "Operator BOSP").trim(); // Kolom E: Role
        var rowNamaUpt = String(rows[i][5] || "").trim();         // Kolom F: NAMA UPT
        var rowWaktu   = rows[i][6] ? String(rows[i][6]) : "";    // Kolom G: Waktu_Dibuat
        
        if (rowUser === reqUser && rowPass === reqPass) {
          // Validasi apakah NAMA UPT di Kolom F sesuai dengan UPT yang dipilih pada menu Login
          if (reqUpt && rowNamaUpt && rowNamaUpt.toLowerCase() !== reqUpt.toLowerCase()) {
            return ContentService.createTextOutput(JSON.stringify({
              status: "error",
              message: "Username & Password ini terdaftar untuk UPT \\"" + rowNamaUpt + "\\", tidak sesuai dengan UPT yang dipilih (\\"" + reqUpt + "\\")."
            })).setMimeType(ContentService.MimeType.JSON);
          }
          
          var resolvedRole = (rawRole.toLowerCase().indexOf("admin") !== -1 || rowUser === "admin")
            ? "Admin"
            : "Operator BOSP";
            
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            user: {
              id: rowId,
              name: rowNama || ("Operator " + rowNamaUpt),
              username: rowUser,
              role: resolvedRole,
              namaUpt: rowNamaUpt || reqUpt,
              upt: rowNamaUpt || reqUpt,
              schoolName: rowNamaUpt || reqUpt,
              createdAt: rowWaktu
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Username, Password, atau Pilihan UPT tidak cocok di Google Spreadsheet."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Action tidak dikenal: " + action
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Fungsi pembantu untuk membaca daftar UPT dari Kolom F
function ambilDaftarUpt(sheet) {
  var rows = sheet.getDataRange().getValues();
  var schools = [];
  for (var i = 1; i < rows.length; i++) {
    var namaUpt = String(rows[i][5] || "").trim(); // Kolom F: NAMA UPT
    var username = String(rows[i][2] || "").trim(); // Kolom C: Username
    if (!namaUpt && !username) continue;
    schools.push({
      id: String(rows[i][0] || "usr-" + i).trim(),
      name: String(rows[i][1] || "").trim(),
      username: username,
      role: String(rows[i][4] || "Operator BOSP").trim(),
      namaUpt: namaUpt || String(rows[i][1] || "").trim()
    });
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    schools: schools
  })).setMimeType(ContentService.MimeType.JSON);
}`;
