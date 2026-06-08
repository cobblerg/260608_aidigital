import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// CORS 설정 및 JSON 파싱 미들웨어 등록
app.use(cors());
app.use(express.json());

// 데이터 파일 저장 경로 설정
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'schedule.json');

// 데이터 디렉토리가 없으면 생성
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 초기 데이터 구조
const defaultData = {
  applications: {}, // Key: '날짜_교시_학급', Value: [{ id, subject, teacher }]
  confirmations: {} // Key: '날짜_교시', Value: { class, subject, teacher }
};

// 파일에서 데이터를 읽어오는 헬퍼 함수
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('데이터 읽기 오류:', error);
    return defaultData;
  }
}

// 파일에 데이터를 저장하는 헬퍼 함수
function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('데이터 저장 오류:', error);
  }
}

// ID 생성을 위한 간단한 헬퍼 함수 (UUID 대용)
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// 1. 전체 시간표 데이터 조회 API
app.get('/api/schedule', (req, res) => {
  const data = readData();
  res.json(data);
});

// 2. 신규 수업 신청 API
app.post('/api/apply', (req, res) => {
  const { date, period, className, subject, teacher } = req.body;

  // 필수값 검증
  if (!date || !period || !className || !subject || !teacher) {
    return res.status(400).json({ error: '모든 필드(과목, 이름)를 입력해 주세요.' });
  }

  const data = readData();
  const cellKey = `${date}_${period}_${className}`;
  
  if (!data.applications[cellKey]) {
    data.applications[cellKey] = [];
  }

  const cellApps = data.applications[cellKey];

  // 1. 최대 3개 신청 검증
  if (cellApps.length >= 3) {
    return res.status(400).json({ error: '한 셀에는 최대 3개까지만 신청할 수 있습니다.' });
  }

  // 2. 중복 신청 검증 (과목과 교사명이 동일한지 여부)
  const isDuplicate = cellApps.some(
    app => app.subject.trim() === subject.trim() && app.teacher.trim() === teacher.trim()
  );

  if (isDuplicate) {
    return res.status(400).json({ error: '동일한 셀에 같은 과목과 이름이 이미 존재합니다.' });
  }

  // 신청 추가
  const newApp = {
    id: generateId(),
    subject: subject.trim(),
    teacher: teacher.trim()
  };
  cellApps.push(newApp);

  writeData(data);
  res.json({ success: true, data });
});

// 3. 신청 수정 API
app.post('/api/update', (req, res) => {
  const { date, period, className, id, subject, teacher } = req.body;

  if (!date || !period || !className || !id || !subject || !teacher) {
    return res.status(400).json({ error: '수정할 필수 정보가 누락되었습니다.' });
  }

  const data = readData();
  const cellKey = `${date}_${period}_${className}`;
  const cellApps = data.applications[cellKey] || [];

  const appIndex = cellApps.findIndex(app => app.id === id);
  if (appIndex === -1) {
    return res.status(404).json({ error: '수정할 대상을 찾을 수 없습니다.' });
  }

  // 다른 신청과의 중복 검증
  const isDuplicate = cellApps.some(
    (app, idx) => idx !== appIndex && app.subject.trim() === subject.trim() && app.teacher.trim() === teacher.trim()
  );

  if (isDuplicate) {
    return res.status(400).json({ error: '동일한 셀에 같은 과목과 이름이 이미 존재합니다.' });
  }

  // 원래 확정되었던 건인지 파악하여 확정 정보도 함께 동기화 수정
  const confKey = `${date}_${period}`;
  const currentConf = data.confirmations[confKey];
  const originalApp = cellApps[appIndex];
  
  if (currentConf && currentConf.class === className && currentConf.subject === originalApp.subject && currentConf.teacher === originalApp.teacher) {
    data.confirmations[confKey] = {
      class: className,
      subject: subject.trim(),
      teacher: teacher.trim()
    };
  }

  // 신청 정보 수정
  cellApps[appIndex] = {
    id,
    subject: subject.trim(),
    teacher: teacher.trim()
  };

  writeData(data);
  res.json({ success: true, data });
});

// 4. 신청 삭제 API
app.post('/api/delete', (req, res) => {
  const { date, period, className, id } = req.body;

  if (!date || !period || !className || !id) {
    return res.status(400).json({ error: '삭제할 필수 정보가 누락되었습니다.' });
  }

  const data = readData();
  const cellKey = `${date}_${period}_${className}`;
  const cellApps = data.applications[cellKey] || [];

  const appIndex = cellApps.findIndex(app => app.id === id);
  if (appIndex === -1) {
    return res.status(404).json({ error: '삭제할 대상을 찾을 수 없습니다.' });
  }

  const targetApp = cellApps[appIndex];

  // 만약 삭제하는 대상이 해당 교시의 확정 정보였다면 확정도 취소
  const confKey = `${date}_${period}`;
  const currentConf = data.confirmations[confKey];
  if (currentConf && currentConf.class === className && currentConf.subject === targetApp.subject && currentConf.teacher === targetApp.teacher) {
    delete data.confirmations[confKey];
  }

  // 신청 배열에서 제거
  cellApps.splice(appIndex, 1);
  if (cellApps.length === 0) {
    delete data.applications[cellKey];
  }

  writeData(data);
  res.json({ success: true, data });
});

// 5. 시간표 최종 확정 API
app.post('/api/confirm', (req, res) => {
  const { date, period, className, subject, teacher } = req.body;

  if (!date || !period || !className || !subject || !teacher) {
    return res.status(400).json({ error: '확정할 필수 정보가 누락되었습니다.' });
  }

  const data = readData();
  const confKey = `${date}_${period}`;

  // [중복 방지 규칙] 해당 학급이 이미 다른 일자/교시에 최종 확정되었는지 검사
  const isClassConfirmedElsewhere = Object.entries(data.confirmations).some(
    ([key, val]) => key !== confKey && val.class === className
  );

  if (isClassConfirmedElsewhere) {
    return res.status(400).json({ error: `${className}은 이미 다른 일자/교시에 최종 확정되어 있어 중복 확정할 수 없습니다.` });
  }

  // 해당 시간대(월일 및 교시)에는 딱 1개 학급만 확정할 수 있으므로 덮어쓰기 형태로 확정
  data.confirmations[confKey] = {
    class: className,
    subject: subject.trim(),
    teacher: teacher.trim()
  };

  writeData(data);
  res.json({ success: true, data });
});

// 6. 시간표 확정 취소(해제) API
app.post('/api/unconfirm', (req, res) => {
  const { date, period } = req.body;

  if (!date || !period) {
    return res.status(400).json({ error: '확정 해제할 필수 정보가 누락되었습니다.' });
  }

  const data = readData();
  const confKey = `${date}_${period}`;

  if (data.confirmations[confKey]) {
    delete data.confirmations[confKey];
  }

  writeData(data);
  res.json({ success: true, data });
});

// 7. 전체 데이터 초기화 API
app.post('/api/reset', (req, res) => {
  const data = {
    applications: {},
    confirmations: {}
  };
  writeData(data);
  res.json({ success: true, data });
});

// 서버 가동
app.listen(PORT, () => {
  console.log(`백엔드 서버가 http://localhost:${PORT} 에서 구동 중입니다.`);
});
