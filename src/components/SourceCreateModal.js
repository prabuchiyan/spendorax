import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { formatAmount } from '../utils/numberUtils';
import {
  TextInput,
  Button,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createSource, updateSource } from '../services/sources';
import IconPicker from './IconPicker';
import ColorPickerModal from './ColorPickerModal';
import FormModalShell from './FormModalShell';
import formModalStyles from './formModalStyles';

export default function SourceCreateModal({
  visible,
  onClose,
  onSave,
  onSourceCreated,
  editData,
}) {
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('0');
  const [icon, setIcon] = useState('cash');
  const [color, setColor] = useState('#4B7CF3');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editData) {
      // EDIT MODE
      setName(editData.name || '');
      setInitial(String(editData.initial_balance || 0));
      setIcon(editData.icon || 'cash');
      setColor(editData.color || '#4B7CF3');
    } else {
      // CREATE MODE
      setName('');
      setInitial('0');
      setIcon('cash');
      setColor('#4B7CF3');
    }
    setSaving(false);
    setShowIconPicker(false);
    setShowColorPicker(false);
  }, [visible, editData]);

  async function handleSave() {
    // Prevent duplicate taps
    if (saving) {
      return;
    }
    if (!name.trim()) {
      return;
    }

    const payload = {
      name: name.trim(),
      initial_balance: parseFloat(initial) || 0,
      icon,
      color,
      is_active: 1,
    };
    setSaving(true);
    try {
      if (editData && editData.id) {
        // EDIT
        await updateSource(editData.id, payload);
      } else {
        // CREATE
        await createSource(payload);
      }
      if (onSourceCreated) {
        onSourceCreated();
      } else if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving source:', error);
      alert('Failed to save source. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const displayName = name.trim() || 'Your Account';
  const numericBalance = parseFloat(initial) || 0;
  const formattedBalance = formatAmount(numericBalance);

  return (
    <FormModalShell
      visible={visible}
      onClose={saving ? undefined : onClose}
      icon={icon}
      iconColor={color}
      iconSize={24}
      title={editData ? 'Edit Account' : 'New Account'}
      subtitle="Manage your source details"
      actions={
        <View style={styles.footerActions}>
          <Button
            onPress={onClose}
            textColor="#666"
            disabled={saving}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            buttonColor={color}
            textColor="#FFFFFF"
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
          >
            {saving ? '' : editData ? 'Update' : 'Create'}
          </Button>
        </View>
      }
      footer={
        <>
          <IconPicker
            visible={showIconPicker}
            onClose={() => setShowIconPicker(false)}
            onSelect={setIcon}
          />
          <ColorPickerModal
            visible={showColorPicker}
            onClose={() => setShowColorPicker(false)}
            onSelect={setColor}
            currentColor={color}
          />
        </>
      }
    >
      {/* =========================
          ACCOUNT PREVIEW
      ========================== */}
      <View
        style={[
          styles.previewCard,
          {
            borderColor: `${color}35`,
            backgroundColor: `${color}0D`,
          },
        ]}
      >
        <View
          style={[
            styles.previewIcon,
            {
              backgroundColor: color,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={27}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.previewInfo}>
          <Text style={styles.previewLabel}>
            ACCOUNT PREVIEW
          </Text>

          <Text
            style={styles.previewName}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          <Text style={styles.previewBalance}>
            ₹{formattedBalance}
          </Text>
        </View>

        <View
          style={[
            styles.previewBadge,
            {
              backgroundColor: `${color}18`,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="wallet-outline"
            size={15}
            color={color}
          />
        </View>
      </View>

      {/* =========================
          ACCOUNT DETAILS
      ========================== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              {
                backgroundColor: `${color}15`,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="text-box-outline"
              size={18}
              color={color}
            />
          </View>

          <View>
            <Text style={styles.sectionTitle}>
              Account Details
            </Text>

            <Text style={styles.sectionSubtitle}>
              Give your account a name and balance
            </Text>
          </View>
        </View>

        <TextInput
          label="Account Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          disabled={saving}
          left={
            <TextInput.Icon
              icon="wallet-outline"
              color={color}
            />
          }
          outlineColor="#E2E5EA"
          activeOutlineColor={color}
        />

        <TextInput
          label="Initial Balance"
          value={initial}
          onChangeText={setInitial}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          disabled={saving}
          left={
            <TextInput.Icon
              icon="currency-inr"
              color={color}
            />
          }
          outlineColor="#E2E5EA"
          activeOutlineColor={color}
        />
      </View>

      {/* =========================
          APPEARANCE
      ========================== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              {
                backgroundColor: `${color}15`,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="palette-outline"
              size={18}
              color={color}
            />
          </View>

          <View>
            <Text style={styles.sectionTitle}>
              Appearance
            </Text>

            <Text style={styles.sectionSubtitle}>
              Customize how this account looks
            </Text>
          </View>
        </View>

        <View style={styles.appearanceRow}>
          {/* ICON */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowIconPicker(true)}
            disabled={saving}
            style={[
              styles.appearanceCard,
              {
                borderColor: `${color}30`,
              },
            ]}
          >
            <View
              style={[
                styles.appearanceIcon,
                {
                  backgroundColor: `${color}15`,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={icon}
                size={23}
                color={color}
              />
            </View>

            <View style={styles.appearanceText}>
              <Text style={styles.appearanceLabel}>
                Icon
              </Text>

              <Text style={styles.appearanceValue}>
                Customize
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {/* COLOR */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowColorPicker(true)}
            disabled={saving}
            style={[
              styles.appearanceCard,
              {
                borderColor: `${color}30`,
              },
            ]}
          >
            <View
              style={[
                styles.appearanceIcon,
                {
                  backgroundColor: `${color}18`,
                },
              ]}
            >
              <View
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: color,
                  },
                ]}
              />
            </View>

            <View style={styles.appearanceText}>
              <Text style={styles.appearanceLabel}>
                Color
              </Text>

              <Text style={styles.appearanceValue}>
                Customize
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
      </View>
    </FormModalShell>
  );
}

const styles = StyleSheet.create({
  /* =========================
     PREVIEW
  ========================== */
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  previewIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  previewInfo: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
    marginBottom: 3,
  },
  previewName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 3,
  },
  previewBalance: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  previewBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  /* =========================
     SECTION
  ========================== */
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  /* =========================
     INPUT
  ========================== */
  input: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  /* =========================
     APPEARANCE
  ========================== */
  appearanceRow: {
    gap: 10,
  },
  appearanceCard: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  appearanceIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  appearanceText: {
    flex: 1,
  },
  appearanceLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  appearanceValue: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  colorDot: {
    width: 21,
    height: 21,
    borderRadius: 11,
  },
  /* =========================
     FOOTER
  ========================== */
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 4,
  },
  saveButton: {
    borderRadius: 12,
    minWidth: 105,
  },
  saveButtonContent: {
    height: 44,
  },
});