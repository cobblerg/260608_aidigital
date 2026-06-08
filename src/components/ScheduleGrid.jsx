import React from 'react';

// 특정 셀이 신청 불가능한 '빗금' 셀인지 판단하는 헬퍼 함수
export const isDisabledCell = (date, period, className) => {
  // 7/6(월) 4, 5, 6교시: 2-1, 2-3, 2-4, 2-5, 2-6, 2-8반 비활성화
  if (date === '7/6(월)' && [4, 5, 6].includes(period)) {
    return ['2-1반', '2-3반', '2-4반', '2-5반', '2-6반', '2-8반'].includes(className);
  }
  // 7/7(화) 3, 4교시: 2-1, 2-3, 2-4, 2-5, 2-6반 비활성화
  if (date === '7/7(화)' && [3, 4].includes(period)) {
    return ['2-1반', '2-3반', '2-4반', '2-5반', '2-6반'].includes(className);
  }
  // 7/7(화) 5교시: 2-3, 2-4, 2-5, 2-6반 비활성화
  if (date === '7/7(화)' && period === 5) {
    return ['2-3반', '2-4반', '2-5반', '2-6반'].includes(className);
  }
  // 7/9(목) 1교시: 2-3반 비활성화
  if (date === '7/9(목)' && period === 1) {
    return className === '2-3반';
  }
  return false;
};

const ScheduleGrid = ({ timeSlots, classes, applications, confirmations, mode, onCellClick }) => {
  return (
    <div className="table-container glass-panel">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>월일</th>
            <th>교시</th>
            {classes.map(cls => (
              <th key={cls}>{cls}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, index) => {
            const { date, period } = slot;
            
            // 해당 교시에 확정된 학급 정보가 있는지 확인
            const confKey = `${date}_${period}`;
            const confirmedInfo = confirmations[confKey];

            return (
              <tr key={`${date}_${period}_${index}`}>
                {/* 1. 월일 (중복되는 요일은 첫 번째 행에만 표시하거나 한눈에 볼 수 있도록 매 행 출력) */}
                <td className="date-cell">{date}</td>
                {/* 2. 교시 */}
                <td className="period-cell">{period}</td>
                {/* 3. 학급별 시간표 셀 */}
                {classes.map(cls => {
                  const isDisabled = isDisabledCell(date, period, cls);
                  const cellKey = `${date}_${period}_${cls}`;
                  const cellApps = applications[cellKey] || [];
                  
                  // 이 셀 자체가 확정 상태인지 확인
                  const isCellConfirmed = confirmedInfo && confirmedInfo.class === cls;
                  
                  // 같은 날짜/교시에 다른 학급이 이미 확정되었는지 여부
                  const isAnyOtherConfirmed = confirmedInfo && confirmedInfo.class !== cls;

                  // 이 학급이 현재 시간대 외에 다른 날짜/교시에 이미 확정되었는지 여부
                  const isClassConfirmedElsewhere = Object.entries(confirmations).some(
                    ([key, val]) => key !== confKey && val.class === cls
                  );

                  // 셀 스타일 적용을 위한 클래스명 구성
                  let cellClass = 'schedule-cell';
                  if (isDisabled) cellClass += ' disabled';
                  if (isCellConfirmed) cellClass += ' confirmed';
                  
                  // 탈락(rejected) 조건:
                  // 1. 같은 날짜/교시에 다른 반이 이미 확정되었거나
                  // 2. 이 학급이 이미 다른 날짜/교시에 확정되었을 때
                  if ((isAnyOtherConfirmed || isClassConfirmedElsewhere) && cellApps.length > 0) {
                    cellClass += ' rejected';
                  }

                  return (
                    <td
                      key={cls}
                      className={cellClass}
                      onClick={() => !isDisabled && onCellClick(date, period, cls)}
                    >
                      {/* 빗금이 쳐진 신청 불가 구역이 아닐 때만 렌더링 */}
                      {!isDisabled && (
                        <>
                          {isCellConfirmed ? (
                            // 최종 확정된 시간표 정보 표시
                            <div className="cell-confirmed-display">
                              <span className="subject">{confirmedInfo.subject}</span>
                              <span className="teacher">{confirmedInfo.teacher}</span>
                              <span className="confirmed-badge">확정</span>
                            </div>
                          ) : (
                            // 신청 모드 또는 확정 대기 중일 때 후보 리스트(최대 3개) 표시
                            <div className="cell-app-list">
                              {cellApps.map((app) => (
                                <div key={app.id} className="cell-app-item" title={`${app.subject} (${app.teacher})`}>
                                  {app.subject} - {app.teacher}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleGrid;
