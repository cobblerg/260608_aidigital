import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, date, period, classes, applications, confirmations, onConfirm, onUnconfirm }) => {
  // 선택한 최종 확정 후보 상태
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 해당 시간대(날짜/교시)의 전체 신청 후보들을 추출
  const candidates = [];
  classes.forEach((cls) => {
    const cellKey = `${date}_${period}_${cls}`;
    const apps = applications[cellKey] || [];
    apps.forEach((app) => {
      candidates.push({
        class: cls,
        subject: app.subject,
        teacher: app.teacher,
        id: `${cls}_${app.id}` // 고유 식별용
      });
    });
  });

  // 현재 이미 확정된 시간표 정보 확인
  const confKey = `${date}_${period}`;
  const currentConfirmation = confirmations[confKey];

  // 모달이 열릴 때 초기 상태 매핑
  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsSaving(false);
      if (currentConfirmation) {
        // 기존 확정 정보가 있으면 일치하는 후보를 선택 상태로 지정
        const matched = candidates.find(
          (c) => 
            c.class === currentConfirmation.class && 
            c.subject === currentConfirmation.subject && 
            c.teacher === currentConfirmation.teacher
        );
        setSelectedCandidate(matched || null);
      } else {
        setSelectedCandidate(null);
      }
    }
  }, [isOpen, date, period, confirmations]);

  if (!isOpen) return null;

  // [확정 등록 처리]
  const handleSaveConfirm = async () => {
    if (!selectedCandidate) {
      setError('최종 확정할 시간표를 선택해 주세요.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onConfirm(
        selectedCandidate.class,
        selectedCandidate.subject,
        selectedCandidate.teacher
      );
      onClose();
    } catch (err) {
      setError(err.message || '확정 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // [확정 취소 처리]
  const handleUnconfirm = async () => {
    setIsSaving(true);
    setError('');
    try {
      await onUnconfirm();
      onClose();
    } catch (err) {
      setError(err.message || '확정 취소 중 오류가 발생했습니다.');
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
            <h3>시간표 최종 확정</h3>
            <p>{date} | {period}교시 전체 학급 대상</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="error-msg">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 저장 중 로딩 피드백 메시지 */}
        {isSaving && (
          <div className="info-msg" style={{ background: '#e0f2fe', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '12px', padding: '10px 12px', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} className="syncing" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }} />
            <span>시간표 확정 데이터를 안전하게 저장하고 있습니다. 잠시만 기다려 주세요...</span>
          </div>
        )}

        {/* 경고 정보 상자 */}
        <div className="info-msg" style={{ background: '#e0f2fe', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '12.5px', padding: '14px', borderRadius: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
          <strong>💡 시간표 확정 안내 규칙:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px' }}>
            <li>같은 날짜/교시에는 여러 반의 신청 중 <strong>단 하나의 수업</strong>만 최종 확정할 수 있습니다.</li>
            <li style={{ marginTop: '4px' }}><strong>(중요) 각 학급은 모든 요일과 시간 중 단 한 번만 최종 확정</strong>될 수 있습니다. 예를 들어, 2-2반이 이미 다른 요일/교시에 확정되었다면 이 시간대에는 추가 확정이 불가능합니다.</li>
          </ul>
        </div>

        {/* 후보 리스트 */}
        <div className="confirm-modal-list">
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            신청된 후보군 목록
          </h4>
          
          {candidates.length === 0 ? (
            <div className="no-candidates">
              이 시간대({date} {period}교시)에 신청 완료된 수업이 없습니다.
            </div>
          ) : (
            candidates.map((cand) => {
              const isSelected = 
                selectedCandidate && 
                selectedCandidate.class === cand.class && 
                selectedCandidate.subject === cand.subject && 
                selectedCandidate.teacher === cand.teacher;

              // 이 학급이 이미 다른 요일/교시에 최종 확정되어 있는지 판단
              const isConfirmedElsewhere = Object.entries(confirmations).some(
                ([key, val]) => key !== confKey && val.class === cand.class
              );

              return (
                <div 
                  key={cand.id} 
                  className={`confirm-candidate-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (isConfirmedElsewhere || isSaving) return; // 이미 다른 요일/교시에 확정된 반 또는 저장 중에는 선택 불가
                    setError('');
                    setSelectedCandidate(cand);
                  }}
                  style={{
                    opacity: isConfirmedElsewhere ? 0.4 : 1,
                    cursor: isConfirmedElsewhere || isSaving ? 'not-allowed' : 'pointer',
                    pointerEvents: isConfirmedElsewhere && !isSelected ? 'none' : 'auto' // 기존에 혹시 선택되어있던 상태라면 클릭으로 해제는 가능하게 처리
                  }}
                >
                  <div className="confirm-candidate-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="confirm-class-tag">{cand.class}</span>
                      {isConfirmedElsewhere && (
                        <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>
                          (이미 다른 시간에 확정됨)
                        </span>
                      )}
                    </div>
                    <span className="confirm-details" style={{ marginTop: '4px', display: 'block' }}>
                      {cand.subject} <span className="teacher">{cand.teacher} 선생님</span>
                    </span>
                  </div>
                  <div className="select-indicator">
                    <CheckCircle size={14} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 저장 및 취소 액션 */}
        <div className="form-actions" style={{ marginTop: '24px' }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={isSaving}>
            닫기
          </button>
          {candidates.length > 0 && (
            <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveConfirm} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="syncing" style={{ animation: 'spin 1.5s linear infinite', marginRight: '6px' }} />
                  <span>저장 중...</span>
                </>
              ) : (
                '확정 저장하기'
              )}
            </button>
          )}
        </div>

        {/* 이미 확정된 정보가 있을 때 노출되는 확정 취소 섹션 */}
        {currentConfirmation && (
          <div className="unconfirm-footer">
            <button className="btn-unconfirm" onClick={handleUnconfirm} disabled={isSaving}>
              {isSaving ? '확정 해제 처리 중...' : '이 시간대 확정 해제하기 (신청 대기 상태로 복원)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmationModal;
