"use client";
import ScheduleManager from "@/components/pages/schedule-manager";

interface ScheduleTabProps {
  userRole: string;
  userId: string;
}

export default function ScheduleTab({ userRole, userId }: ScheduleTabProps) {
  return (
    <div className="mt-6">
      <ScheduleManager userRole={userRole} userId={userId} />
    </div>
  );
}
