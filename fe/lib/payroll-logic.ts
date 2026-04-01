/**
 * Payroll Logic Utility
 * Implements the 70/30 revenue split and attendance-based calculations.
 */

export interface SessionBlock {
  blockNumber: number; // 1, 2, 3...
  sessionIndices: number[]; // e.g., [1, 2, ..., 10]
  totalRevenue: number;
  teacherPayout: number;
  centerShare: number;
  students: {
    studentId: string;
    studentName: string;
    hasPaid: boolean;
    amountPaid: number;
    isLateJoiner: boolean;
    makeupOwed: number;
  }[];
}

/**
 * Calculates the 70% share for the teacher.
 */
export const calculateTeacherPayout = (totalRevenue: number): number => {
  return totalRevenue * 0.7;
};

/**
 * Calculates the 30% share for the center.
 */
export const calculateCenterShare = (totalRevenue: number): number => {
  return totalRevenue * 0.3;
};

/**
 * Groups sessions into 10-session blocks.
 */
export const getBlockFromSessionIndex = (sessionIndex: number): number => {
  return Math.ceil(sessionIndex / 10);
};

/**
 * Calculates how many makeup sessions a student is owed due to late registration.
 * Rules:
 * - Only late registration students get makeup sessions for sessions missed before starting.
 * - Absences do NOT get makeup sessions.
 */
export const calculateLateJoinerMakeup = (
  classStartDate: Date,
  studentJoinDate: Date,
  sessionsPerWeek: number
): number => {
  if (studentJoinDate <= classStartDate) return 0;
  
  const diffTime = Math.abs(studentJoinDate.getTime() - classStartDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = diffDays / 7;
  
  // Estimate missed sessions based on weeks
  return Math.floor(diffWeeks * sessionsPerWeek);
};
