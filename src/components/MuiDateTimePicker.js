import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, UIManager, Platform, LayoutAnimation } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from 'react-native-paper';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { Colors } from './Theme';

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

export default function MuiDateTimePicker({ visible, initialDate, onClose, onSelect, disableFutureDates = false }) {
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
      setTab('date');
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

  const isDateFuture = (y, m, d) => {
    if (!disableFutureDates) return false;
    const checkDate = new Date(y, m, d || 1);
    return checkDate > todayStart;
  };

  const isMonthFuture = (y, m) => {
    if (!disableFutureDates) return false;
    return (y > now.getFullYear()) || (y === now.getFullYear() && m > now.getMonth());
  };

  const isYearFuture = (y) => {
    if (!disableFutureDates) return false;
    return y > now.getFullYear();
  };

  // --- Date Logic ---
  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    if (disableFutureDates && isMonthFuture(viewMonth.getFullYear(), viewMonth.getMonth() + 1)) return;
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
    // Auto switch to time tab after slight delay for better UX
    setTimeout(() => {
        triggerAnimation();
        setTab('time');
        setTimeMode('hours');
    }, 300);
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

    return (
      <View style={styles.materialHeader}>
        <Text style={styles.materialHeaderLabel}>
          {tab === 'date' ? 'SELECT DATE' : 'SELECT TIME'}
        </Text>
        <Text style={styles.materialHeaderDate}>
          {tab === 'date' 
            ? `${WEEKDAYS_FULL[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
            : displayTime}
        </Text>
      </View>
    );
  };

  const renderDate = () => {
    const isNextMonthDisabled = disableFutureDates && isMonthFuture(viewMonth.getFullYear(), viewMonth.getMonth() + 1);

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
              style={[styles.headerBtn, dateMode === 'months' && styles.headerBtnActive]}
            >
              <Text style={[styles.monthTitle, dateMode === 'months' && { color: PRIMARY_COLOR }]}>{FULL_MONTHS[viewMonth.getMonth()]}</Text>
              <MaterialCommunityIcons name={dateMode === 'months' ? "menu-up" : "menu-down"} size={22} color={dateMode === 'months' ? PRIMARY_COLOR : Colors.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => {
                triggerAnimation();
                setYearPageStart(Math.floor(viewMonth.getFullYear() / 12) * 12);
                setDateMode(dateMode === 'years' ? 'days' : 'years');
              }} 
              style={[styles.headerBtn, dateMode === 'years' && styles.headerBtnActive]}
            >
              <Text style={[styles.monthTitle, dateMode === 'years' && { color: PRIMARY_COLOR }]}>
                {dateMode === 'years' ? `${yearPageStart} - ${yearPageStart + 11}` : viewMonth.getFullYear()}
              </Text>
              <MaterialCommunityIcons name={dateMode === 'years' ? "menu-up" : "menu-down"} size={22} color={dateMode === 'years' ? PRIMARY_COLOR : Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Only show header arrows in days mode */}
          {dateMode === 'days' && (
            <View style={styles.monthArrows}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleNextMonth} 
                style={[styles.arrowBtn, isNextMonthDisabled && { opacity: 0.3 }]}
                disabled={isNextMonthDisabled}
              >
                <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.text} />
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
      const isFuture = isDateFuture(viewMonth.getFullYear(), viewMonth.getMonth(), i);

      cells.push(
        <TouchableOpacity 
          key={`day-${i}`} 
          disabled={isFuture}
          onPress={() => handleDaySelect(i)}
          style={[
            styles.dayCell, 
            isSelected && styles.dayCellSelected,
            isFuture && { opacity: 0.4 }
          ]}
        >
          <Text style={[
            styles.dayText, 
            isSelected && styles.dayTextSelected, 
            !isSelected && isToday && styles.dayTextToday,
            isFuture && { color: '#9CA3AF' }
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
            <Text key={i} style={styles.weekDayText}>{d}</Text>
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
          const isFuture = isMonthFuture(viewMonth.getFullYear(), i);
          return (
            <TouchableOpacity 
              key={i} 
              disabled={isFuture}
              onPress={() => {
                triggerAnimation();
                setViewMonth(new Date(viewMonth.getFullYear(), i, 1));
                setDateMode('days');
              }}
              style={[
                styles.gridItem, 
                isSelected && styles.gridItemSelected,
                isFuture && { opacity: 0.4 }
              ]}
            >
              <Text style={[styles.gridItemText, isSelected && styles.gridItemTextSelected]}>{m}</Text>
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
    
    const isNextYearsDisabled = disableFutureDates && isYearFuture(yearPageStart + 12);
    
    return (
      <View style={styles.yearsWrapper}>
        <TouchableOpacity 
          onPress={handlePrevYears} 
          style={styles.sideArrowBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={PRIMARY_COLOR} />
        </TouchableOpacity>

        <View style={styles.gridContainerYears}>
          {years.map((y) => {
            const isSelected = viewMonth.getFullYear() === y;
            const isFuture = isYearFuture(y);
            return (
              <TouchableOpacity 
                key={y} 
                disabled={isFuture}
                onPress={() => {
                  triggerAnimation();
                  setViewMonth(new Date(y, viewMonth.getMonth(), 1));
                  setDateMode('days');
                }}
                style={[
                  styles.gridItemYears, 
                  isSelected && styles.gridItemSelected,
                  isFuture && { opacity: 0.3 }
                ]}
              >
                <Text style={[styles.gridItemText, isSelected && styles.gridItemTextSelected]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          onPress={handleNextYears} 
          disabled={isNextYearsDisabled}
          activeOpacity={0.7}
          style={[styles.sideArrowBtn, isNextYearsDisabled && { opacity: 0.2 }]}
        >
          <MaterialCommunityIcons name="chevron-right" size={32} color={PRIMARY_COLOR} />
        </TouchableOpacity>
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
            style={[styles.timePart, timeMode === 'hours' && styles.timePartActive]}
          >
            <Text style={[styles.timePartText, timeMode === 'hours' && styles.timePartTextActive]}>
              {String(displayH).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.timeColon}>:</Text>
          <TouchableOpacity 
            onPress={() => { triggerAnimation(); setTimeMode('minutes'); }} 
            style={[styles.timePart, timeMode === 'minutes' && styles.timePartActive]}
          >
            <Text style={[styles.timePartText, timeMode === 'minutes' && styles.timePartTextActive]}>
              {String(currentM).padStart(2, '0')}
            </Text>
          </TouchableOpacity>

          <View style={styles.ampmContainer}>
            <TouchableOpacity onPress={() => toggleAmPm(true)} style={[styles.ampmBtn, !isPm && styles.ampmActive]}>
              <Text style={[styles.ampmText, !isPm && styles.ampmTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleAmPm(false)} style={[styles.ampmBtn, isPm && styles.ampmActive]}>
              <Text style={[styles.ampmText, isPm && styles.ampmTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.clockContainer}>
          <View style={[styles.clockFace, { width: clockSize, height: clockSize, borderRadius: center }]}>
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
                  key={val}
                  onPress={() => handleTimeSelect(val)}
                  style={[styles.clockItem, { left: x, top: y, zIndex: 10 }]}
                >
                  <Text style={[styles.clockItemText, isSelected && { color: '#fff' }]}>
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
        <Animated.View style={[styles.card, { opacity: opacityValue, transform: [{ scale: scaleValue }] }]}>
           {/* Material 3 Header - Always Rendered */}
           {renderMaterialHeader()}

           {/* Tabs */}
           <View style={styles.tabContainer}>
             <TouchableOpacity 
               style={[styles.tab, tab === 'date' && styles.tabActive]} 
               onPress={() => { triggerAnimation(); setTab('date'); setDateMode('days'); }}
             >
               <MaterialCommunityIcons name="calendar-month" size={20} color={tab === 'date' ? PRIMARY_COLOR : '#6B7280'} />
               <Text style={[styles.tabText, tab === 'date' && styles.tabTextActive]}>Date</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[styles.tab, tab === 'time' && styles.tabActive]} 
               onPress={() => { triggerAnimation(); setTab('time'); }}
             >
               <MaterialCommunityIcons name="clock-outline" size={20} color={tab === 'time' ? PRIMARY_COLOR : '#6B7280'} />
               <Text style={[styles.tabText, tab === 'time' && styles.tabTextActive]}>Time</Text>
             </TouchableOpacity>
           </View>
           
           {/* Content */}
           <View style={styles.content}>
             {tab === 'date' ? renderDate() : renderTime()}
           </View>
           
           {/* Footer */}
           <View style={styles.footer}>
             <Button onPress={onClose} textColor="#6B7280">Cancel</Button>
             <Button 
               onPress={() => onSelect(date)} 
               mode="contained" 
               buttonColor={PRIMARY_COLOR}
               style={styles.okBtn}
               labelStyle={{ fontWeight: 'bold' }}
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#fff',
    width: '92%',
    maxWidth: 380,
    borderRadius: 24, // softer corners
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  materialHeader: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  materialHeaderLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  materialHeaderDate: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
    marginLeft: 6,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: '700',
  },
  content: {
    padding: 24,
    height: 380,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FAFAFA'
  },
  okBtn: {
    marginLeft: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  
  // Date
  dateContainer: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 4,
  },
  headerBtnActive: {
    backgroundColor: `${PRIMARY_COLOR}15`,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  monthArrows: {
    flexDirection: 'row',
  },
  arrowBtn: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  dateContentArea: {
    flex: 1,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
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
    marginBottom: 4,
  },
  dayCellSelected: {
    backgroundColor: PRIMARY_COLOR,
    elevation: 4,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dayText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
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
  },
  gridItem: {
    width: '31%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  gridItemSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
    elevation: 3,
  },
  gridItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  gridItemTextSelected: {
    color: '#fff',
  },

  // Grid (Years)
  yearsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  sideArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -12, // Pull arrows outward slightly 
    zIndex: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  gridContainerYears: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  gridItemYears: {
    width: '30%',
    marginHorizontal: '1.5%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },

  // Time
  timeContainer: {
    flex: 1,
    alignItems: 'center',
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  timePart: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  timePartActive: {
    backgroundColor: `${PRIMARY_COLOR}20`,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    paddingHorizontal: 18.5,
    paddingVertical: 12.5,
  },
  timePartText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
  },
  timePartTextActive: {
    color: PRIMARY_COLOR,
  },
  timeColon: {
    fontSize: 36,
    fontWeight: '800',
    marginHorizontal: 12,
    color: '#4B5563',
  },
  ampmContainer: {
    marginLeft: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  ampmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  ampmActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  ampmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
  },
  ampmTextActive: {
    color: '#fff',
  },
  clockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockFace: {
    backgroundColor: '#F3F4F6',
    position: 'relative',
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
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  }
});
