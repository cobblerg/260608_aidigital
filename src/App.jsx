import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, CheckSquare, Calendar, Database, LogOut, Lock, Settings, Check, AlertCircle } from 'lucide-react';
import ScheduleGrid from './components/ScheduleGrid';
import ApplicationModal from './components/ApplicationModal';
import ConfirmationModal from './components/ConfirmationModal';
import AdminLoginModal from './components/AdminLoginModal';

// 시간표 일자 및 교시 상수 정의
const TIME_SLOTS = [
  { date: '7/6(월)', period: 4 },
  { date: '7/6(월)', period: 5 },
  { date: '7/6(월)', period: 6 },
  { date: '7/7(화)', period: 3 },
  { date: '7/7(화)', period: 4 },
  { date: '7/7(화)', period: 5 },
  { date: '7/9(목)', period: 1 },
  { date: '7/9(목)', period: 2 },
  { date: '7/9(목)', period: 5 },
  { date: '7/10(금)', period: 3 },
  { date: '7/10(금)', period: 4 },
  { date: '7/13(월)', period: 4 },
  { date: '7/13(월)', period: 5 },
  { date: '7/13(월)', period: 6 }
];

// 학급(반) 목록 상수 정의
const CLASSES = ['2-1반', '2-2반', '2-3반', '2-4반', '2-5반', '2-6반', '2-7반', '2-8반'];

// 로컬 스토리지에 임시 저장하는 초기 모형 정의
const LOCAL_STORAGE_KEY = 'local_schedule_data';
// 응답 데이터를 안전하게 JSON으로 파싱하고 구글 권한 에러 등을 친절하게 걸러주는 헬퍼 함수
const safeJsonParse = async (response) => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    throw new Error('구글 시트 연동 웹앱 주소가 올바르지 않거나, 구글 앱스 스크립트의 액세스 권한 설정(모든 사람/Anyone)이 누락되었습니다.');
  }
  try {
    return await response.json();
  } catch (e) {
    throw new Error('데이터 분석 오류가 발생했습니다. 구글 앱스 스크립트 배포 주소(/exec)를 정확히 확인해 주세요.');
  }
};

