import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, AlertCircle, Check } from 'lucide-react';

const ApplicationModal = ({ isOpen, onClose, date, period, className, applications, onApply, onUpdate, onDelete }) => {
  // 입력 폼 필드 상태
  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  
  // 수정 중인 항목의 ID, 에러 및 저장 진행 여부 상태
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 모달이 열릴 때마다 입력 상태와 에러 초기화
  useEffect(() => {
    if (isOpen) {
      setSubject('');
      setTeacher('');
      setEditingId(null);
      setError('');
      setIsSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 현재 셀의 기존 신청 목록 가져오기
  const cellKey = `${date}_${period}_${className}`;
  const currentApps = applications[cellKey] || [];

  // [등록 및 수정 처리]
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 1. 공백 및 필수 값 검증
    if (!subject.trim() || !teacher.trim()) {
      setError('과목과 이름을 모두 입력해 주세요.');
      return;
    }

    // 2. 신규 신청 시 최대 개수 제한(3개) 검증
    if (!editingId && currentApps.length >= 3) {
      setError('한 셀에는 최대 3개까지만 신청할 수 있습니다.');
      return;
    }

    // 3. 중복 신청 검증
    const isDuplicate = currentApps.some(
      (app) => 
        app.id !== editingId && 
        app.subject.trim() === subject.trim() && 
        app.teacher.trim() === teacher.trim()
    );

    if (isDuplicate) {
      setError('이 셀에 동일한 과목과 이름이 이미 등록되어 있습니다.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        // 수정 동작 수행
        await onUpdate(editingId, subject.trim(), teacher.trim());
        setEditingId(null);
      } else {
        // 신규 추가 동작 수행
        await onApply(subject.trim(), teacher.trim());
      }
      
      // 입력창 비우기
      setSubject('');
      setTeacher('');
    } catch (err) {
      setError(err.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // [수정 모드 진입]
  const handleStartEdit = (app) => {
    setEditingId(app.id);
    setSubject(app.subject);
    setTeacher(app.teacher);
    setError('');
  };

  // [수정 모드 취소]
  const handleCancelEdit = () => {
    setEditingId(null);
    setSubject('');
    setTeacher('');
    setError('');
  };

  // [삭제 처리]
  const handleDeleteClick = async (id) => {
    setError('');
    setIsSaving(true);
    try {
      await onDelete(id);
      if (editingId === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* 모달 헤더 */}
        <div className="modal-header">
          <div>
            <h3>신청 내역 관리</h3>
            <p>{date} | {period}교시 | {className}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 에러 메시지 표시 */}
        {error && (
          <div className="error-msg">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 저장 중 로딩 피드백 메시지 */}
        {isSaving && (
          <div className="info-msg" style={{ background: '#e0f2fe', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '12px', padding: '10px 12px', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} className="syncing" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }} />
            <span>시간표 데이터를 안전하게 저장하고 있습니다. 잠시만 기다려 주세요...</span>
          </div>
        )}

        {/* 기존 신청 리스트 */}
        <div className="modal-app-list">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            현재 신청 리스트 ({currentApps.length} / 3)
          </h4>
          {currentApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              신청된 수업이 없습니다. 아래 폼에서 신청해 주세요.
            </div>
          ) : (
            currentApps.map((app) => (
              <div 
                key={app.id} 
                className={`modal-app-card ${editingId === app.id ? 'editing' : ''}`}
                style={editingId === app.id ? { borderColor: 'var(--accent-pink)', background: '#fff5f6' } : {}}
              >
                <div className="modal-app-info">
                  <span className="modal-app-subject">{app.subject}</span>
                  <span className="modal-app-teacher">{app.teacher} 선생님</span>
                </div>
                <div className="modal-app-actions">
                  <button 
                    className="action-icon-btn edit" 
                    title="변경"
                    onClick={() => handleStartEdit(app)}
                    disabled={isSaving}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button 
                    className="action-icon-btn delete" 
                    title="삭제"
                    onClick={() => handleDeleteClick(app.id)}
                    disabled={isSaving}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 신규 등록 및 수정 입력 폼 */}
        {currentApps.length >= 3 && !editingId ? (
          <div className="info-msg" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', fontSize: '12.5px', padding: '10px 14px', borderRadius: '12px', textAlign: 'center', fontWeight: '500' }}>
            이 교실은 최대 3개 신청이 완료되어 추가 신청할 수 없습니다.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h4 className="input-form-title">
              {editingId ? '신청 내용 변경하기' : '새로운 수업 신청하기'}
            </h4>
            
            <div className="input-row">
              <div className="input-group">
                <label htmlFor="subject-input">과목명</label>
                <input
                  id="subject-input"
                  type="text"
                  placeholder="예: 실용수학, 영어회화"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={15}
                  disabled={isSaving}
                />
              </div>
              <div className="input-group">
                <label htmlFor="teacher-input">이름 (교사명)</label>
                <input
                  id="teacher-input"
                  type="text"
                  placeholder="예: 홍길동"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  maxLength={10}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="form-actions">
              {editingId && (
                <button type="button" className="btn-secondary" onClick={handleCancelEdit} disabled={isSaving}>
                  취소
                </button>
              )}
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw size={15} className="syncing" style={{ animation: 'spin 1.5s linear infinite' }} />
                    <span>저장 중...</span>
                  </>
                ) : (
                  <>
                    {editingId ? <Check size={16} /> : <Plus size={16} />}
                    <span>{editingId ? '변경 저장' : '저장하기'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ApplicationModal;
