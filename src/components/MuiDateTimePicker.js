import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, UIManager, Platform, LayoutAnimation } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from 'react-native-paper';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const PRIMARY_COLOR = '#3F8F6B';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MuiDateTimePicker({ visible, initialDate, onClose, onSelect, disableFutureDates = false, minDate = null, maxDate = null, allowClear = false, onClear, hideTime = false, hideDate = false }) {
  const { isDarkMode, theme } = useTheme();
  const [tab, setTab] = useState('date'); // 'date' | 'time'
  const [date, setDate] = useState(new Date());
  
  const [viewMonth, setViewMonth] = useState(new Date());
  const [dateMode, setDateMode] = useState('days'); // 'days' | 'months' | 'years'
  const [timeMode, setTimeMode] = useState('hours'); // 'hours' | 'minutes'
  
  const [yearPageStart, setYearPageStart] = useState(new Date().getFullYear());

  const scaleValue = useRef(new Animated.Value(0.9)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      const d = initialDate ? new Date(initialDate) : new Date();
      setDate(d);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setYearPageStart(Math.floor(d.getFullYear() / 12) * 12);
      setTab(hideDate ? 'time' : 'date');
      setDateMode('days');
      setTimeMode('hours');

      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      scaleValue.setValue(0.9);
      opacityValue.setValue(0);
    }
  }, [visible, initialDate]);

  const triggerAnimation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const isDateDisabled = (y, m, d) => {
    const checkDate = new Date(y, m, d || 1);
    if (disableFutureDates && checkDate > todayStart) return true;
    if (minDate && checkDate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && checkDate > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const isMonthDisabled = (y, m) => {
    const checkDate = new Date(y, m, 1);
    const cy = checkDate.getFullYear();
    const cm = checkDate.getMonth();
    
    if (disableFutureDates && ((cy > now.getFullYear()) || (cy === now.getFullYear() && cm > now.getMonth()))) return true;
    if (minDate && (cy < minDate.getFullYear() || (cy === minDate.getFullYear() && cm < minDate.getMonth()))) return true;
    if (maxDate && (cy > maxDate.getFullYear() || (cy === maxDate.getFullYear() && cm > maxDate.getMonth()))) return true;
    return false;
  };

  const isYearDisabled = (y) => {
    if (disableFutureDates && y > now.getFullYear()) return true;
    if (minDate && y < minDate.getFullYear()) return true;
    if (maxDate && y > maxDate.getFullYear()) return true;
    return false;
  };

  // --- Date Logic ---
  const handlePrevMonth = () => {
    if (isMonthDisabled(viewMonth.getFullYear(), viewMonth.getMonth() - 1)) return;
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    if (isMonthDisabled(viewMonth.getFullYear(), viewMonth.getMonth() + 1)) return;
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };
  
  const handlePrevYears = () => setYearPageStart(y => y - 12);
  const handleNextYears = () => setYearPageStart(y => y + 12);
  
  const handleDaySelect = (day) => {
    const newDate = new Date(date);
    newDate.setFullYear(viewMonth.getFullYear());
    newDate.setMonth(viewMonth.getMonth());
    newDate.setDate(day);
    setDate(newDate);
    if (!hideTime) {
      setTimeout(() => {
          triggerAnimation();
          setTab('time');
          setTimeMode('hours');
      }, 300);
    }
  };

  const renderMaterialHeader = () => {
    let displayTime = '';
    if (tab === 'time') {
      let h = date.getHours();
      const m = date.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      displayTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    const showTabs = !hideTime && !hideDate;

    return (
      <View style={[styles.materialHeader, { borderBottomColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.materialHeaderLabel, { color: theme.textSecondary }]}>
            {tab === 'date' ? 'SELECT DATE' : 'SELECT TIME'}
          </Text>

          {showTabs && (
            <View style={[styles.segmentedControl, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerAnimation();
                  setTab('date');
                  setDateMode('days');
                }}
                style={[
                  styles.segmentBtn,
                  tab === 'date' && [styles.segmentBtnActive, { backgroundColor: isDarkMode ? '#334155' : '#FFFFFF' }]
                ]}
              >
                <MaterialCommunityIcons
                  name="calendar-month"
                  size={15}
                  color={tab === 'date' ? PRIMARY_COLOR : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: tab === 'date' ? PRIMARY_COLOR : theme.textSecondary },
                    tab === 'date' && styles.segmentTextActive
                  ]}
                >
                  Date
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerAnimation();
                  setTab('time');
                }}
                style={[
                  styles.segmentBtn,
                  tab === 'time' && [styles.segmentBtnActive, { backgroundColor: isDarkMode ? '#334155' : '#FFFFFF' }]
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={15}
                  color={tab === 'time' ? PRIMARY_COLOR : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: tab === 'time' ? PRIMARY_COLOR : theme.textSecondary },
                    tab === 'time' && styles.segmentTextActive
                  ]}
                >
                  Time
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={[styles.materialHeaderDate, { color: theme.textPrimary }]}>
          {tab === 'date'
            ? `${WEEKDAYS_FULL[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
            : displayTime}
        </Text>
      </View>
    );
  };

  const renderDate = () => {
    const isNextMonthDisabled = isMonthDisabled(viewMonth.getFullYear(), viewMonth.getMonth() + 1);
    const isPrevMonthDisabled = isMonthDisabled(viewMonth.getFullYear(), viewMonth.getMonth() - 1);

    const isMonthPillActive = dateMode === 'months';
    const isYearPillActive = dateMode === 'years';

    return (
      <View style={styles.dateContainer}>
        {/* Header */}
        <View style={styles.monthHeader}>
          <View style={styles.headerSelectors}>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => {
                triggerAnimation();
                setDateMode(dateMode === 'months' ? 'days' : 'months');
              }} 
              style={[
                styles.headerPillBtn,
                { backgroundColor: isDarkMode ? (isMonthPillActive ? '#1E293B' : 'rgba(255,255,255,0.05)') : (isMonthPillActive ? '#EBF5F0' : '#F3F4F6') },
                isMonthPillActive && { borderColor: PRIMARY_COLOR, borderWidth: 1 }
              ]}
            >
              <Text style={[styles.monthTitle, { color: isMonthPillActive ? PRIMARY_COLOR : theme.textPrimary }]}>
                {FULL_MONTHS[viewMonth.getMonth()]}
              </Text>
              <MaterialCommunityIcons 
                name={isMonthPillActive ? "menu-up" : "menu-down"} 
                size={20} 
                color={isMonthPillActive ? PRIMARY_COLOR : theme.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => {
                triggerAnimation();
                setYearPageStart(Math.floor(viewMonth.getFullYear() / 12) * 12);
                setDateMode(dateMode === 'years' ? 'days' : 'years');
              }} 
              style={[
                styles.headerPillBtn,
                { backgroundColor: isDarkMode ? (isYearPillActive ? '#1E293B' : 'rgba(255,255,255,0.05)') : (isYearPillActive ? '#EBF5F0' : '#F3F4F6') },
                isYearPillActive && { borderColor: PRIMARY_COLOR, borderWidth: 1 }
              ]}
            >
              <Text style={[styles.monthTitle, { color: isYearPillActive ? PRIMARY_COLOR : theme.textPrimary }]}>
                {viewMonth.getFullYear()}
              </Text>
              <MaterialCommunityIcons 
                name={isYearPillActive ? "menu-up" : "menu-down"} 
                size={20} 
                color={isYearPillActive ? PRIMARY_COLOR : theme.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {/* Only show header arrows in days mode */}
          {dateMode === 'days' && (
            <View style={styles.monthArrows}>
              <TouchableOpacity 
                onPress={handlePrevMonth} 
                style={[
                  styles.arrowBtn, 
                  { backgroundColor: isDarkMode ? '#1E293B' : '#F3F4F6', borderColor: theme.border },
                  isPrevMonthDisabled && { opacity: 0.25 }
                ]}
                disabled={isPrevMonthDisabled}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-left" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleNextMonth} 
                style={[
                  styles.arrowBtn, 
                  { backgroundColor: isDarkMode ? '#1E293B' : '#F3F4F6', borderColor: theme.border },
                  isNextMonthDisabled && { opacity: 0.25 }
                ]}
                disabled={isNextMonthDisabled}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.dateContentArea}>
          {dateMode === 'days' && renderDaysGrid()}
          {dateMode === 'months' && renderMonthsGrid()}
          {dateMode === 'years' && renderYearsGrid()}
        </View>
      </View>
    );
  };

  const renderDaysGrid = () => {
    const startDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    
    const isSameMonth = date.getFullYear() === viewMonth.getFullYear() && date.getMonth() === viewMonth.getMonth();
    const selectedDay = isSameMonth ? date.getDate() : null;

    const isTodayMonth = now.getFullYear() === viewMonth.getFullYear() && now.getMonth() === viewMonth.getMonth();
    const todayDay = isTodayMonth ? now.getDate() : null;

    const cells = [];
    for (let i = 0; i < startDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = selectedDay === i;
      const isToday = todayDay === i;
      const isFuture = isDateDisabled(viewMonth.getFullYear(), viewMonth.getMonth(), i);

      cells.push(
        <TouchableOpacity 
          key={`day-${i}`} 
          disabled={isFuture}
          onPress={() => handleDaySelect(i)}
          activeOpacity={0.7}
          style={[
            styles.dayCell, 
            isSelected && styles.dayCellSelected,
            !isSelected && isToday && styles.dayCellToday,
            isFuture && { opacity: 0.35 }
          ]}
        >
          <Text style={[
            styles.dayText,
            { color: theme.textPrimary },
            !isSelected && isToday && styles.dayTextToday,
            isSelected && styles.dayTextSelected, 
            isFuture && { color: theme.textMuted }
          ]}>
            {i}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <>
        <View style={styles.weekDays}>
          {DAYS.map((d, i) => (
            <Text key={i} style={[styles.weekDayText, { color: theme.textSecondary }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {cells}
        </View>
      </>
    );
  };

  const renderMonthsGrid = () => {
    return (
      <View style={styles.gridContainer}>
        {MONTHS.map((m, i) => {
          const isSelected = viewMonth.getMonth() === i && date.getFullYear() === viewMonth.getFullYear();
          const isFuture = isMonthDisabled(viewMonth.getFullYear(), i);
          return (
            <TouchableOpacity 
              key={i} 
              disabled={isFuture}
              onPress={() => {
                triggerAnimation();
                setViewMonth(new Date(viewMonth.getFullYear(), i, 1));
                setDateMode('days');
              }}
              activeOpacity={0.7}
              style={[
                styles.gridItem, 
                { 
                  backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                  borderColor: theme.border 
                },
                isSelected && styles.gridItemSelected,
                isFuture && { opacity: 0.35 }
              ]}
            >
              <Text style={[
                styles.gridItemText, 
                { color: theme.textPrimary },
                isSelected && styles.gridItemTextSelected,
                isFuture && { color: theme.textMuted }
              ]}>
                {m}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderYearsGrid = () => {
    const years = [];
    for (let i = 0; i < 12; i++) {
      years.push(yearPageStart + i);
    }
    
    const isPrevYearsDisabled = isYearDisabled(yearPageStart - 1);
    const isNextYearsDisabled = isYearDisabled(yearPageStart + 12);
    
    return (
      <View style={styles.yearsContainer}>
        {/* Pagination Bar */}
        <View style={styles.yearsHeaderBar}>
          <TouchableOpacity 
            onPress={handlePrevYears} 
            disabled={isPrevYearsDisabled}
            style={[
              styles.arrowBtn, 
              { backgroundColor: isDarkMode ? '#1E293B' : '#F3F4F6', borderColor: theme.border },
              isPrevYearsDisabled && { opacity: 0.25 }
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.yearRangeTitle, { color: theme.textPrimary }]}>
            {yearPageStart} – {yearPageStart + 11}
          </Text>

          <TouchableOpacity 
            onPress={handleNextYears} 
            disabled={isNextYearsDisabled}
            activeOpacity={0.7}
            style={[
              styles.arrowBtn, 
              { backgroundColor: isDarkMode ? '#1E293B' : '#F3F4F6', borderColor: theme.border },
              isNextYearsDisabled && { opacity: 0.25 }
            ]}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.gridContainerYears}>
          {years.map((y) => {
            const isSelected = viewMonth.getFullYear() === y;
            const isFuture = isYearDisabled(y);
            return (
              <TouchableOpacity 
                key={y} 
                disabled={isFuture}
                onPress={() => {
                  triggerAnimation();
                  setViewMonth(new Date(y, viewMonth.getMonth(), 1));
                  setDateMode('days');
                }}
                activeOpacity={0.7}
                style={[
                  styles.gridItemYears, 
                  { 
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                    borderColor: theme.border 
                  },
                  isSelected && styles.gridItemSelected,
                  isFuture && { opacity: 0.35 }
                ]}
              >
                <Text style={[
                  styles.gridItemText, 
                  { color: theme.textPrimary },
                  isSelected && styles.gridItemTextSelected,
                  isFuture && { color: theme.textMuted }
                ]}>
                  {y}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // --- Time Logic ---
  const handleTimeSelect = (val) => {
    const newDate = new Date(date);
    if (timeMode === 'hours') {
      let h = newDate.getHours();
      const isPm = h >= 12;
      
      let newHour = val;
      if (isPm && newHour < 12) newHour += 12;
      if (!isPm && newHour === 12) newHour = 0;
      
      newDate.setHours(newHour);
      setDate(newDate);
      triggerAnimation();
      setTimeMode('minutes');
    } else {
      newDate.setMinutes(val);
      setDate(newDate);
    }
  };

  const toggleAmPm = (am) => {
    triggerAnimation();
    const newDate = new Date(date);
    let h = newDate.getHours();
    if (am && h >= 12) newDate.setHours(h - 12);
    else if (!am && h < 12) newDate.setHours(h + 12);
    setDate(newDate);
  };

  const renderTime = () => {
    let currentH = date.getHours();
    const isPm = currentH >= 12;
    let displayH = currentH % 12;
    if (displayH === 0) displayH = 12;
    
    const currentM = date.getMinutes();
    
    // items
    const items = [];
    if (timeMode === 'hours') {
      for (let i = 1; i <= 12; i++) items.push(i);
    } else {
      for (let i = 0; i < 60; i += 5) items.push(i);
    }

    const clockSize = 220;
    const radius = 82;
    const center = clockSize / 2;
    
    let selectedVal = timeMode === 'hours' ? displayH : currentM;
    let angleIndex = timeMode === 'hours' ? selectedVal : (selectedVal / 5);
    if (angleIndex === 0) angleIndex = 12;
    if (timeMode === 'minutes' && selectedVal % 5 !== 0) angleIndex = selectedVal / 5;

    const selectedAngle = (angleIndex * 30 - 90) * Math.PI / 180;
    const lineX = center + radius * Math.cos(selectedAngle);
    const lineY = center + radius * Math.sin(selectedAngle);

    return (
      <View style={styles.timeContainer}>
        <View style={styles.timeHeader}>
          <TouchableOpacity 
            onPress={() => { triggerAnimation(); setTimeMode('hours'); }} 
            activeOpacity={0.8}
            style={[
              styles.timePart, 
              { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.border },
              timeMode === 'hours' && styles.timePartActive
            ]}
          >
            <Text style={[styles.timePartText, { color: timeMode === 'hours' ? PRIMARY_COLOR : theme.textPrimary }]}>
              {String(displayH).padStart(2, '0')}
            </Text>
            <Text style={[styles.timePartLabel, { color: timeMode === 'hours' ? PRIMARY_COLOR : theme.textSecondary }]}>
              Hour
            </Text>
          </TouchableOpacity>

          <Text style={[styles.timeColon, { color: theme.textSecondary }]}>:</Text>

          <TouchableOpacity 
            onPress={() => { triggerAnimation(); setTimeMode('minutes'); }} 
            activeOpacity={0.8}
            style={[
              styles.timePart, 
              { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.border },
              timeMode === 'minutes' && styles.timePartActive
            ]}
          >
            <Text style={[styles.timePartText, { color: timeMode === 'minutes' ? PRIMARY_COLOR : theme.textPrimary }]}>
              {String(currentM).padStart(2, '0')}
            </Text>
            <Text style={[styles.timePartLabel, { color: timeMode === 'minutes' ? PRIMARY_COLOR : theme.textSecondary }]}>
              Min
            </Text>
          </TouchableOpacity>

          <View style={[styles.ampmContainer, { borderColor: theme.border, backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
            <TouchableOpacity 
              onPress={() => toggleAmPm(true)} 
              activeOpacity={0.8}
              style={[styles.ampmBtn, !isPm && styles.ampmActive]}
            >
              <Text style={[styles.ampmText, { color: !isPm ? '#FFFFFF' : theme.textSecondary }]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => toggleAmPm(false)} 
              activeOpacity={0.8}
              style={[styles.ampmBtn, isPm && styles.ampmActive]}
            >
              <Text style={[styles.ampmText, { color: isPm ? '#FFFFFF' : theme.textSecondary }]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.clockContainer}>
          <View style={[
            styles.clockFace, 
            { 
              backgroundColor: isDarkMode ? "#1E293B" : "#F3F4F6",
              borderColor: theme.border,
              width: clockSize, 
              height: clockSize, 
              borderRadius: center 
            }
          ]}>
            <Svg width={clockSize} height={clockSize} style={StyleSheet.absoluteFill}>
              <SvgCircle cx={center} cy={center} r="4" fill={PRIMARY_COLOR} />
              <Line x1={center} y1={center} x2={lineX} y2={lineY} stroke={PRIMARY_COLOR} strokeWidth="2" />
              <SvgCircle cx={lineX} cy={lineY} r="16" fill={PRIMARY_COLOR} />
            </Svg>
            
            {items.map((val) => {
              let aIndex = timeMode === 'hours' ? val : (val / 5);
              if (aIndex === 0) aIndex = 12;
              
              const angle = (aIndex * 30 - 90) * Math.PI / 180;
              const x = center + radius * Math.cos(angle) - 18;
              const y = center + radius * Math.sin(angle) - 18;
              
              const isSelected = (timeMode === 'hours' && displayH === val) || (timeMode === 'minutes' && currentM === val);

              return (
                <TouchableOpacity
                  key={`${timeMode}-${val}`}
                  onPress={() => handleTimeSelect(val)}
                  style={[styles.clockItem, { left: x, top: y, zIndex: 10 }]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.clockItemText, 
                    { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                    isSelected && { fontWeight: '700' }
                  ]}>
                    {timeMode === 'minutes' ? String(val).padStart(2, '0') : val}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <Animated.View style={[
          styles.card, 
          { 
            backgroundColor: theme.cardBg, 
            borderColor: theme.border,
            opacity: opacityValue, 
            transform: [{ scale: scaleValue }] 
          }
        ]}>
           {/* Material 3 Header with Integrated Tabs */}
           {renderMaterialHeader()}
           
           {/* Content */}
           <View style={styles.content}>
             {tab === 'date' ? renderDate() : renderTime()}
           </View>
           
           {/* Footer */}
           <View style={[styles.footer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
             {allowClear && (
               <Button 
                 onPress={() => onClear ? onClear() : onSelect(null)} 
                 textColor={theme.danger || '#EF4444'} 
                 style={{ marginRight: 'auto' }}
                 labelStyle={{ fontWeight: '600' }}
               >
                 Clear
               </Button>
             )}
             <Button 
               onPress={onClose} 
               textColor={theme.textSecondary}
               style={styles.cancelBtn}
               labelStyle={{ fontWeight: '600' }}
             >
               Cancel
             </Button>
             <Button 
               onPress={() => onSelect(date)} 
               mode="contained" 
               buttonColor={PRIMARY_COLOR}
               style={styles.okBtn}
               labelStyle={{ fontWeight: '700', letterSpacing: 0.5 }}
             >
               OK
             </Button>
           </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    width: '92%',
    maxWidth: 360,
    borderRadius: 28, // Modern Material 3 Dialog radius
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  materialHeader: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  materialHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  materialHeaderDate: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  segmentBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 350,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    borderRadius: 20,
    marginRight: 4,
  },
  okBtn: {
    marginLeft: 8,
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  
  // Date
  dateContainer: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 6,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 2,
  },
  monthArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderRadius: 17,
    borderWidth: 1,
  },
  dateContentArea: {
    flex: 1,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: PRIMARY_COLOR,
    elevation: 3,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextToday: {
    color: PRIMARY_COLOR,
    fontWeight: '800',
  },

  // Grid (Months)
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  gridItem: {
    width: '31%',
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  gridItemSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
    elevation: 2,
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gridItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Grid (Years)
  yearsContainer: {
    flex: 1,
  },
  yearsHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  yearRangeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridContainerYears: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItemYears: {
    width: '31%',
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },

  // Time
  timeContainer: {
    flex: 1,
    alignItems: 'center',
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timePart: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 64,
  },
  timePartActive: {
    backgroundColor: `${PRIMARY_COLOR}18`,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
  },
  timePartText: {
    fontSize: 28,
    fontWeight: '800',
  },
  timePartLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  timeColon: {
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  ampmContainer: {
    marginLeft: 14,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ampmActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  ampmText: {
    fontSize: 12,
    fontWeight: '800',
  },
  clockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockFace: {
    position: 'relative',
    borderWidth: 1,
  },
  clockItem: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockItemText: {
    fontSize: 14,
    fontWeight: '600',
  }
});
