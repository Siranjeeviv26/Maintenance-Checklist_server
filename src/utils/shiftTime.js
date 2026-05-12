function parseHHMM(value) {
  const [hourRaw, minuteRaw] = String(value || "").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

function getShiftEndDate(assignmentDate, endTime) {
  const date = new Date(assignmentDate);
  const parsed = parseHHMM(endTime);
  if (!parsed || Number.isNaN(date.getTime())) return null;
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date;
}

function isShiftExpired(assignmentDate, endTime, now = new Date()) {
  const shiftEnd = getShiftEndDate(assignmentDate, endTime);
  if (!shiftEnd) return true;
  
  // For development/demo purposes, if the assignment date is in the past,
  // we'll allow submission for 24 hours after the shift end time
  const bufferTime = 24 * 60 * 60 * 1000; // 24 hours in ms
  return now > (shiftEnd.getTime() + bufferTime);
}

module.exports = {
  isShiftExpired,
  getShiftEndDate,
};
