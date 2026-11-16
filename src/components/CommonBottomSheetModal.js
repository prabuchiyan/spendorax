import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function CommonBottomSheetModal({
  visible,
  onCancel,
  onConfirm,
  loading = false,
  type = 'danger',
  icon,
  title,
  subtitle,
  message,
  warnings = [],
  warningTitle,
  itemPreview,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmIcon,
}) {
  const { isDarkMode } = useTheme();
  const [internalLoading, setInternalLoading] = useState(false);

  const isLoading = loading || internalLoading;

  if (!visible && !isLoading) return null;

  // Theming & Colors based on type
  const isDanger = type === 'danger';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';

  // Primary Action & Accent Colors
  const accentColor = isDanger
    ? '#DC2626'
    : isWarning
    ? '#D97706'
    : isSuccess
    ? '#059669'
    : '#2563EB';

  const defaultHeaderIcon = isDanger
    ? 'trash-can-outline'
    : isWarning
    ? 'alert-circle-outline'
    : isSuccess
    ? 'check-circle-outline'
    : 'information-outline';

  const defaultWarningTitle = isDanger
    ? 'Permanent Action Warning'
    : isWarning
    ? 'Important Notice'
    : isSuccess
    ? 'Confirmation Notice'
    : 'Action Information';

  const defaultConfirmLabel = isDanger
    ? 'Delete Permanently'
    : isWarning
    ? 'Proceed'
    : 'Confirm';

  const finalConfirmLabel = confirmLabel || defaultConfirmLabel;
  const finalHeaderIcon = icon || defaultHeaderIcon;
  const finalWarningTitle = warningTitle || defaultWarningTitle;

  // Container & Text Theme Colors
  const modalBg = isDarkMode ? '#0F172A' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#334155' : '#E2E8F0';
  const textColor = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';

  // Notice Box Theme Colors
  const noticeBoxBg = isDarkMode
    ? isDanger
      ? 'rgba(239, 68, 68, 0.12)'
      : isWarning
      ? 'rgba(217, 119, 6, 0.12)'
      : isSuccess
      ? 'rgba(16, 185, 129, 0.12)'
      : 'rgba(37, 99, 235, 0.12)'
    : isDanger
    ? '#FEF2F2'
    : isWarning
    ? '#FFFBEB'
    : isSuccess
    ? '#ECFDF5'
    : '#EFF6FF';

  const noticeBoxBorder = isDarkMode
    ? isDanger
      ? 'rgba(239, 68, 68, 0.28)'
      : isWarning
      ? 'rgba(245, 158, 11, 0.28)'
      : isSuccess
      ? 'rgba(16, 185, 129, 0.28)'
      : 'rgba(59, 130, 246, 0.28)'
    : isDanger
    ? '#FECACA'
    : isWarning
    ? '#FDE68A'
    : isSuccess
    ? '#A7F3D0'
    : '#BFDBFE';

  const noticeTitleColor = isDarkMode
    ? isDanger
      ? '#F87171'
      : isWarning
      ? '#FBBF24'
      : isSuccess
      ? '#34D399'
      : '#60A5FA'
    : isDanger
    ? '#B91C1C'
    : isWarning
    ? '#B45309'
    : isSuccess
    ? '#047857'
    : '#1D4ED8';

  const iconCircleBg = isDarkMode
    ? isDanger
      ? 'rgba(239, 68, 68, 0.2)'
      : isWarning
      ? 'rgba(217, 119, 6, 0.2)'
      : isSuccess
      ? 'rgba(16, 185, 129, 0.2)'
      : 'rgba(37, 99, 235, 0.2)'
    : isDanger
    ? '#FEE2E2'
    : isWarning
    ? '#FEF3C7'
    : isSuccess
    ? '#D1FAE5'
    : '#DBEAFE';

  const iconCircleBorder = isDarkMode
    ? isDanger
      ? 'rgba(239, 68, 68, 0.35)'
      : isWarning
      ? 'rgba(245, 158, 11, 0.35)'
      : isSuccess
      ? 'rgba(16, 185, 129, 0.35)'
      : 'rgba(59, 130, 246, 0.35)'
    : isDanger
    ? '#FECACA'
    : isWarning
    ? '#FDE68A'
    : isSuccess
    ? '#A7F3D0'
    : '#BFDBFE';

  const handleConfirmPress = async () => {
    if (isLoading) return;
    try {
      const res = onConfirm?.();
      if (res && typeof res.then === 'function') {
        setInternalLoading(true);
        await res;
      }
    } finally {
      setInternalLoading(false);
    }
  };

  // Format warnings if provided
  const warningItems = Array.isArray(warnings) ? warnings : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isLoading) onCancel?.();
      }}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!isLoading) onCancel?.();
          }}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: modalBg,
              borderColor: cardBorder,
            },
          ]}>
          {/* Top Drag Handle */}
          <View style={styles.handleWrap}>
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' },
              ]}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Header Icon + Title */}
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: iconCircleBg,
                    borderColor: iconCircleBorder,
                  },
                ]}>
                <MaterialCommunityIcons
                  name={finalHeaderIcon}
                  size={30}
                  color={accentColor}
                />
              </View>

              <View style={styles.titleWrap}>
                <Text style={[styles.title, { color: textColor }]}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: textMuted }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Optional Item Preview */}
            {itemPreview ? (
              <View style={styles.previewContainer}>{itemPreview}</View>
            ) : null}

            {/* Warnings / Notices Card */}
            {warningItems.length > 0 ? (
              <View
                style={[
                  styles.warningBox,
                  {
                    backgroundColor: noticeBoxBg,
                    borderColor: noticeBoxBorder,
                  },
                ]}>
                <View style={styles.warningBoxHeader}>
                  <MaterialCommunityIcons
                    name={
                      isDanger
                        ? 'alert-octagon-outline'
                        : isWarning
                        ? 'alert-circle-outline'
                        : isSuccess
                        ? 'check-circle-outline'
                        : 'information-outline'
                    }
                    size={18}
                    color={accentColor}
                  />
                  <Text
                    style={[
                      styles.warningBoxTitle,
                      { color: noticeTitleColor },
                    ]}>
                    {finalWarningTitle}
                  </Text>
                </View>

                <View style={styles.noticeList}>
                  {warningItems.map((w, index) => {
                    const isObj = typeof w === 'object' && w !== null;
                    const wTitle = isObj ? w.title : null;
                    const wText = isObj ? w.text : String(w);
                    const wIcon = isObj ? w.icon : null;
                    const wBulletColor = isObj && w.color ? w.color : accentColor;
                    const isHex = typeof wBulletColor === 'string' && wBulletColor.startsWith('#');
                    const bulletBg = isHex
                      ? `${wBulletColor}20`
                      : isDarkMode
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.06)';

                    return (
                      <View key={index} style={styles.noticeItem}>
                        <View
                          style={[
                            styles.noticeIconBullet,
                            {
                              backgroundColor: bulletBg,
                            },
                          ]}>
                          <MaterialCommunityIcons
                            name={
                              wIcon ||
                              (isDanger
                                ? 'close-circle-outline'
                                : isWarning
                                ? 'alert-circle-outline'
                                : isSuccess
                                ? 'check-circle-outline'
                                : 'information-outline')
                            }
                            size={15}
                            color={wBulletColor}
                          />
                        </View>
                        <Text style={[styles.noticeText, { color: textColor }]}>
                          {wTitle ? (
                            <Text style={styles.noticeBold}>
                              {wTitle}:{' '}
                            </Text>
                          ) : null}
                          {wText}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : message ? (
              <View
                style={[
                  styles.messageBox,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                    borderColor: cardBorder,
                  },
                ]}>
                <Text style={[styles.messageText, { color: textColor }]}>
                  {message}
                </Text>
              </View>
            ) : null}

            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                    borderColor: cardBorder,
                  },
                ]}
                disabled={isLoading}
                activeOpacity={0.7}
                onPress={onCancel}>
                <Text style={[styles.cancelBtnText, { color: textColor }]}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: accentColor },
                  isLoading && { opacity: 0.75 },
                ]}
                disabled={isLoading}
                activeOpacity={0.8}
                onPress={handleConfirmPress}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.confirmBtnContent}>
                    {confirmIcon ? (
                      <MaterialCommunityIcons
                        name={confirmIcon}
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                    ) : null}
                    <Text style={styles.confirmBtnText}>
                      {finalConfirmLabel}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 18,
  },
  previewContainer: {
    marginBottom: 16,
  },
  warningBox: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  warningBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  warningBoxTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  noticeList: {
    gap: 10,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeIconBullet: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  noticeBold: {
    fontWeight: '700',
  },
  messageBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  confirmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
