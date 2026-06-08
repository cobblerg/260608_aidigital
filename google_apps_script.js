/**
 * =========================================================================
 * AI 디지털 리터러시 진단검사 시간표 설문 - 구글 앱스 스크립트 (Google Apps Script)
 * =========================================================================
 * 
 * [설치 방법 안내]
 * 1. 시간표 데이터를 저장할 구글 스프레드시트(새 문서)를 생성합니다.
 * 2. 시트 상단 메뉴의 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 기존에 있던 코드를 모두 지우고 이 스크립트 코드 전체를 복사하여 붙여넣습니다.
 * 4. 상단 메뉴의 [배포] -> [새 배포]를 클릭합니다.
 * 5. 배포 유형 선택(톱니바퀴)에서 [웹 앱]을 선택합니다.
 * 6. 설정을 다음과 같이 변경합니다:
 *    - 설명: 시간표 설문 API 배포
 *    - 웹 앱 실행 대상: 나 (본인 구글 계정)
 *    - 액세스 권한이 있는 사용자: 모든 사람 (Anyone) <- 매우 중요! 다른 사용자 조작을 위해 필수입니다.
 * 7. [배포] 버튼을 클릭하고 구글 계정 액세스 승인(권한 허용) 단계를 완료합니다.
 * 8. 배포 성공 화면에 나타나는 "웹 앱 URL" 주소(https://script.google.com/macros/s/.../exec)를 복사합니다.
 * 9. 복사한 주소를 시간표 웹앱의 상단 [구글 시트 연동 설정] 창에 입력하고 저장하면 연동이 완료됩니다!
 */

// 시트 이름 정의
const SHEET_APPS = 'applications';
const SHEET_CONFS = 'confirmations';

// 1. 필요한 시트와 헤더 열을 자동으로 설정해 주는 헬퍼 함수
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1-1. applications 시트 생성 및 초기화
  let appSheet = ss.getSheetByName(SHEET_APPS);
  if (!appSheet) {
    appSheet = ss.insertSheet(SHEET_APPS);
    appSheet.appendRow(['id', 'date', 'period', 'className', 'subject', 'teacher']);
    appSheet.setFrozenRows(1); // 첫 행 고정
  }
  
  // 1-2. confirmations 시트 생성 및 초기화
  let confSheet = ss.getSheetByName(SHEET_CONFS);
  if (!confSheet) {
    confSheet = ss.insertSheet(SHEET_CONFS);
    confSheet.appendRow(['key', 'class', 'subject', 'teacher']);
    confSheet.setFrozenRows(1); // 첫 행 고정
  }
}

