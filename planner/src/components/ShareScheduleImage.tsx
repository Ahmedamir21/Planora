import type { TimetableEvent } from './Timetable';
import { DAY_LABEL, DAYS, formatRange } from '../lib/time';
import { meetingOption } from '../lib/picks';
import { CREATOR_CREDIT, SEMESTER_CONFIG, TERM_SESSION_LABEL, TERM_LABEL } from '../config/semester';

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function ShareScheduleImage({
  events,
  title,
}: {
  events: TimetableEvent[];
  title: string;
}) {
  const generate = async () => {
    if (events.length === 0) return;

    const width = 1600;
    // Give even one-hour meetings room for the instructor, time and location.
    const height = 1600;
    const margin = 70;
    const headerH = 150;
    const footerH = 70;
    const gutterW = 95;
    const gridTop = margin + headerH;
    const gridLeft = margin + gutterW;
    const gridWidth = width - margin * 2 - gutterW;
    const gridHeight = height - gridTop - footerH - margin;
    const dayHeaderHeight = 52;
    const meetingHeight = gridHeight - dayHeaderHeight;
    const dayW = gridWidth / DAYS.length;

    const starts = events.map((e) => e.meeting.start);
    const ends = events.map((e) => e.meeting.end);
    const firstHour = Math.floor(Math.min(8 * 60, ...starts) / 60);
    const lastHour = Math.ceil(Math.max(18 * 60, ...ends) / 60);
    const totalMinutes = Math.max(60, (lastHour - firstHour) * 60);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paper = cssVar('--paper', '#ffffff');
    const surface = cssVar('--surface', '#f5f6f8');
    const line = cssVar('--line', '#d7dbe3');
    const muted = cssVar('--muted', '#687080');
    const ink = cssVar('--ink', '#1d2433');
    const accent = cssVar('--accent', '#315b92');

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = ink;
    ctx.font = '700 42px Inter, system-ui, sans-serif';
    ctx.fillText('Planora Schedule', margin, margin + 44);

    ctx.fillStyle = muted;
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(title, margin, margin + 82);
    ctx.fillText(TERM_SESSION_LABEL, margin, margin + 118);

    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText(SEMESTER_CONFIG.publicHostLabel, width - margin, margin + 48);
    ctx.textAlign = 'left';

    for (let i = 0; i <= DAYS.length; i++) {
      const x = gridLeft + i * dayW;
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + gridHeight);
      ctx.stroke();
    }

    for (let i = 0; i <= lastHour - firstHour; i++) {
      const y = gridTop + dayHeaderHeight + (i / (lastHour - firstHour)) * meetingHeight;
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();

      if (i < lastHour - firstHour) {
        ctx.fillStyle = muted;
        ctx.font = '500 18px ui-monospace, monospace';
        ctx.fillText(formatRange((firstHour + i) * 60, (firstHour + i) * 60 + 60).split('–')[0], margin, y + 23);
      }
    }

    DAYS.forEach((day, index) => {
      const x = gridLeft + index * dayW;
      ctx.fillStyle = surface;
      ctx.fillRect(x + 1, gridTop + 1, dayW - 2, 48);
      ctx.fillStyle = ink;
      ctx.font = '700 21px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(DAY_LABEL[day], x + dayW / 2, gridTop + 31);
    });
    ctx.textAlign = 'left';

    events.forEach((event) => {
      const dayIndex = DAYS.indexOf(event.meeting.day);
      if (dayIndex < 0) return;

      const x = gridLeft + dayIndex * dayW + 9;
      const topRatio = (event.meeting.start - firstHour * 60) / totalMinutes;
      const durationRatio = (event.meeting.end - event.meeting.start) / totalMinutes;
      const y = gridTop + dayHeaderHeight + topRatio * meetingHeight + 3;
      const h = Math.max(1, durationRatio * meetingHeight - 6);
      const w = dayW - 18;

      const courseColor = cssVar(`--c${event.course.c}`, accent);
      const courseBg = cssVar(`--c${event.course.c}-bg`, surface);

      ctx.fillStyle = courseBg;
      ctx.strokeStyle = courseColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = courseColor;
      ctx.font = '700 20px ui-monospace, monospace';
      const label = (value: string) => {
        if (ctx.measureText(value).width <= w - 24) return value;
        let end = value.length;
        while (end > 0 && ctx.measureText(value.slice(0, end) + '…').width > w - 24) end--;
        return value.slice(0, end) + '…';
      };
      ctx.fillText(label(event.course.code), x + 12, y + 26);

      ctx.fillStyle = ink;
      ctx.font = '600 16px Inter, system-ui, sans-serif';
      if (h >= 55) ctx.fillText(label(`${event.meeting.type} · Sec ${event.meeting.sec}`), x + 12, y + 49);

      if (h >= 78) {
        const instructor = meetingOption(event.course, event.meeting)?.instructor;
        const name = instructor?.unassigned ? 'Instructor not assigned' : instructor?.name ?? 'Instructor not published';
        ctx.fillStyle = muted;
        ctx.font = '500 15px Inter, system-ui, sans-serif';
        ctx.fillText(label(name), x + 12, y + 71);
        if (h >= 99) ctx.fillText(label(formatRange(event.meeting.start, event.meeting.end)), x + 12, y + 92);
        if (h >= 120) ctx.fillText(label(event.meeting.room || 'Room not published'), x + 12, y + 113);
      }
    });

    ctx.fillStyle = muted;
    ctx.font = '500 16px Inter, system-ui, sans-serif';
    ctx.fillText('Generated from the student planner · Verify final registration details on Self-Service.', margin, height - 48);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.fillText(CREATOR_CREDIT, width - margin, height - 24);
    ctx.textAlign = 'left';

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
    if (!blob) return;

    const file = new File([blob], `zewail-city-${SEMESTER_CONFIG.term.toLowerCase()}-${SEMESTER_CONFIG.year}-schedule.png`, { type: 'image/png' });

    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `My Zewail City ${TERM_LABEL} Schedule`,
          files: [file],
        });
        return;
      }
    } catch {
      // User cancelled or native sharing failed — fall back to a normal download.
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className="btn btn-tap"
      onClick={generate}
      disabled={events.length === 0}
      title="Create a clean PNG of your current schedule"
    >
      🖼 Share as Image
    </button>
  );
}