function App() {
  // 웹앱 기본 상태 관리
  const [applications, setApplications] = useState({});
  const [confirmations, setConfirmations] = useState({});
  const [mode, setMode] = useState('apply'); // 'apply': 신청 모드, 'confirm': 확정 모드
  
  // 구글 스프레드시트 API URL 설정 상태
  const [sheetApiUrl, setSheetApiUrl] = useState(localStorage.getItem('google_sheet_api_url') || 'https://script.google.com/macros/s/AKfycbzSJku4hBFsYLsmEdbuACcS0hLlo9DqSdDynuSqdNKvQIRXM9G1iZdRmxyZpdQ5LlM/exec');
  const [tempUrl, setTempUrl] = useState(localStorage.getItem('google_sheet_api_url') || 'https://script.google.com/macros/s/AKfycbzSJku4hBFsYLsmEdbuACcS0hLlo9DqSdDynuSqdNKvQIRXM9G1iZdRmxyZpdQ5LlM/exec');
  const [showSettings, setShowSettings] = useState(false); // 설정 영역 토글
  const [isUrlSaved, setIsUrlSaved] = useState(!!localStorage.getItem('google_sheet_api_url') || true);

  // 관리자 인증 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(''); // 'confirm-mode' | 'reset-all'

  // 실시간 동기화 상태 배지
  const [syncStatus, setSyncStatus] = useState('idle');

  // 모달 제어용 상태
  const [selectedCell, setSelectedCell] = useState(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // [로컬 스토리지 헬퍼] 로컬 모드일 때 사용할 데이터 읽기/쓰기
  const readLocalData = () => {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      return local ? JSON.parse(local) : defaultLocalData;
    } catch {
      return defaultLocalData;
    }
  };

  const writeLocalData = (data) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  };

  // [데이터 통합 로드 API] 구글 시트 또는 로컬스토리지로부터 정보 수집
  const fetchScheduleData = async (showSyncing = true) => {
    if (showSyncing) setSyncStatus('syncing');

    // 1. 구글 시트 주소가 있을 때: 실시간 클라우드 모드로 작동
    if (sheetApiUrl.trim()) {
      try {
        const response = await fetch(sheetApiUrl);
        if (!response.ok) throw new Error('구글 시트 응답 실패');
        const data = await safeJsonParse(response);
        
        setApplications(data.applications || {});
        setConfirmations(data.confirmations || {});
        setSyncStatus('success');
      } catch (error) {
        console.error('구글 시트 연동 실패:', error);
        setSyncStatus('error');
      }
    } 
    // 2. 구글 시트 주소가 없을 때: 샌드박스 로컬 데모 모드로 작동
    else {
      const localData = readLocalData();
      setApplications(localData.applications || {});
      setConfirmations(localData.confirmations || {});
      setSyncStatus('success');
    }
  };

  // 컴포넌트 장착 시 및 API 주소 변경 시 실행
  useEffect(() => {
    fetchScheduleData();

    // 5초 간격으로 폴링 동기화
    const interval = setInterval(() => {
      fetchScheduleData(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [sheetApiUrl]);

  // [구글 시트 API 주소 저장 핸들러]
  const handleSaveApiUrl = (e) => {
    e.preventDefault();
    const cleanUrl = tempUrl.trim();
    localStorage.setItem('google_sheet_api_url', cleanUrl);
    setSheetApiUrl(cleanUrl);
    setIsUrlSaved(!!cleanUrl);
    setShowSettings(false);
    alert(cleanUrl ? '구글 스프레드시트 연동이 성공적으로 등록되었습니다!' : '데모 모드(로컬 저장)로 작동 모드가 전환되었습니다.');
  };

  // [셀 클릭 이벤트 핸들러]
  const handleCellClick = (date, period, className) => {
    setSelectedCell({ date, period, className });
    if (mode === 'apply') {
      setIsApplyModalOpen(true);
    } else {
      setIsConfirmModalOpen(true);
    }
  };

  // ==========================================
  // 비즈니스 로직 API 공통 핸들러 (신청/변경/삭제/확정/리셋)
  // ==========================================

  // 1. 신규 수업 신청 저장
  const handleApplySave = async (subject, teacher) => {
    if (!selectedCell) return;
    const { date, period, className } = selectedCell;

    // A. 구글 시트 연결 상태일 때
    if (sheetApiUrl.trim()) {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        redirect: 'follow', // 리다이렉션 자동 추적 (GAS 필수 옵션)
        body: JSON.stringify({ action: 'apply', date, period, className, subject, teacher })
      });
      const result = await safeJsonParse(response);
      if (!result.success) throw new Error(result.error || '구글 시트 저장 실패');
      
      setApplications(result.data.applications);
      setConfirmations(result.data.confirmations);
    } 
    // B. 데모 모드(로컬스토리지)일 때
    else {
      const localData = readLocalData();
      const cellKey = `${date}_${period}_${className}`;
      if (!localData.applications[cellKey]) localData.applications[cellKey] = [];
      
      const newApp = {
        id: Math.random().toString(36).substring(2, 9),
        subject: subject.trim(),
        teacher: teacher.trim()
      };
      
      localData.applications[cellKey].push(newApp);
      writeLocalData(localData);
      setApplications(localData.applications);
    }
  };

  // 2. 신청 정보 변경
  const handleApplyUpdate = async (id, subject, teacher) => {
    if (!selectedCell) return;
    const { date, period, className } = selectedCell;

    // A. 구글 시트 연결 상태일 때
    if (sheetApiUrl.trim()) {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'update', date, period, className, id, subject, teacher })
      });
      const result = await safeJsonParse(response);
      if (!result.success) throw new Error(result.error || '구글 시트 수정 실패');

      setApplications(result.data.applications);
      setConfirmations(result.data.confirmations);
    } 
    // B. 데모 모드(로컬스토리지)일 때
    else {
      const localData = readLocalData();
      const cellKey = `${date}_${period}_${className}`;
      const cellApps = localData.applications[cellKey] || [];
      const appIndex = cellApps.findIndex(app => app.id === id);
      
      if (appIndex !== -1) {
        // 원래 확정된 내역이었는지 체크하여 로컬에서도 동시 업데이트
        const confKey = `${date}_${period}`;
        const currentConf = localData.confirmations[confKey];
        const originalApp = cellApps[appIndex];
        if (currentConf && currentConf.class === className && currentConf.subject === originalApp.subject && currentConf.teacher === originalApp.teacher) {
          localData.confirmations[confKey] = { class: className, subject: subject.trim(), teacher: teacher.trim() };
        }

        cellApps[appIndex] = { id, subject: subject.trim(), teacher: teacher.trim() };
        writeLocalData(localData);
        setApplications(localData.applications);
        setConfirmations(localData.confirmations);
      }
    }
  };

  // 3. 신청 정보 삭제
  const handleApplyDelete = async (id) => {
    if (!selectedCell) return;
    const { date, period, className } = selectedCell;

    // A. 구글 시트 연결 상태일 때
    if (sheetApiUrl.trim()) {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'delete', date, period, className, id })
      });
      const result = await safeJsonParse(response);
      if (!result.success) throw new Error(result.error || '구글 시트 삭제 실패');

      setApplications(result.data.applications);
      setConfirmations(result.data.confirmations);
    } 
    // B. 데모 모드(로컬스토리지)일 때
    else {
      const localData = readLocalData();
      const cellKey = `${date}_${period}_${className}`;
      const cellApps = localData.applications[cellKey] || [];
      const appIndex = cellApps.findIndex(app => app.id === id);

      if (appIndex !== -1) {
        const targetApp = cellApps[appIndex];
        
        // 만약 확정된 건이면 로컬 확정도 동시 해제
        const confKey = `${date}_${period}`;
        const currentConf = localData.confirmations[confKey];
        if (currentConf && currentConf.class === className && currentConf.subject === targetApp.subject && currentConf.teacher === targetApp.teacher) {
          delete localData.confirmations[confKey];
        }

        cellApps.splice(appIndex, 1);
        if (cellApps.length === 0) delete localData.applications[cellKey];

        writeLocalData(localData);
        setApplications(localData.applications);
        setConfirmations(localData.confirmations);
      }
    }
  };

  // 4. 최종 시간표 확정 설정
  const handleConfirmSave = async (className, subject, teacher) => {
    if (!selectedCell) return;
    const { date, period } = selectedCell;

    // A. 구글 시트 연결 상태일 때
    if (sheetApiUrl.trim()) {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'confirm', date, period, className, subject, teacher })
      });
      const result = await safeJsonParse(response);
      if (!result.success) throw new Error(result.error || '구글 시트 확정 실패');

      setApplications(result.data.applications);
      setConfirmations(result.data.confirmations);
    } 
    // B. 데모 모드(로컬스토리지)일 때
    else {
      const localData = readLocalData();
      const confKey = `${date}_${period}`;

      // (로컬 규칙 검증) 다른 시간대에 이 반이 이미 확정되었는지 판별
      const isClassConfirmedElsewhere = Object.entries(localData.confirmations).some(
        ([key, val]) => key !== confKey && val.class === className
      );
      if (isClassConfirmedElsewhere) {
        throw new Error(`${className}은 이미 다른 요일/교시에 확정되어 있어 중복 확정할 수 없습니다.`);
      }

      localData.confirmations[confKey] = { class: className, subject: subject.trim(), teacher: teacher.trim() };
      writeLocalData(localData);
      setConfirmations(localData.confirmations);
    }
  };

  // 5. 확정 해제
  const handleUnconfirm = async () => {
    if (!selectedCell) return;
    const { date, period } = selectedCell;

    // A. 구글 시트 연결 상태일 때
    if (sheetApiUrl.trim()) {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'unconfirm', date, period })
      });
      const result = await safeJsonParse(response);
      if (!result.success) throw new Error(result.error || '구글 시트 확정 해제 실패');

      setApplications(result.data.applications);
      setConfirmations(result.data.confirmations);
    } 
    // B. 데모 모드(로컬스토리지)일 때
    else {
      const localData = readLocalData();
      const confKey = `${date}_${period}`;
      if (localData.confirmations[confKey]) {
        delete localData.confirmations[confKey];
        writeLocalData(localData);
        setConfirmations(localData.confirmations);
      }
    }
  };

  // 6. 전체 초기화 실제 동작부
  const executeResetAll = async () => {
    const isConfirmed = window.confirm('정말로 모든 신청 및 확정 내역을 지우고 초기화하시겠습니까?');
    if (!isConfirmed) return;

    // A. 구글 시트 연결 상태일 때
    if (sheetApiUrl.trim()) {
      try {
        const response = await fetch(sheetApiUrl, {
          method: 'POST',
          redirect: 'follow',
          body: JSON.stringify({ action: 'reset' })
        });
        const result = await safeJsonParse(response);
        if (!result.success) throw new Error('구글 시트 초기화 실패');
        
        setApplications(result.data.applications);
        setConfirmations(result.data.confirmations);
        alert('구글 스프레드시트의 모든 데이터가 성공적으로 초기화되었습니다.');
      } catch (err) {
        alert(err.message || '초기화 작업 중 오류가 발생했습니다.');
      }
    } 
    // B. 데모 모드(로컬스토리지)일 때
    else {
      writeLocalData(defaultLocalData);
      setApplications({});
      setConfirmations({});
      alert('로컬 데모 데이터가 초기화되었습니다.');
    }
  };

  // [관리자 인증 분기 - 확정 모드 진입 요청]
  const handleRequestConfirmMode = () => {
    if (isAdmin) {
      setMode('confirm');
    } else {
      setPendingAction('confirm-mode');
      setIsAdminModalOpen(true);
    }
  };

  // [관리자 인증 분기 - 전체 초기화 요청]
  const handleRequestResetAll = () => {
    if (isAdmin) {
      executeResetAll();
    } else {
      setPendingAction('reset-all');
      setIsAdminModalOpen(true);
    }
  };

  // [관리자 로그인 성공 핸들러]
  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setIsAdminModalOpen(false);
    if (pendingAction === 'confirm-mode') {
      setMode('confirm');
    } else if (pendingAction === 'reset-all') {
      executeResetAll();
    }
    setPendingAction('');
  };

  // [관리자 로그아웃]
  const handleAdminLogout = () => {
    setIsAdmin(false);
    setMode('apply');
    setShowSettings(false); // 연동 설정 열려있을 시 함께 닫기
    alert('관리자 권한 해제 완료! 일반 신청 모드로 되돌아갑니다.');
  };

  return (
    <div className={`app-container ${mode === 'confirm' ? 'confirm-mode-active' : ''}`}>
      {/* 1. 헤더 영역 */}
      <header className="app-header">
        <div className="app-title-group">
          <h1>
            <Calendar size={28} style={{ color: 'var(--accent-pink)' }} />
            AI 디지털 리터러시 진단검사 시간표 설문
          </h1>
          <p>빈 시간에 과목과 성함을 입력해 주시면, 설문이 끝난 후 시간표를 확정하여 안내드립니다.</p>
        </div>

        <div className="controls-panel">
          {/* 동기화 라이브 및 강제 리프레시 버튼 */}
          <div 
            className={`sync-badge ${syncStatus === 'syncing' ? 'syncing' : syncStatus === 'success' ? 'success' : ''}`}
            onClick={() => fetchScheduleData(true)}
            style={{ cursor: 'pointer' }}
            title="클릭 시 최신 정보를 다시 가져옵니다."
          >
            <RefreshCw size={12} />
            <span>
              {syncStatus === 'syncing' && '동기화 중...'}
              {syncStatus === 'success' && '서버 동기화 완료'}
              {syncStatus === 'error' && '구글 시트 연동 실패'}
            </span>
          </div>

          {/* 설정 열기 기어 버튼 (관리자 전용) */}
          {isAdmin && (
            <button 
              className="reset-btn" 
              onClick={() => setShowSettings(!showSettings)}
              style={{ 
                background: showSettings ? '#f3e8ff' : '#f8fafc', 
                color: showSettings ? '#6b21a8' : 'var(--text-secondary)',
                borderColor: '#cbd5e1'
              }}
              title="구글 스프레드시트 연동 설정"
            >
              <Settings size={14} />
              연동 설정
            </button>
          )}

          {/* 신청/확정 모드 전환 스위치 */}
          <div className="mode-toggle-container">
            <button 
              className={`mode-btn ${mode === 'apply' ? 'active apply-mode' : ''}`}
              onClick={() => setMode('apply')}
            >
              <Users size={14} />
              수업 신청 모드
            </button>
            <button 
              className={`mode-btn ${mode === 'confirm' ? 'active confirm-mode' : ''}`}
              onClick={handleRequestConfirmMode}
            >
              <CheckSquare size={14} />
              시간표 확정 모드
            </button>
          </div>

          {/* 관리자 등급 제어 */}
          {isAdmin ? (
            <button className="reset-btn" onClick={handleAdminLogout} style={{ background: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
              <LogOut size={14} />
              관리자 로그아웃
            </button>
          ) : (
            <div className="settings-badge demo" style={{ padding: '8px 12px', borderRadius: '14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} />
              <span>일반 모드</span>
            </div>
          )}

          {/* 전체 초기화 버튼 */}
          <button className="reset-btn" onClick={handleRequestResetAll} title="시간표 내용 리셋">
            <Database size={14} />
            전체 초기화
          </button>
        </div>
      </header>

      {/* 1-2. 구글 스프레드시트 설정 드롭다운 */}
      {showSettings && (
        <form onSubmit={handleSaveApiUrl} className="settings-section glass-panel" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              📊 구글 스프레드시트 연동 매개체 설정
            </h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              {isUrlSaved ? (
                <span className="settings-badge connected">구글 시트 연동 중</span>
              ) : (
                <span className="settings-badge demo">로컬 데모 작동 중 (개인 브라우저에만 저장)</span>
              )}
            </div>
          </div>
          <p style={{ margin: '0 0 4px 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            프로젝트 폴더 내 <code>google_apps_script.js</code> 파일을 참고하여 구글 스프레드시트에 Apps Script 배포를 완료한 뒤, 
            발급받은 <strong>[웹 앱 URL]</strong>을 아래에 입력하고 저장해 주세요.
          </p>
          <div className="settings-input-row">
            <input 
              type="text" 
              placeholder="https://script.google.com/macros/s/.../exec"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ flex: 'none', padding: '8px 16px', borderRadius: '10px' }}>
              <Check size={14} />
              설정 저장
            </button>
          </div>
        </form>
      )}

      {/* 2. 시간표 격자판 */}
      <main>
        <ScheduleGrid
          timeSlots={TIME_SLOTS}
          classes={CLASSES}
          applications={applications}
          confirmations={confirmations}
          mode={mode}
          onCellClick={handleCellClick}
        />
      </main>

      {/* 3. 각종 제어 모달 */}
      {selectedCell && (
        <>
          {/* 신청자 등록 모달 */}
          <ApplicationModal
            isOpen={isApplyModalOpen}
            onClose={() => {
              setIsApplyModalOpen(false);
              setSelectedCell(null);
            }}
            date={selectedCell.date}
            period={selectedCell.period}
            className={selectedCell.className}
            applications={applications}
            onApply={handleApplySave}
            onUpdate={handleApplyUpdate}
            onDelete={handleApplyDelete}
          />

          {/* 최종 선택 확정 모달 */}
          <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => {
              setIsConfirmModalOpen(false);
              setSelectedCell(null);
            }}
            date={selectedCell.date}
            period={selectedCell.period}
            classes={CLASSES}
            applications={applications}
            confirmations={confirmations}
            onConfirm={handleConfirmSave}
            onUnconfirm={handleUnconfirm}
          />
        </>
      )}

      {/* 관리자 확인용 로그인 모달 */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          setPendingAction('');
        }}
        onSuccess={handleAdminLoginSuccess}
        pendingAction={pendingAction}
      />
    </div>
  );
}

export default App;