// 2. 외부 GET 요청을 받아 전체 시간표 데이터를 포맷팅하여 응답하는 함수
function doGet(e) {
  setupSheets();
  const data = getScheduleData();
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 3. 외부 POST 요청(신청, 수정, 삭제, 확정 등)을 처리하는 함수
function doPost(e) {
  setupSheets();
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    let result = { success: true };
    
    // 동작 타입에 따른 비즈니스 로직 분기
    if (action === 'apply') {
      result = applyClass(postData);
    } else if (action === 'update') {
      result = updateClass(postData);
    } else if (action === 'delete') {
      result = deleteClass(postData);
    } else if (action === 'confirm') {
      result = confirmClass(postData);
    } else if (action === 'unconfirm') {
      result = unconfirmClass(postData);
    } else if (action === 'reset') {
      result = resetAllData();
    } else {
      throw new Error('올바르지 않은 작업 요청(Action)입니다.');
    }
    
    // 처리가 성공했으면 최신 시간표 상태를 동봉하여 응답
    if (result.success) {
      result.data = getScheduleData();
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    const errorResult = { success: false, error: err.message };
    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 4. 전체 신청 및 확정 내역을 파싱하여 가공된 JSON 형태로 반환하는 함수
function getScheduleData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appSheet = ss.getSheetByName(SHEET_APPS);
  const confSheet = ss.getSheetByName(SHEET_CONFS);
  
  const applications = {};
  const confirmations = {};
  
  // 4-1. 신청 내역 읽기
  const appRows = appSheet.getDataRange().getValues();
  // 첫 번째 행은 헤더(id, date, period...)이므로 인덱스 1부터 탐색
  for (let i = 1; i < appRows.length; i++) {
    const [id, date, period, className, subject, teacher] = appRows[i];
    if (!id) continue;
    
    const key = `${date}_${period}_${className}`;
    if (!applications[key]) {
      applications[key] = [];
    }
    applications[key].push({
      id: String(id),
      subject: String(subject),
      teacher: String(teacher)
    });
  }
  
  // 4-2. 최종 확정 내역 읽기
  const confRows = confSheet.getDataRange().getValues();
  for (let i = 1; i < confRows.length; i++) {
    const [key, className, subject, teacher] = confRows[i];
    if (!key) continue;
    
    confirmations[String(key)] = {
      class: String(className),
      subject: String(subject),
      teacher: String(teacher)
    };
  }
  
  return { applications, confirmations };
}

// 5. 신규 신청 추가 함수
function applyClass(params) {
  const { date, period, className, subject, teacher } = params;
  if (!date || !period || !className || !subject || !teacher) {
    throw new Error('신청할 모든 입력 필드(과목, 성함)를 작성해 주세요.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_APPS);
  const rows = sheet.getDataRange().getValues();
  
  // 5-1. 해당 셀의 기존 신청 목록 조회
  const key = `${date}_${period}_${className}`;
  const cellApps = [];
  
  for (let i = 1; i < rows.length; i++) {
    const [rId, rDate, rPeriod, rClass, rSubject, rTeacher] = rows[i];
    if (rDate === date && String(rPeriod) === String(period) && rClass === className) {
      cellApps.push({ subject: String(rSubject), teacher: String(rTeacher) });
    }
  }
  
  // 5-2. 한 셀에 최대 3개 개수 검증
  if (cellApps.length >= 3) {
    throw new Error('한 교실에는 최대 3개까지만 신청할 수 있습니다.');
  }
  
  // 5-3. 동일 과목+이름 중복 검증
  const isDuplicate = cellApps.some(
    app => app.subject.trim() === subject.trim() && app.teacher.trim() === teacher.trim()
  );
  if (isDuplicate) {
    throw new Error('동일한 교실에 이미 같은 과목과 성함이 등록되어 있습니다.');
  }
  
  // 5-4. 신규 신청 행 추가
  const newId = Math.random().toString(36).substring(2, 9);
  sheet.appendRow([newId, date, period, className, subject.trim(), teacher.trim()]);
  
  return { success: true };
}

// 6. 신청 내역 수정 함수
function updateClass(params) {
  const { date, period, className, id, subject, teacher } = params;
  if (!id || !subject || !teacher) {
    throw new Error('수정할 필수 정보가 유실되었습니다.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appSheet = ss.getSheetByName(SHEET_APPS);
  const appRows = appSheet.getDataRange().getValues();
  
  let targetRowIndex = -1;
  const cellApps = [];
  
  for (let i = 1; i < appRows.length; i++) {
    const [rId, rDate, rPeriod, rClass, rSubject, rTeacher] = appRows[i];
    if (rDate === date && String(rPeriod) === String(period) && rClass === className) {
      if (String(rId) === String(id)) {
        targetRowIndex = i + 1; // Google Sheet 행은 1부터 시작하고 배열 인덱스보다 1이 큼
      } else {
        cellApps.push({ subject: String(rSubject), teacher: String(rTeacher) });
      }
    }
  }
  
  if (targetRowIndex === -1) {
    throw new Error('수정할 대상 신청을 찾을 수 없습니다.');
  }
  
  // 다른 신청과의 중복 검사
  const isDuplicate = cellApps.some(
    app => app.subject.trim() === subject.trim() && app.teacher.trim() === teacher.trim()
  );
  if (isDuplicate) {
    throw new Error('동일한 교실에 이미 같은 과목과 성함이 등록되어 있습니다.');
  }
  
  // 신청 정보 업데이트 (E열: 과목, F열: 교사명)
  appSheet.getRange(targetRowIndex, 5).setValue(subject.trim());
  appSheet.getRange(targetRowIndex, 6).setValue(teacher.trim());
  
  // 만약 수정하는 대상이 이미 최종 확정된 수업이었다면 확정 테이블 정보도 연동하여 수정
  const confSheet = ss.getSheetByName(SHEET_CONFS);
  const confRows = confSheet.getDataRange().getValues();
  const confKey = `${date}_${period}`;
  
  for (let j = 1; j < confRows.length; j++) {
    const [cKey, cClass, cSubject, cTeacher] = confRows[j];
    if (cKey === confKey && cClass === className) {
      const originalApp = appRows[targetRowIndex - 1]; // 원래 과목, 교사값 확인
      if (cSubject === originalApp[4] && cTeacher === originalApp[5]) {
        confSheet.getRange(j + 1, 3).setValue(subject.trim());
        confSheet.getRange(j + 1, 4).setValue(teacher.trim());
      }
      break;
    }
  }
  
  return { success: true };
}

// 7. 신청 내역 삭제 함수
function deleteClass(params) {
  const { date, period, className, id } = params;
  if (!id) {
    throw new Error('삭제할 대상의 정보가 유실되었습니다.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appSheet = ss.getSheetByName(SHEET_APPS);
  const appRows = appSheet.getDataRange().getValues();
  
  let targetRowIndex = -1;
  let targetAppSubject = '';
  let targetAppTeacher = '';
  
  for (let i = 1; i < appRows.length; i++) {
    const [rId, rDate, rPeriod, rClass, rSubject, rTeacher] = appRows[i];
    if (String(rId) === String(id)) {
      targetRowIndex = i + 1;
      targetAppSubject = String(rSubject);
      targetAppTeacher = String(rTeacher);
      break;
    }
  }
  
  if (targetRowIndex === -1) {
    throw new Error('삭제할 대상 신청 데이터를 찾을 수 없습니다.');
  }
  
  // 만약 삭제하려는 대상이 해당 교시의 확정 정보였다면 확정도 함께 취소
  const confSheet = ss.getSheetByName(SHEET_CONFS);
  const confRows = confSheet.getDataRange().getValues();
  const confKey = `${date}_${period}`;
  
  for (let j = 1; j < confRows.length; j++) {
    const [cKey, cClass, cSubject, cTeacher] = confRows[j];
    if (cKey === confKey && cClass === className && cSubject === targetAppSubject && cTeacher === targetAppTeacher) {
      confSheet.deleteRow(j + 1);
      break;
    }
  }
  
  // 신청 행 삭제
  appSheet.deleteRow(targetRowIndex);
  
  return { success: true };
}

// 8. 시간표 최종 확정 함수
function confirmClass(params) {
  const { date, period, className, subject, teacher } = params;
  if (!date || !period || !className || !subject || !teacher) {
    throw new Error('확정 처리에 필요한 필수 정보가 누락되었습니다.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const confSheet = ss.getSheetByName(SHEET_CONFS);
  const confRows = confSheet.getDataRange().getValues();
  const confKey = `${date}_${period}`;
  
  // 8-1. 동일 학급 중복 확정 검증 (해당 반이 다른 요일/교시에 이미 확정되었는지 체크)
  for (let i = 1; i < confRows.length; i++) {
    const [cKey, cClass, cSubject, cTeacher] = confRows[i];
    if (cKey !== confKey && cClass === className) {
      throw new Error(`${className}은 이미 다른 일자/교시에 확정되어 중복 확정할 수 없습니다.`);
    }
  }
  
  // 8-2. 기존 확정 내역 교체 또는 신규 확정 등록
  let targetRowIndex = -1;
  for (let i = 1; i < confRows.length; i++) {
    if (confRows[i][0] === confKey) {
      targetRowIndex = i + 1;
      break;
    }
  }
  
  if (targetRowIndex !== -1) {
    // 기존 확정 덮어쓰기
    confSheet.getRange(targetRowIndex, 2).setValue(className);
    confSheet.getRange(targetRowIndex, 3).setValue(subject.trim());
    confSheet.getRange(targetRowIndex, 4).setValue(teacher.trim());
  } else {
    // 신규 확정 행 추가
    confSheet.appendRow([confKey, className, subject.trim(), teacher.trim()]);
  }
  
  return { success: true };
}

// 9. 시간표 확정 취소 함수
function unconfirmClass(params) {
  const { date, period } = params;
  if (!date || !period) {
    throw new Error('확정 취소에 필요한 필수 정보가 누락되었습니다.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const confSheet = ss.getSheetByName(SHEET_CONFS);
  const confRows = confSheet.getDataRange().getValues();
  const confKey = `${date}_${period}`;
  
  for (let i = 1; i < confRows.length; i++) {
    if (confRows[i][0] === confKey) {
      confSheet.deleteRow(i + 1);
      break;
    }
  }
  
  return { success: true };
}

// 10. 전체 신청 및 확정 내역 리셋 함수
function resetAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appSheet = ss.getSheetByName(SHEET_APPS);
  const confSheet = ss.getSheetByName(SHEET_CONFS);
  
  // 헤더를 제외한 모든 데이터 지우기
  if (appSheet.getLastRow() > 1) {
    appSheet.deleteRows(2, appSheet.getLastRow() - 1);
  }
  if (confSheet.getLastRow() > 1) {
    confSheet.deleteRows(2, confSheet.getLastRow() - 1);
  }
  
  return { success: true };
}
