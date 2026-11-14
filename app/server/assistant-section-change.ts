/** Resolve an explicit section swap from the same options shown in the planner. */
export function exactSectionChange(message: string, context: any) {
  if (!/\b(change|switch|swap|replace|move|select|choose|pick|ghayyar|8ayyar|baddel|badal)\b|غي[ّرر]|بد[ّلل]|انقل|اختار|حدد/i.test(message)) return null;
  const choosing = /\b(select|choose|pick)\b|اختار|حدد/i.test(message);
  const refs = [...message.matchAll(/\b(lec(?:ture)?|lab|tut(?:orial)?)\s*(?:sec(?:tion)?\s*)?#?\s*0*(\d{1,2})\b/gi)];
  if (!refs.length) return null;
  const kindOf = (value: string) => /^lec/i.test(value) ? 'Lecture' : /^lab/i.test(value) ? 'Lab' : 'Tutorial';
  const kind = kindOf(refs[refs.length - 1][1]);
  if (refs.some((ref) => kindOf(ref[1]) !== kind)) return null;
  const number = (value: unknown) => String(value ?? '').replace(/^0+/, '') || '0';
  const targetSection = number(refs[refs.length - 1][2]);
  const sourceSection = refs.length > 1 ? number(refs[0][2]) : null;
  const selected = Array.isArray(context.selectedCourses) ? context.selectedCourses : [];
  const available = Array.isArray(context.availableCourses) ? context.availableCourses : [];
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionsFullCode = (course: any) => {
    if (typeof course?.code !== 'string') return false;
    const code = course.code.toLowerCase();
    const fullCode = code.split(/\s+/).map(escapeRegex).join('\\s*');
    return new RegExp('\\b' + fullCode + '\\b', 'i').test(message);
  };
  const allCourses = available
    .map((item: any) => ({ ...item, code: item?.code ?? selected.find((course: any) => course?.courseId === item?.courseId)?.code }))
    .filter((course: any) => typeof course?.code === 'string');
  const exactMatches = allCourses.filter(mentionsFullCode);
  const subjectMatches = allCourses.filter((course: any) =>
    new RegExp('\\b' + escapeRegex(course.code.split(/\s+/)[0]) + '\\b', 'i').test(message));
  const mentioned = exactMatches.length ? exactMatches : subjectMatches;
  if (mentioned.length !== 1) return null;
  const options = mentioned[0];
  let course = selected.find((item: any) => item?.courseId === options.courseId);
  const arabic = /[\u0600-\u06ff]/.test(message);
  const franco = !arabic && /\b(?:leh|3ayez|3ayz|momken|e2|bta3|msh|mesh|ma3|ghayyar|8ayyar)\b|[237589](?=[a-z])/i.test(message);
  const say = (english: string, arabicText: string, francoText: string) => arabic ? arabicText : franco ? francoText : english;
  if (!options || !Array.isArray(options.sections)) return null;
  if (!course) {
    if (context.selectedCourseIds?.includes(options.courseId)) {
      if (choosing) course = { courseId: options.courseId, code: options.code, meetings: [] };
      else return { text: say(`${options.code} is selected, but no ${kind} section is selected yet. Choose section ${sourceSection || targetSection} first, or ask me to select section ${targetSection} directly.`, `${options.code} مضافة لكن مفيش سكشن ${kind} مختار. اختار سكشن ${sourceSection || targetSection} الأول، أو اطلب اختيار سكشن ${targetSection} مباشرة.`, `${options.code} selected bas mafesh ${kind} sec metekhtar. Ekhtar sec ${sourceSection || targetSection} aw etlob select sec ${targetSection} mobashara.`), proposal: null, constraintsAdd: [], lockActions: [] };
    } else {
      return { text: say(`${options.code} is not selected in your current schedule. Add the course and choose its current ${kind} before asking to switch it.`, `${options.code} مش مضافة لجدولك حاليًا. ضيف المادة واختار ${kind} الأول قبل ما تبدّل السكشن.`, `${options.code} msh selected fel schedule. Deef el course w ekhtar ${kind} el 7alya abl ma t8ayyar el sec.`), proposal: null, constraintsAdd: [], lockActions: [] };
    }
  }
  const current = Array.isArray(course.meetings)
    ? course.meetings.find((meeting: any) => meeting?.type === kind) : null;
  if (!current && !choosing) {
    return { text: say(`${course.code} is selected, but no ${kind} section is selected yet. Choose your current section first, or ask me to select section ${targetSection} directly.`, `${course.code} مضافة لكن مفيش سكشن ${kind} مختار. اختار السكشن الحالي الأول، أو اطلب مني اختيار سكشن ${targetSection} مباشرة.`, `${course.code} selected bas mafesh ${kind} sec metekhtar. Ekhtar el sec el 7alya aw etlob select sec ${targetSection} mobashara.`), proposal: null, constraintsAdd: [], lockActions: [] };
  }
  if (sourceSection && (!current || number(current.section) !== sourceSection)) {
    return { text: say(`${course.code} ${kind} section ${sourceSection.padStart(2, '0')} is not currently selected. Your selected section is ${String(current?.section || 'none')}.`, `${course.code} ${kind} سكشن ${sourceSection.padStart(2, '0')} مش مختار حاليًا؛ المختار هو ${current?.section || 'مفيش'}.`, `${course.code} ${kind} sec ${sourceSection.padStart(2, '0')} msh selected delwa2ty; el selected sec ${current?.section || 'none'}.`), proposal: null, constraintsAdd: [], lockActions: [] };
  }
  const matches = options.sections.filter((section: any) => section?.type === kind && number(section.section) === targetSection && typeof section.meetingId === 'string');
  if (matches.length === 0) {
    return { text: say(`${course.code} ${kind} section ${targetSection.padStart(2, '0')} is not listed in the current planner data.`, `${course.code} ${kind} سكشن ${targetSection.padStart(2, '0')} مش موجود في بيانات الجدول الحالية.`, `${course.code} ${kind} sec ${targetSection.padStart(2, '0')} msh mawgood fy data el schedule el 7alya.`), proposal: null, constraintsAdd: [], lockActions: [] };
  }
  if (matches.length !== 1) return null;
  const target = matches[0];
  if (target.meetingId === current?.meetingId) {
    return { text: say(`${course.code} ${kind} section ${target.section} is already selected.`, `${course.code} ${kind} سكشن ${target.section} مختار بالفعل.`, `${course.code} ${kind} sec ${target.section} already selected.`), proposal: null, constraintsAdd: [], lockActions: [] };
  }
  if (context.locks?.courseIds?.includes(course.courseId) || context.locks?.components?.[course.courseId]?.[kind]) {
    return { text: say(`${course.code} ${kind} is locked. Unlock it before switching sections.`, `${course.code} ${kind} مقفول. افتح القفل قبل تبديل السكشن.`, `${course.code} ${kind} locked. Efta7 el lock abl ma t8ayyar el sec.`), proposal: null, constraintsAdd: [], lockActions: [] };
  }
  const label = current ? `${course.code} ${kind} · Sec ${current.section} → Sec ${target.section}` : `${course.code} ${kind} · Select Sec ${target.section}`;
  return {
    text: say(`Section ${target.section} exists for ${course.code}. Here is the requested ${current ? 'change' : 'selection'} to preview. Nothing has been applied yet; confirm it after the planner checks your other meetings and locks.`, `سكشن ${target.section} موجود لـ${course.code}. جهزت ${current ? 'التبديل' : 'الاختيار'} للمراجعة، ولسه متطبقش. اتأكد من التعارضات والأقفال واضغط تطبيق لو مناسب.`, `Sec ${target.section} mawgood le ${course.code}. 7attit el ${current ? 'taghyeer' : 'ekhtyar'} fel preview, lesa matetba2sh. Et2akked men el conflicts wel locks w edghat Apply law monaseb.`),
    proposal: {
      title: label,
      summary: `${target.day} ${target.time} · ${target.room || 'Room not published'} · ${target.instructor || 'Instructor not assigned'}`,
      changes: [{ type: 'set_meeting', courseId: course.courseId, meetingType: kind,
        meetingId: target.meetingId, label, reason: `You requested ${kind} section ${target.section}.` }],
    },
    constraintsAdd: [], lockActions: [],
  };
}
