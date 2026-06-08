import React, { useState, useEffect } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';

const AdminLoginModal = ({ isOpen, onClose, onSuccess, pendingAction }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (username === 'admin' && password === 'admin123') {
      onSuccess();
    } else {
      setError('관리자 아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: '380px' }}>
        
        {/* 모달 헤더 */}
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} style={{ color: 'var(--accent-purple)' }} />
              관리자 인증
            </h3>
            <p>
              {pendingAction === 'confirm-mode' 
                ? '시간표 확정 모드 진입을 위해 로그인해 주세요.' 
                : '시간표 전체 초기화를 위해 로그인해 주세요.'}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="error-msg">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div className="input-group">
              <label htmlFor="admin-id">관리자 아이디</label>
              <input
                id="admin-id"
                type="text"
                placeholder="아이디를 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="admin-pw">비밀번호</label>
              <input
                id="admin-pw"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1.5 }}>
              인증 및 확인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginModal;
