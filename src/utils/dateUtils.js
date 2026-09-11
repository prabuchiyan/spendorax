export const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const formatDate = (dateString) => {
  if (!dateString) return 'No date';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const getLabelForDate = (d, periodType) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const type = periodType.replace(/ly$/, ''); // daily -> day, monthly -> month
  
  if (type === 'day' || type === 'daily') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    return `${day} ${months[d.getMonth()]}`;
  }
  if (type === 'week' || type === 'weekly') {
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startDay = String(startOfWeek.getDate()).padStart(2, '0');
    const startMonth = months[startOfWeek.getMonth()].charAt(0).toLowerCase();
    const endDay = String(endOfWeek.getDate());
    const endMonth = months[endOfWeek.getMonth()].charAt(0).toLowerCase();
    
    return `${startDay}${startMonth}-${endDay}${endMonth}`;
  }
  if (type === 'month' || type === 'monthly') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }
  if (type === 'year' || type === 'yearly') {
    return String(d.getFullYear());
  }
  return '';
};

export const getPeriodKey = (dateString, periodType) => {
  if (!dateString) return '';
  const dateStr = String(dateString).replace(' ', 'T');
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  
  return getLabelForDate(d, periodType);
};

export const generateContinuousPeriods = (periodType, offset) => {
  const periods = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    const shiftAmount = offset + i;

    if (periodType === 'day') {
      d.setDate(d.getDate() - shiftAmount);
    } else if (periodType === 'week') {
      d.setDate(d.getDate() - shiftAmount * 7);
    } else if (periodType === 'month') {
      d.setMonth(d.getMonth() - shiftAmount);
    } else if (periodType === 'year') {
      d.setFullYear(d.getFullYear() - shiftAmount);
    }
    periods.push(d);
  }
  return periods;
};

export const formatSqlite = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const getBoundsForPeriods = (periods, periodType) => {
  if (!periods || periods.length === 0) return { start: null, end: null };
  
  const firstDate = new Date(periods[0]);
  const lastDate = new Date(periods[periods.length - 1]);
  
  let start = new Date(firstDate);
  let end = new Date(lastDate);
  
  if (periodType === 'day') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (periodType === 'week') {
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    
    end.setDate(end.getDate() + (6 - end.getDay()));
    end.setHours(23, 59, 59, 999);
  } else if (periodType === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    
    end = new Date(end.getFullYear(), end.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (periodType === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return {
    start: formatSqlite(start),
    end: formatSqlite(end)
  };
};

export const getDateKey = (dateValue) => {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
